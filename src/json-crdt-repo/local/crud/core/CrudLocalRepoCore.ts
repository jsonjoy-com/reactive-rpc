import {encoder, decoder} from '@jsonjoy.com/json-pack/lib/cbor/shared';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {LogEncoder} from 'json-joy/lib/json-crdt/log/codec/LogEncoder';
import {LogDecoder} from 'json-joy/lib/json-crdt/log/codec/LogDecoder';
import {decoder as patchDecoder} from 'json-joy/lib/json-crdt-patch/codec/binary/shared';
import {BehaviorSubject} from 'rxjs';
import {LocalRepoSyncRequest, LocalRepoSyncResponse} from '../../types';
import {patchListBlob} from './util';
import {BlockMetadata} from '../types';
import {Model, type Patch} from 'json-joy/lib/json-crdt';
import type {CrudLocalRepoCipher} from './types';
import type {CborEncoder, CborDecoder} from '@jsonjoy.com/json-pack/lib/cbor';
import type {CrudApi} from 'fs-zoo/lib/crud/types';
import type {Locks} from 'thingies/lib/Locks';
import type {RemoteHistory} from '../../../remote/types';

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
  Metadata = 'meta.seq.bin',
  
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

  /**
   * The name of the root collection, which contains all blocks.
   */
  RootFolder = 'blocks',

  SyncFolder = 'sync',

  SyncFolderDirty = 'dirty',
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
    return [FileName.RootFolder, ...collection, id];
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

  public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
    if (!req.cursor && req.batch) {
      // TODO: time patches with user's sid should be rewritten.
      try {
        return await this.create(req.col, req.id, req.batch);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'Exists') {
          return await this.rebaseAndMerge(req.col, req.id, req.batch);
        }
        throw error;
      }
    } else if (req.cursor && req.batch) {
      throw new Error('Not implemented: update');
    } else if (!req.cursor && !req.batch) {
      const model = await this.read(req.col, req.id);
      return {model: model};
    } else if (req.cursor && !req.batch) {
      throw new Error('Not implemented: catch up');
    } else {
      throw new Error('INV_SYNC');
    }
  }

  public async create(col: string[], id: string, batch?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
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
    const remote = this.markDirtyAndSync(col, id);
    remote.catch(() => {});
    return {remote};
  }

  public async rebaseAndMerge(col: string[], id: string, batch?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    const dir = this.blockDir(col, id);
    if (!batch || !batch.length) throw new Error('EMPTY_BATCH');
    await this.lockModelWrite(col, id, async () => {
      const {patches} = await this.readMetadata1(dir);
      let nextTick = 0;
      for (const patch of patches) {
        const patchTime = patch.getId()?.time ?? 0;
        const patchSpan = patch.span();
        const patchNextTick = patchTime + patchSpan + 1;
        if (patchNextTick > nextTick) nextTick = patchNextTick;
      }
      const sid = this.sid;
      const length = batch.length;
      const rebased: Patch[] = [];
      for (let i = 0; i < length; i++) {
        const patch = batch[i];
        if (patch.getId()?.sid === sid) {
          const rebasedPatch = patch.rebase(nextTick);
          rebased.push(rebasedPatch);
        } else {
          rebased.push(patch);
        }
        nextTick += patch.span();
      }
      await this.appendFrontier0(dir, patchListBlob(rebased));
    });
    const remote = this.markDirtyAndSync(col, id);
    remote.catch(() => {});
    return {remote};
  }

  public async read(col: string[], id: string): Promise<Model> {
    const dir = this.blockDir(col, id);
    const [model, {patches}] = await Promise.all([
      this.readModel(col, id),
      this.readMetadata1(dir),
    ]);
    model.applyBatch(patches);
    return model;
  }

  public async readModel(col: string[], id: string): Promise<Model> {
    const dir = this.blockDir(col, id);
    try {
      const blob = await this.crud.get(dir, FileName.Model);
      const model = Model.load(blob, this.sid);
      return model;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'ResourceNotFound')
        return Model.create(void 0, this.sid); 
      throw error;
    }
  }

  protected async writeMetadata0(dir: string[], meta: BlockMetadata, frontier: Uint8Array, throwIf?: 'exists' | 'missing'): Promise<void> {
    const cborEncoder = this.cborEncoder;
    const writer = cborEncoder.writer;
    cborEncoder.writeAny(meta);
    writer.buf(frontier, frontier.length);
    const blob = writer.flush();
    await this.crud.put(dir, FileName.Metadata, blob, {throwIf});
  }

  protected async appendFrontier0(dir: string[], frontier: Uint8Array): Promise<void> {
    await this.crud.put(dir, FileName.Metadata, frontier, {pos: -1, throwIf: 'missing'});
  }

  // protected async appendFrontier1(dir: string[], patches: Patch[]): Promise<void> {
  //   const frontier = patchListBlob(patches);
  //   await this.appendFrontier0(dir, frontier);
  // }

  protected async readMetadata0(dir: string[]): Promise<{meta: BlockMetadata; frontier: Uint8Array}> {
    const blob = await this.crud.get(dir, FileName.Metadata);
    const decoder = this.cborDecoder;
    const reader = decoder.reader;
    reader.reset(blob);
    const meta = decoder.val() as BlockMetadata;
    if (!meta || typeof meta !== 'object' || typeof meta.time !== 'number' || typeof meta.ts !== 'number') {
      throw new Error('CORRUPT_METADATA');
    }
    const frontier = blob.subarray(reader.x);
    return {meta, frontier};
  }

  protected async readMetadata1(dir: string[]): Promise<{meta: BlockMetadata; patches: Patch[]}> {
    const {meta, frontier} = await this.readMetadata0(dir);
    const patches: Patch[] = [];
    const reader = patchDecoder.reader;
    reader.reset(frontier);
    while (reader.x < frontier.length)
      patches.push(patchDecoder.readPatch());
    return {meta, patches};
  }

  /** Mark block as "dirty", has local changes, needs sync with remote. */
  public async markDirty(collection: string[], id: string): Promise<void> {
    const dir = [FileName.SyncFolder, FileName.SyncFolderDirty, ...collection];
    await this.crud.put(dir, id, new Uint8Array(0));
  }

  public async markDirtyAndSync(collection: string[], id: string): Promise<void> {
    await this.markDirty(collection, id);
    // TODO: ask remote to sync.
  }

  /** Mark block as "clean", was successfully synced with remote. */
  public async markTidy(collection: string[], id: string): Promise<void> {
    const dir = [FileName.SyncFolder, FileName.SyncFolderDirty, ...collection];
    await this.crud.del(dir, id, true);
  }

  // protected async writeMetadata1(dir: string[], meta: BlockMetadata, patches: Patch[], throwIf?: 'exists' | 'missing'): Promise<void> {
  //   const frontier = patchListBlob(patches);
  //   await this.writeMetadata0(dir, meta, frontier, throwIf);
  // }

  

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
