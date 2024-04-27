import type {RemoteBlockPatch} from "../../remote/types";
import type {ServerCrudLocalHistoryCore} from "./ServerCrudLocalHistoryCore";
import type {BlockSyncMetadata} from "./types";

const SYNC_FILE_NAME = 'sync.cbor';

export class ServerCrudLocalHistorySync {
  constructor(protected readonly core: ServerCrudLocalHistoryCore) {}

  protected async push(collection: string[], id: string): Promise<void> {
    const deps = this.core;
    await this.lock({collection, id}, async () => {
      if (!this.core.connected$.getValue()) return;
      const meta = await this.getMeta(collection, id);
      const isNewBlock = meta.time < 1;
      if (isNewBlock) {
        const blob = await this.core.read(collection, id);
        const {history} = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
        const patches: RemoteBlockPatch[] = [];
        let time = 0;
        history!.patches.forEach(({v: patch}) => {
          const id = patch.getId();
          if (!id) return;
          if (id.sid === deps.sid) {
            patches.push({blob: patch.toBinary()});
            time = id.time;
          }
        });
        if (!patches.length) return;
        const remoteId = [...collection, id].join('/');
        await this.core.remote.create(remoteId, patches);
        await this.putMeta(collection, id, {time, ts: Date.now()});
      } else {
        // TODO: Implement sync with remote.
      }
      await this.core.markTidy(collection, id);
    });
  }

  public async lock({collection, id}: {
    collection: string[];
    id: string;
  }, fn: () => Promise<void>): Promise<void> {
    const key = ['sync', collection, id].join('/');
    const locker = this.core.locks.lock(key, 5000, 200);
    await locker(fn);
  }

  protected async getMeta(collection: string[], id: string): Promise<BlockSyncMetadata> {
    const deps = this.core;
    const crudCollection = this.core.crudCollection(collection, id);
    const meta = await deps.crud.get(crudCollection, SYNC_FILE_NAME);
    try {
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
    await deps.crud.put([...collection, id], SYNC_FILE_NAME, blob);
  }
}
