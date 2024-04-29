import {timeout} from 'thingies/lib/timeout';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {ts} from 'json-joy/lib/json-crdt-patch';
import {once} from 'thingies';
import type {RemoteBlockPatch} from '../../remote/types';
import type {ServerCrudLocalHistoryCore} from './ServerCrudLocalHistoryCore';
import type {BlockSyncMetadata} from './types';
import type {Subscription} from 'rxjs';

const SYNC_FILE_NAME = 'sync.cbor';

export interface ServerCrudLocalHistorySyncOpts {
  /**
   * Number of milliseconds after which remote calls are considered timed out.
   */
  remoteTimeout?: number;

  /**
   * Minimum backoff time in milliseconds for the sync loop.
   */
  syncLoopMinBackoff?: number;

  /**
   * Maximum backoff time in milliseconds for the sync loop.
   */
  syncLoopMaxBackoff?: number;
}

export class ServerCrudLocalHistorySync {
  // private syncLoopTimer: any = 0;
  private _conSub: Subscription | undefined = undefined;

  constructor(
    protected readonly opts: ServerCrudLocalHistorySyncOpts,
    protected readonly core: ServerCrudLocalHistoryCore,
  ) {}

  @once
  public start(): void {
    this._conSub = this.core.connected$.subscribe((connected) => {
      if (connected) {
        this.syncAll().catch(() => {});
      } else {

      }
    });
  }

  @once
  public stop(): void {
    this._conSub?.unsubscribe();
  }

  protected remoteTimeout(): number {
    return this.opts.remoteTimeout ?? 5000;
  }

  public async sync(collection: string[], id: string): Promise<boolean> {
    return await this.lockItemSync<boolean>({collection, id}, async () => {
      try {
        // TODO: handle case when this times out, but actually succeeds, so on re-sync it handles the case when the block is already synced.
        return timeout(this.remoteTimeout(), async () => {
          const core = this.core;
          if (!core.connected$.getValue()) return false;
          const meta = await this.getMeta(collection, id);
          const blob = await core.read(collection, id);
          const {history} = core.decoder.decode(blob, {format: 'seq.cbor', history: true});
          const patches: RemoteBlockPatch[] = [];
          let time = 0;
          const patchTree = history!.patches;
          let node = patchTree.getOrNextLower(ts(0, meta.time)) || patchTree.first();
          if (node) {
            do {
              const {k: id, v: patch} = node;
              const patchSid = id.sid;
              const patchTime = id.time;
              if ((patchSid === core.sid || (patchSid === SESSION.GLOBAL)) && (patchTime > meta.time)) {
                patches.push({blob: patch.toBinary()});
                time = patchTime;
              }
            } while (node = patchTree.next(node));
          }
          if (!patches.length) {
            await this.putMeta(collection, id, {time, ts: Date.now()});
            return true;
          }
          const remoteId = [...collection, id].join('/');
          await this.core.remote.update(remoteId, patches);
          await this.putMeta(collection, id, {time, ts: Date.now()});
          await this.markTidy(collection, id);
          return true;
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'TIMEOUT') return false;
        throw error;
      }
    });
  }

  /**
   * Locks a specific item for synchronization.
   */
  private async lockItemSync<T>(
    {
      collection,
      id,
    }: {
      collection: string[];
      id: string;
    },
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = ['sync', collection, id].join('/');
    const locker = this.core.locks.lock(key, this.remoteTimeout() + 200, 200);
    return await locker<T>(fn);
  }

  public async getMeta(collection: string[], id: string): Promise<BlockSyncMetadata> {
    const deps = this.core;
    try {
      const meta = await deps.crud.get(['sync', 'state', ...collection, id], SYNC_FILE_NAME);
      return deps.cborDecoder.decode(meta) as BlockSyncMetadata;
    } catch (err) {
      return {
        time: -1,
        ts: 0,
      } as BlockSyncMetadata;
    }
  }

  protected async putMeta(collection: string[], id: string, meta: BlockSyncMetadata): Promise<void> {
    const deps = this.core;
    const blob = deps.cborEncoder.encode(meta);
    await deps.crud.put(['sync', 'state', ...collection, id], SYNC_FILE_NAME, blob);
  }

  public async markDirty(collection: string[], id: string): Promise<void> {
    const dir = ['sync', 'dirty', ...collection];
    await this.core.crud.put(dir, id, new Uint8Array(0));
  }

  public async markTidy(collection: string[], id: string): Promise<void> {
    const dir = ['sync', 'dirty', ...collection];
    await this.core.crud.del(dir, id);
  }

  public async isDirty(collection: string[], id: string): Promise<boolean> {
    const dir = ['sync', 'dirty', ...collection];
    try {
      await this.core.crud.info(dir, id);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'ResourceNotFound') return false;
      throw error;
    }
  }

  protected async * listDirty(collection: string[] = ['sync', 'dirty']): AsyncIterableIterator<ItemId> {
    for await (const entry of this.core.crud.scan(collection)) {
      if (entry.type === 'collection') yield* this.listDirty([...collection, entry.id]);
      else yield {collection, id: entry.id};
    }
  }

  protected async * syncDirty(): AsyncIterableIterator<SyncResult> {
    for await (const block of this.listDirty()) {
      const {collection: [_sync, _dirty, ...collection], id} = block;
      try {
        const success = await this.sync(collection, id);
        yield [block, success];
      } catch (error) {
        yield [block, false, error];      
      }
    }
  }

  public async syncAll(): Promise<SyncResultList> {
    const locks = this.core.locks;
    if (locks.isLocked('sync')) return [];
    const list: SyncResultList = [];
    const duration = 30000;
    const start = Date.now();
    return await locks.lock('sync', duration, 3000)(async () => {
      for await (const result of this.syncDirty()) {
        list.push(result);
        const now = Date.now();
        if (now - start + 100 > duration) break;
      }
      return list;
    });
  }
}

export type ItemId = {collection: string[], id: string};
export type SyncResult = [block: ItemId, success: boolean, err?: Error | unknown];
export type SyncResultList = SyncResult[];
