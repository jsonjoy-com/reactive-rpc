import {MemoryStore} from './store/MemoryStore';
import {RpcError, RpcErrorCodes} from '../../../../common/rpc/caller';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {go} from 'thingies/lib/go';
import {storageSpaceReclaimDecision} from './util';
import * as fs from 'fs';
import type {StoreSnapshot, StoreIncomingBatch, StoreBatch, StoreIncomingSnapshot, Store} from './store/types';
import type {Services} from '../Services';
import type {Observable} from 'rxjs';
import type {TBlockEvent, TBlockUpdateEvent, TBlockDeleteEvent, TBlockCreateEvent} from '../../routes/block/schema';

const validateBatch = (batch: StoreIncomingBatch) => {
  if (!batch || typeof batch !== 'object' || Array.isArray(batch)) throw RpcError.validation('INVALID_BATCH');
  const {patches} = batch;
  if (!Array.isArray(patches)) throw RpcError.validation('INVALID_PATCHES');
  if (patches.length > 100) throw RpcError.validation('TOO_MANY_PATCHES');
  if (patches.length < 1) throw RpcError.validation('TOO_FEW_PATCHES');
  for (const patch of patches) if (patch.blob.length > 2000) throw RpcError.validation('patch blob too large');
};

export interface BlocksServicesOpts {
  /**
   * How many historic batches to keep per block.
   */
  historyPerBlock: number;

  /**
   * @param seq Current block sequence number.
   * @param pushSize The total blob size of the patches bushed by the latest push.
   * @returns Whether to compact the history.
   */
  historyCompactionDecision: (seq: number, pushSize: number) => boolean;

  /**
   * As part of GC, check if we need to delete some of the oldest blocks.
   * Returns the number of oldest blocks to delete. If 0, no blocks will be
   * deleted.
   *
   * @returns The number of oldest blocks to delete.
   */
  spaceReclaimDecision?: () => Promise<number>;
}

export class BlocksServices {
  protected readonly spaceReclaimDecision: Required<BlocksServicesOpts>['spaceReclaimDecision'];

  constructor(
    protected readonly services: Services,
    protected readonly store: Store = new MemoryStore(),
    protected readonly opts: BlocksServicesOpts = {
      historyPerBlock: 10000,
      historyCompactionDecision: (seq, pushSize) => pushSize > 250 || !(seq % 100),
    },
  ) {
    this.spaceReclaimDecision = opts.spaceReclaimDecision ?? storageSpaceReclaimDecision(fs.promises);
  }

  public async create(id: string, batch?: StoreIncomingBatch) {
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
      go(() => this.gc());
      return await this.store.create(snapshot, snapshot);
    }
    validateBatch(batch);
    const model = Model.create(void 0, SESSION.GLOBAL);
    const start: StoreSnapshot = {
      id,
      seq: -1,
      ts: now,
      blob: model.toBinary(),
    };
    for (const patch of batch.patches) model.applyPatch(Patch.fromBinary(patch.blob));
    const end: StoreSnapshot = {
      id,
      seq: 0,
      ts: now,
      blob: model.toBinary(),
    };
    const res = await this.store.create(start, end, batch);
    this.__emitNew(id);
    if (res.batch) this.__emitUpd(id, res.batch);
    go(() => this.gc());
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
    includeStartSnapshot: boolean,
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
    const batches = await store.scan(id, min, max);
    if (includeStartSnapshot) {
      const snap = await store.getSnapshot(id, min - 1);
      return {
        snapshot: snap.snapshot,
        batches: snap.batches.concat(batches),
      };
    }
    return {batches};
  }

  public async pull(
    id: string,
    lastKnownSeq: number,
    create: boolean = false,
  ): Promise<{batches: StoreBatch[]; snapshot?: StoreSnapshot}> {
    const {store} = this;
    if (typeof lastKnownSeq !== 'number' || lastKnownSeq !== Math.round(lastKnownSeq) || lastKnownSeq < -1)
      throw RpcError.validation('INVALID_SEQ');
    const seq = await store.seq(id);
    if (seq === undefined) {
      if (create) {
        const res = await this.create(id);
        return {snapshot: res.block.snapshot, batches: res.batch ? [res.batch] : []};
      }
      throw RpcError.notFound();
    }
    if (lastKnownSeq > seq) throw RpcError.validation('SEQ_TOO_HIGH');
    if (lastKnownSeq === seq) return {batches: []};
    const delta = seq - lastKnownSeq;
    if (lastKnownSeq === -1 || delta > 100) return await store.getSnapshot(id, seq);
    const batches = await store.scan(id, lastKnownSeq + 1, seq);
    return {batches};
  }

  public async edit(id: string, batch: StoreIncomingBatch, createIfNotExists: boolean) {
    if (createIfNotExists) {
      const exists = await this.store.exists(id);
      if (!exists) {
        const res = await this.create(id, batch);
        if (!res.batch) throw RpcError.internal('Batch not returned');
        return {snapshot: res.block.snapshot, batch: res.batch!};
      }
    }
    validateBatch(batch);
    const {store} = this;
    const get = await store.get(id);
    if (!get) throw RpcError.notFound();
    const snapshot = get.block.snapshot;
    const seq = snapshot.seq + 1;
    const model = Model.fromBinary(snapshot.blob);
    let blobSize = 0;
    for (const {blob} of batch.patches) {
      blobSize += blob.length;
      model.applyPatch(Patch.fromBinary(blob));
    }
    const newSnapshot: StoreIncomingSnapshot = {
      id,
      seq,
      blob: model.toBinary(),
    };
    const res = await store.push(newSnapshot, batch);
    const opts = this.opts;
    if (seq > opts.historyPerBlock && store.compact && opts.historyCompactionDecision(seq, blobSize)) {
      go(() => this.compact(id, seq - opts.historyPerBlock));
    }
    this.__emitUpd(id, res.batch);
    go(() => this.gc());
    return {
      snapshot: res.snapshot,
      batch: res.batch,
    };
  }

  protected async compact(id: string, to: number) {
    const store = this.store;
    if (!store.compact) return;
    await store.compact!(id, to, async (blob, iterator) => {
      const model = Model.fromBinary(blob);
      for await (const batch of iterator)
        for (const patch of batch.patches) model.applyPatch(Patch.fromBinary(patch.blob));
      return model.toBinary();
    });
  }

  public listen(id: string): Observable<TBlockEvent> {
    return this.services.pubsub.listen$(`__block:${id}`) as Observable<TBlockEvent>;
  }

  public stats() {
    return this.store.stats();
  }

  protected async gc(): Promise<void> {
    const blocksToDelete = await this.spaceReclaimDecision();
    if (blocksToDelete <= 0) return;
    await this.store.removeOldest(blocksToDelete);
  }
}
