import {encoder, decoder} from '@jsonjoy.com/json-pack/lib/cbor/shared';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {LogEncoder} from 'json-joy/lib/json-crdt/log/codec/LogEncoder';
import {LogDecoder} from 'json-joy/lib/json-crdt/log/codec/LogDecoder';
import {BehaviorSubject} from 'rxjs';
import {genId} from '../util';
import type {Patch} from 'json-joy/lib/json-crdt';
import type {CrudLocalRepoCipher} from './types';
import type {CborEncoder, CborDecoder} from '@jsonjoy.com/json-pack/lib/cbor';
import type {CrudApi} from 'fs-zoo/lib/crud/types';
import type {Locks} from 'thingies/lib/Locks';
import type {RemoteHistory} from '../../../remote/types';
import {LocalRepoSyncRequest, LocalRepoSyncResponse} from '../../types';
import {patchListBlob} from './util';
import {BlockMetadata} from '../types';

/**
 * Each JSON CRDT *block* is represented by a collection, which contains
 * multiple resources (files).
 * 
 * The only required resources is the `Metadata` file, which stores some local
 * metadata and local operations, which have not yet been synced to the remote.
 * 
 * The `Model` file stores the latest server-confirmed state of the block.
 * 
 * Optionally, the block can store full or partial history of all edits. That
 * history is stored in `Past` and `Future` files.
 * 
 * @private
 */
const enum FileName {
  /**
   * Store JSON CRDT metadata and view of the latest state confirmed by the
   * remote (server). Stores the `Model` in `binary` codec.
   */
  Model = 'model.crdt',

  /**
   * Stores local metadata (required for syncing and other data) and the list of
   * patches, which were created locally and not yet synced to the remote
   * (the frontier).
   * 
   * The file stores a sequence of CBOR values. The first value is the
   * {@link BlockMetadata} object, the rest are {@link Patch} objects serialized
   * using the `binary` codec.
   */
  Metadata = 'meta.seq.cbor',
  
  /**
   * The past history of {@link Patch} objects. The history starts either from
   * the beginning of time, or contains the starting document {@link Model}. The
   * history is encoded in {@link Log} format.
   * 
   * The history can be treated as immutable, hence it is stored in a compressed
   * ".gz" CBOR sequence file.
   */
  Past = 'past.seq.cbor.gz',

  /**
   * The list of {@link Patch} objects starting from the point where `Past` ends
   * and runs until either the `Model` is reached, or terminates earlier if
   * there is a gap in the history. That gap can be loaded from the remote.
   *
   * The `Future` history does not contain the *frontier* stored in `Metadata.
   * Once the frontier patches are synced to the remote, they can be appended to
   * the `Future` file, hence the `Future` file is not compressed.
   */
  Future = 'future.seq.cbor',
}

/** @private */
const enum RootFolder {
  Blocks = 'blocks',
}

export interface CrudLocalRepoCoreOpts {
  readonly remote: RemoteHistory;
  readonly crud: CrudApi;
  readonly locks: Locks;
  readonly sid: number;
  readonly connected$?: BehaviorSubject<boolean>;
  readonly cipher?: CrudLocalRepoCipher;
}

export class CrudLocalRepoCore {
  public readonly remote: RemoteHistory;
  public readonly crud: CrudApi;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly cborEncoder: CborEncoder = encoder;
  public readonly cborDecoder: CborDecoder = decoder;
  public readonly encoder: LogEncoder = new LogEncoder({cborEncoder: this.cborEncoder});
  public readonly decoder: LogDecoder = new LogDecoder({cborDecoder: this.cborDecoder});
  public readonly connected$: BehaviorSubject<boolean>;
  protected readonly cipher?: CrudLocalRepoCipher;

  constructor(opts: CrudLocalRepoCoreOpts) {
    this.remote = opts.remote;
    this.crud = opts.crud;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
    this.cipher = opts.cipher;
  }

  public async encrypt(blob: Uint8Array): Promise<Uint8Array> {   
    blob = await gzip(blob);
    if (this.cipher) blob = await this.cipher.encrypt(blob);
    return blob;
  }

  public async decrypt(blob: Uint8Array): Promise<Uint8Array> {
    if (this.cipher) blob = await this.cipher.decrypt(blob);
    blob = await ungzip(blob);
    return blob;
  }

  public blockDir(collection: string[], id: string): string[] {
    return [RootFolder.Blocks, ...collection, id];
  }

  // public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
  //   const {col, id, batch} = req;
  //   const crud = this.crud;
  //   const dir = this.blockDir(col, id);
  //   let patchSeqBlob: Uint8Array | undefined;
  //   if (batch && batch.length) {
  //     patchSeqBlob = patchListBlob(batch);
  //   }
  //   await this.lockModelWrite(col, id, async () => {
  //     if (patchSeqBlob) {
  //       console.log('patchSeqBlob' , patchSeqBlob, dir, FileName.UnSyncedPatches);
  //       await crud.put(dir, FileName.UnSyncedPatches, patchSeqBlob, {throwIf: req.throwIf, pos: -1});
  //     }
  //   });
  //   // const blob = this.encode(log);
  //   // await this.write(collection, id, blob, 'missing');

  //     // if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
  //     // const blob = this.encode(log);
  //     // await this.lockForWrite({collection, id}, async () => {
  //     //   await this.core.write(collection, id, blob);
  //     // });
  //     const remote = (async () => {
  //       // const sync = this.sync;
  //       // await sync.markDirty(collection, id);
  //       // // TODO: use pushNewBlock instead?
  //       // const success = await sync.sync(collection, id);
  //       // if (!success) throw new Error('NOT_SYNCED');
  //     })();
  //     remote.catch(() => {});
  //     return {remote};
  // }

  protected async writeMetadata0(dir: string[], meta: BlockMetadata, frontier: Uint8Array, throwIf?: 'exists' | 'missing'): Promise<void> {
    const cborEncoder = this.cborEncoder;
    const writer = cborEncoder.writer;
    cborEncoder.writeAny(meta);
    writer.buf(frontier, frontier.length);
    const blob = writer.flush();
    await this.crud.put(dir, FileName.Metadata, blob, {throwIf});
  }

  public async create(col: string[], id: string, batch?: Patch[]): Promise<LocalRepoSyncResponse> {
    const dir = this.blockDir(col, id);
    if (!batch || !batch.length) throw new Error('EMPTY_BATCH');
    const frontier = patchListBlob(batch);
    const meta: BlockMetadata = {
      time: -1,
      ts: 0,
    };
    await this.lockModelWrite(col, id, async () => {
      await this.writeMetadata0(dir, meta, frontier, 'exists');
    });
    const remote = (async () => {
      // const sync = this.sync;
      // await sync.markDirty(collection, id);
      // // TODO: use pushNewBlock instead?
      // const success = await sync.sync(collection, id);
      // if (!success) throw new Error('NOT_SYNCED');
    })();
    remote.catch(() => {});
    return {remote};
  }

  protected async createMeta(col: string[], id: string): Promise<void> {
    const meta: BlockMetadata = {
      time: -1,
      ts: 0,
    };
  }

  

  // public async sync(collection: string[], id: string, request: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
  //   throw new Error('Method not implemented.');
  // }

  // public async read(collection: string[], id: string): Promise<Uint8Array> {
  //   const crudCollection = this.blockDir(collection, id);
  //   const blob = await this.crud.get(crudCollection, FileName.LatestModel);
  //   const decrypted = await this.decrypt(blob);
  //   return decrypted;
  // }

  // public async write(collection: string[], id: string, blob: Uint8Array, throwIf: 'exists' | 'missing' = 'exists'): Promise<void> {
  //   const crudCollection = this.blockDir(collection, id);
  //   const encrypted = await this.encrypt(blob);
  //   await this.crud.put(crudCollection, FileName.LatestModel, encrypted, {throwIf});
  // }

  protected async lockModelWrite(col: string[], id: string, fn: () => Promise<void>): Promise<void> {
    const key = ['model-w', ...col, id].join('/');
    await this.locks.lock(key, 500, 500)(fn);
  }
}
