import {MemoryStore} from './store/MemoryStore';
import {RpcError, RpcErrorCodes} from '../../../../common/rpc/caller';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import type {StoreSnapshot, StoreIncomingBatch, StoreBatch, StoreIncomingSnapshot, Store} from './store/types';
import type {Services} from '../Services';
import type {Observable} from 'rxjs';
import type {TBlockEvent, TBlockUpdateEvent, TBlockDeleteEvent, TBlockCreateEvent} from '../../routes/block/schema';

const BLOCK_TTL = 1000 * 60 * 30; // 30 minutes

const validateBatch = (batch: StoreIncomingBatch) => {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw RpcError.validation('INVALID_BATCH');
  const {patches} = batch;
  if (!Array.isArray(patches)) throw RpcError.validation('INVALID_PATCHES');
  if (patches.length > 100) throw RpcError.validation('TOO_MANY_PATCHES');
  if (patches.length < 1) throw RpcError.validation('TOO_FEW_PATCHES');
  for (const patch of patches) if (patch.blob.length > 2000) throw RpcError.validation('patch blob too large');
};

export class BlocksServices {
  constructor(
    protected readonly services: Services,
    protected readonly store: Store = new MemoryStore(),
  ) {}

  public async create(id: string, batch?: StoreIncomingBatch) {
    this.maybeGc();
    const now = Date.now();
    if (!batch) {
      const model = Model.create(void 0, SESSION.GLOBAL);
      const snapshot: StoreSnapshot = {
        id,
        seq: -1,
        blob: model.toBinary(),
        ts: now,
      };
      this.__emitNew(id);
      return await this.store.create(snapshot);
    }
    validateBatch(batch);
    const patches = batch.patches.map((p) => Patch.fromBinary(p.blob));
    const model = Model.fromPatches(patches);
    const snapshot: StoreSnapshot = {
      id,
      seq: 0,
      blob: model.toBinary(),
      ts: now,
    };
    const res = await this.store.create(snapshot, batch);
    this.__emitNew(id);
    if (res.batch) this.__emitUpd(id, res.batch);
    return res;
  }

  private __emitNew(id: string) {
    const msg: TBlockCreateEvent = ['new'];
    this.services.pubsub.publish(`__block:${id}`, msg).catch((error) => {
      // tslint:disable-next-line:no-console
      console.error('Error publishing new block', error);
    });
  }

  private __emitUpd(id: string, batch: StoreBatch) {
    const msg: TBlockUpdateEvent = ['upd', {batch}];
    this.services.pubsub.publish(`__block:${id}`, msg).catch((error) => {
      // tslint:disable-next-line:no-console
      console.error('Error publishing block patches', error);
    });
  }

  public async get(id: string) {
    const {store} = this;
    const result = await store.get(id);
    if (!result) throw RpcError.fromCode(RpcErrorCodes.NOT_FOUND);
    return result;
  }

  public async view(id: string) {
    const {store} = this;
    const result = await store.get(id);
    if (!result) throw RpcError.fromCode(RpcErrorCodes.NOT_FOUND);
    const model = Model.load(result.block.snapshot.blob);
    return model.view();
  }

  public async remove(id: string) {
    const deleted = await this.store.remove(id);
    const msg: TBlockDeleteEvent = ['del'];
    this.services.pubsub.publish(`__block:${id}`, msg).catch((error) => {
      // tslint:disable-next-line:no-console
      console.error('Error publishing block deletion', error);
    });
    return deleted;
  }

  public async scan(
    id: string,
    includeStartModel: boolean,
    offset: number | undefined,
    limit: number | undefined = 10,
  ) {
    const {store} = this;
    if (typeof offset !== 'number') offset = await store.seq(id);
    if (typeof offset !== 'number') throw RpcError.fromCode(RpcErrorCodes.NOT_FOUND);
    let min: number = 0,
      max: number = 0;
    if (!limit || Math.round(limit) !== limit) throw RpcError.badRequest('INVALID_LIMIT');
    if (limit > 0) {
      min = Number(offset) || 0;
      max = min + limit - 1;
    } else {
      max = Number(offset) || 0;
      min = max - limit + 1;
    }
    if (min < 0) {
      min = 0;
      max = Math.abs(limit);
    }
    const batches = await store.history(id, min, max);
    if (includeStartModel) {
      const model = Model.create(void 0, SESSION.GLOBAL);
      if (offset !== 0) {
        const historicBatches = await store.history(id, 0, offset - 1);
        for (const batch of historicBatches) {
          model.applyBatch(batch.patches.map((p) => Patch.fromBinary(p.blob)));
        }
      }
      return {batches, model: model.toBinary()};
    }
    return {batches};
  }

  public async edit(id: string, batch: StoreIncomingBatch, createIfNotExists: boolean) {
    if (createIfNotExists) {
      const exists = await this.store.exists(id);
      if (!exists) {
        const res = await this.create(id, batch);
        return {snapshot: res.block.snapshot, batch: res.batch};
      }
    }
    this.maybeGc();
    validateBatch(batch);
    const {store} = this;
    const get = await store.get(id);
    if (!get) throw RpcError.notFound();
    const snapshot = get.block.snapshot;
    const seq = snapshot.seq + 1;
    const model = Model.fromBinary(snapshot.blob);
    const patches = batch.patches.map((p) => Patch.fromBinary(p.blob));
    model.applyBatch(patches);
    const newSnapshot: StoreIncomingSnapshot = {
      id,
      seq,
      blob: model.toBinary(),
    };
    const res = await store.push(newSnapshot, batch);
    this.__emitUpd(id, res.batch);
    return {
      snapshot: res.snapshot,
      batch: res.batch,
    };
  }

  public listen(id: string): Observable<TBlockEvent> {
    return this.services.pubsub.listen$(`__block:${id}`) as Observable<TBlockEvent>;
  }

  public stats() {
    return this.store.stats();
  }

  private maybeGc(): void {
    if (Math.random() < 0.05)
      this.gc().catch((error) => {
        // tslint:disable-next-line:no-console
        console.error('Error running gc', error);
      });
  }

  private async gc(): Promise<void> {
    const ts = Date.now() - BLOCK_TTL;
    const {store} = this;
    await store.removeAccessedBefore(ts);
  }
}
