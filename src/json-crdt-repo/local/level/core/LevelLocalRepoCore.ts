import {encoder, decoder} from '@jsonjoy.com/json-pack/lib/cbor/shared';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {LogEncoder} from 'json-joy/lib/json-crdt/log/codec/LogEncoder';
import {LogDecoder} from 'json-joy/lib/json-crdt/log/codec/LogDecoder';
import {BehaviorSubject} from 'rxjs';
import {LocalRepoSyncRequest, LocalRepoSyncResponse} from '../../types';
import {patchListBlob} from './util';
import {BinStrLevel, BlockMetadata} from '../types';
import type {Patch} from 'json-joy/lib/json-crdt';
import type {CrudLocalRepoCipher} from './types';
import type {CborEncoder, CborDecoder} from '@jsonjoy.com/json-pack/lib/cbor';
import type {Locks} from 'thingies/lib/Locks';
import type {RemoteHistory} from '../../../remote/types';

export interface LevelLocalRepoCoreOpts {
  readonly remote: RemoteHistory;
  readonly kv: BinStrLevel;
  readonly locks: Locks;
  readonly sid: number;
  readonly connected$?: BehaviorSubject<boolean>;
  readonly cipher?: CrudLocalRepoCipher;
}

export class LevelLocalRepoCore {
  public readonly remote: RemoteHistory;
  readonly kv: BinStrLevel;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly cborEncoder: CborEncoder = encoder;
  public readonly cborDecoder: CborDecoder = decoder;
  public readonly encoder: LogEncoder = new LogEncoder({cborEncoder: this.cborEncoder});
  public readonly decoder: LogDecoder = new LogDecoder({cborDecoder: this.cborDecoder});
  public readonly connected$: BehaviorSubject<boolean>;
  protected readonly cipher?: CrudLocalRepoCipher;

  constructor(opts: LevelLocalRepoCoreOpts) {
    this.remote = opts.remote;
    this.kv = opts.kv;
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
    return [];
    // return [FileName.RootFolder, ...collection, id];
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
      // TODO: merge if model already exists.
      // TODO: time patches with user's sid should be rewritten.
      try {
        return await this.create(req.col, req.id, req.batch);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'Exists') {
          // console.log('MERGE EXISTING...');
        }
        throw error;
      }
    } else {
      throw new Error('Method not implemented.');
    }
  }

  public async create(col: string[], id: string, batch?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    throw new Error('not implemented');
    // const dir = this.blockDir(col, id);
    // if (!batch || !batch.length) throw new Error('EMPTY_BATCH');
    // const frontier = patchListBlob(batch);
    // const meta: BlockMetadata = {
    //   time: -1,
    //   ts: 0,
    // };
    // await this.lockModelWrite(col, id, async () => {
    //   await this.writeMetadata0(dir, meta, frontier, 'exists');
    // });
    // const remote = (async () => {
    //   // const sync = this.sync;
    //   // await sync.markDirty(collection, id);
    //   // // TODO: use pushNewBlock instead?
    //   // const success = await sync.sync(collection, id);
    //   // if (!success) throw new Error('NOT_SYNCED');
    // })();
    // remote.catch(() => {});
    // return {remote};
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
