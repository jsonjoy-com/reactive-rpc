import {RpcError} from '../../../../common/rpc/caller';
import type * as types from './types';

const tick = new Promise((resolve) => setImmediate(resolve));

export class MemoryStore implements types.Store {
  protected readonly snapshots = new Map<string, types.StoreSnapshot>();
  protected readonly batches = new Map<string, types.StoreBatch[]>();

  public async get(id: string): Promise<types.StoreGetResult | undefined> {
    await tick;
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return;
    return {snapshot};
  }

  public async exists(id: string): Promise<boolean> {
    await tick;
    return this.snapshots.has(id);
  }

  public async seq(id: string): Promise<number | undefined> {
    await tick;
    return this.snapshots.get(id)?.seq;
  }

  public async create(snapshot: types.StoreSnapshot, batch?: types.StoreIncomingBatch): Promise<types.StoreCreateResult> {
    const {id} = snapshot;
    await tick;
    if (this.snapshots.has(id)) throw new Error('BLOCK_EXISTS');
    this.snapshots.set(id, snapshot);
    if (batch) {
      const {cts, patches} = batch;
      if (!Array.isArray(patches)) throw new Error('NO_PATCHES');
      const batch2: types.StoreBatch = {
        seq: 0,
        ts: Date.now(),
        cts,
        patches,
      };
      this.batches.set(id, [batch2]);
      return {snapshot, batch: batch2};
    }
    return {snapshot};
  }

  public async push(snapshot0: types.StoreIncomingSnapshot, batch0: types.StoreIncomingBatch): Promise<types.StorePushResult> {
    const {id, seq} = snapshot0;
    const {patches} = batch0;
    await tick;
    if (!Array.isArray(patches) || !patches.length) throw new Error('NO_PATCHES');
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw RpcError.notFound();
    if (snapshot.seq + 1 !== seq) throw new Error('PATCH_SEQ_INV');
    let existingBatches = this.batches.get(id);
    if (!existingBatches) {
      if (snapshot.seq !== -1) throw new Error('CORRUPT_BLOCK');
      existingBatches = [];
      this.batches.set(id, existingBatches);
    }
    if (existingBatches.length !== seq) throw new Error('CORRUPT_BLOCK');
    const now = Date.now();
    snapshot.seq = seq;
    snapshot.blob = snapshot0.blob;
    snapshot.uts = now;
    const batch1: types.StoreBatch = {
      seq,
      ts: now,
      cts: batch0.cts,
      patches,
    };
    existingBatches.push(batch1);
    return {snapshot, batch: batch1};
  }

  public async history(id: string, min: number, max: number): Promise<types.StoreBatch[]> {
    await tick;
    const patches = this.batches.get(id);
    if (!patches) return [];
    return patches.slice(min, max + 1);
  }

  public async remove(id: string): Promise<boolean> {
    await tick;
    return this.removeSync(id);
  }

  private removeSync(id: string): boolean {
    this.batches.delete(id);
    return this.snapshots.delete(id);
  }

  public stats(): {blocks: number; batches: number} {
    return {
      blocks: this.snapshots.size,
      batches: [...this.batches.values()].reduce((acc, v) => acc + v.length, 0),
    };
  }

  public async removeOlderThan(ts: number): Promise<void> {
    await tick;
    for (const [id, snapshot] of this.snapshots) if (snapshot.ts < ts) this.removeSync(id);
  }

  public async removeAccessedBefore(ts: number): Promise<void> {
    await tick;
    for (const [id, snapshot] of this.snapshots) if (snapshot.uts < ts) this.removeSync(id);
  }
}
