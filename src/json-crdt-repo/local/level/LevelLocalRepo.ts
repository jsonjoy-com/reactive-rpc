import {LevelLocalRepoCore, LevelLocalRepoCoreOpts} from './core/LevelLocalRepoCore';
import {LevelLocalRepoSync, LevelLocalRepoSyncOpts} from './sync/CrudLocalSync';
import {FanOut} from 'thingies/lib/fanout';
import type {LocalRepo, LocalRepoSubData, LocalRepoSyncRequest, LocalRepoSyncResponse} from '../types';

export interface LevelLocalRepoOpts extends LevelLocalRepoCoreOpts {
  sync?: LevelLocalRepoSyncOpts;
}

export class LevelLocalRepo implements LocalRepo {
  protected readonly _core: LevelLocalRepoCore;
  protected readonly _sync: LevelLocalRepoSync;

  constructor(opts: LevelLocalRepoOpts) {
    this._core = new LevelLocalRepoCore(opts);
    this._sync = new LevelLocalRepoSync(opts.sync ?? {}, this._core);
  }

  public async sync(request: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
    return await this._core.sync(request);
  }

  /**
   * Deletes a block (document) from the local repo.
   */
  public async del(collection: string[], id: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Subscribes to changes in the local repo. The changes can be coming from
   * remote peers as well as other tabs or processes from the same device.
   */
  public sub(collection: string[], id: string): FanOut<LocalRepoSubData> {
    throw new Error('Method not implemented.');
  }

  // public async create(
  //   collection: string[],
  //   log: Log<any>,
  //   id: string = genId(),
  // ): Promise<{id: string; remote: Promise<void>}> {
  //   if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
  //   const blob = this.encode(log);
  //   await this.lockForWrite({collection, id}, async () => {
  //     await this.core.write(collection, id, blob);
  //   });
  //   const remote = (async () => {
  //     const sync = this.sync;
  //     await sync.markDirty(collection, id);
  //     // TODO: use pushNewBlock instead?
  //     const success = await sync.sync(collection, id);
  //     if (!success) throw new Error('NOT_SYNCED');
  //   })();
  //   remote.catch(() => {});
  //   return {id, remote};
  // }

  // public async update(collection: string[], id: string, patches: Patch[]): Promise<{remote: Promise<void>}> {
  //   const core = this.core;
  //   await this.lockForWrite({collection, id}, async () => {
  //     const blob = await core.read(collection, id);
  //     const decoded = this.core.decoder.decode(blob, {format: 'seq.cbor', history: true});
  //     const log = decoded.history!;
  //     log.end.applyBatch(patches);
  //     const blob2 = this.encode(log);
  //     await core.write(collection, id, blob2, 'missing');
  //   });
  //   const remote = (async () => {
  //     const sync = this.sync;
  //     await sync.markDirty(collection, id);
  //     const success = await sync.sync(collection, id);
  //     if (!success) throw new Error('NOT_SYNCED');
  //   })();
  //   remote.catch(() => {});
  //   return {remote};
  // }

  // public async delete(collection: string[], id: string): Promise<void> {
  //   throw new Error('Method not implemented.');
  //   // const deps = this.core;
  //   // await this.lockBlock({collection, id}, async () => {
  //   //   await deps.crud.drop(collection, true);
  //   // });
  // }

  // public async read(collection: string[], id: string): Promise<{log: Log; cursor: string}> {
  //   // - Read latest from remote.
  //   // - Attempt to sync, just loading the latest, if some recent version exists.
  //   const core = this.core;
  //   const blob = await core.read(collection, id);
  //   const decoded = core.decoder.decode(blob, {format: 'seq.cbor', frontier: true});
  //   const log = decoded.frontier!;
  //   return {
  //     log,
  //     cursor: '',
  //   };
  // }

  // public async readHistory(collection: string[], id: string, cursor: string): Promise<{log: Log; cursor: string}> {
  //   const core = this.core;
  //   const blob = await core.read(collection, id);
  //   const decoded = core.decoder.decode(blob, {format: 'seq.cbor', frontier: true, history: true});
  //   const log = decoded.frontier!;
  //   return {
  //     log,
  //     cursor: '',
  //   };
  // }

  // protected encode(log: Log): Uint8Array {
  //   const encoded = this.core.encoder.encode(log, {
  //     format: 'seq.cbor',
  //     model: 'binary',
  //     history: 'binary',
  //     noView: true,
  //   });
  //   return encoded;
  // }

  // protected async lockForWrite(
  //   {
  //     collection,
  //     id,
  //   }: {
  //     collection: string[];
  //     id: string;
  //   },
  //   fn: () => Promise<void>,
  // ): Promise<void> {
  //   const key = ['write', collection, id].join('/');
  //   await this.core.locks.lock(key, 300, 300)(fn);
  // }
}
