import type {RemoteBlockPatch} from "../../remote/types";
import type {ServerCrudLocalHistoryCore} from "./ServerCrudLocalHistoryCore";
import type {BlockSyncMetadata} from "./types";

const SYNC_FILE_NAME = 'sync.cbor';

export class ServerCrudLocalHistorySync {
  constructor(protected readonly core: ServerCrudLocalHistoryCore) {}

  public async push(collection: string[], id: string): Promise<boolean> {
    const core = this.core;
    const success = await this.lock<boolean>({collection, id}, async () => {
      if (!core.connected$.getValue()) return false;
      const meta = await this.getMeta(collection, id);
      const isNewBlock = meta.time < 1;
      if (isNewBlock) {
        await this.pushNewBlock(collection, id);
      } else {
        await this.pushExistingBlock(collection, id, meta.time);
      }
      await this.markTidy(collection, id);
      return true;
    });
    return success;
  }

  private async pushNewBlock(collection: string[], id: string): Promise<void> {
    const core = this.core;
    const blob = await core.read(collection, id);
    const {history} = core.decoder.decode(blob, {format: 'seq.cbor', history: true});
    const patches: RemoteBlockPatch[] = [];
    let time = 0;
    history!.patches.forEach(({v: patch}) => {
      const id = patch.getId();
      if (!id) return;
      if (id.sid === core.sid) {
        patches.push({blob: patch.toBinary()});
        time = id.time;
      }
    });
    if (!patches.length) return;
    const remoteId = [...collection, id].join('/');
    await this.core.remote.create(remoteId, patches);
    await this.putMeta(collection, id, {time, ts: Date.now()});
  }

  /**
   * @todo Unify this with `pushNewBlock`.
   */
  private async pushExistingBlock(collection: string[], id: string, syncedTime: number): Promise<void> {
    const core = this.core;
    const blob = await core.read(collection, id);
    const {history} = core.decoder.decode(blob, {format: 'seq.cbor', history: true});
    const patches: RemoteBlockPatch[] = [];
    let time = 0;
    // TODO: perf: use a binary search to find the first patch to sync.
    history!.patches.forEach(({v: patch}) => {
      const id = patch.getId();
      if (!id) return;
      if (id.sid === core.sid && id.time > syncedTime) {
        patches.push({blob: patch.toBinary()});
        time = id.time;
      }
    });
    if (!patches.length) return;
    const remoteId = [...collection, id].join('/');
    await this.core.remote.update(remoteId, patches);
    await this.putMeta(collection, id, {time, ts: Date.now()});
  }

  public async lock<T>({collection, id}: {
    collection: string[];
    id: string;
  }, fn: () => Promise<T>): Promise<T> {
    const key = ['sync', collection, id].join('/');
    const locker = this.core.locks.lock(key, 5000, 200);
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
      if (error instanceof DOMException && error.name === 'ResourceNotFound')
        return false;
      throw error;
    }
  }
}