import {Model, Patch} from 'json-joy/lib/json-crdt';
import type * as types from './types';
import {RpcError} from '../../../../common/rpc/caller';

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

  public async create(id: string, model: types.StoreSnapshot, {cts, patches}: types.StoreIncomingBatch): Promise<void> {
    await tick;
    if (!Array.isArray(patches)) throw new Error('NO_PATCHES');
    if (this.snapshots.has(id)) throw new Error('BLOCK_EXISTS');
    const batch: types.StoreBatch = {
      seq: 0,
      ts: Date.now(),
      cts,
      patches,
    };
    this.snapshots.set(id, model);
    this.batches.set(id, [batch]);
  }

  public async edit(id: string, {seq = 0, cts, patches}: types.StoreIncomingBatch): Promise<types.StoreApplyResult> {
    await tick;
    if (!Array.isArray(patches) || !patches.length) throw new Error('NO_PATCHES');
    const snapshot = this.snapshots.get(id);
    const existingBatches = this.batches.get(id);
    if (!snapshot || !existingBatches) throw RpcError.notFound();
    if (snapshot.seq + 1 < seq) throw new Error('PATCH_SEQ_TOO_HIGH');
    const model = Model.fromBinary(snapshot.blob);
    for (const patch of patches) {
      model.applyPatch(Patch.fromBinary(patch.blob));
    }
    const batch: types.StoreBatch = {
      seq: snapshot.seq + 1,
      ts: Date.now(),
      cts,
      patches,
    };
    snapshot.seq = batch.seq;
    snapshot.blob = model.toBinary();
    snapshot.uts = batch.ts;
    existingBatches.push(batch);
    return {snapshot, batch};
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
    this.snapshots.delete(id);
    return this.batches.delete(id);
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
