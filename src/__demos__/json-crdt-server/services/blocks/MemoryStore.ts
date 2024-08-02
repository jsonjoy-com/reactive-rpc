import {RpcError} from '../../../../common/rpc/caller';
import type * as types from './types';

const tick = new Promise((resolve) => setImmediate(resolve));

export class MemoryBlock {
  constructor(
    public readonly data: types.StoreBlock,
    public readonly history: types.StoreBatch[]
  ) {}
}

export class MemoryStore implements types.Store {
  protected readonly blocks = new Map<string, MemoryBlock>();

  public async get(id: string): Promise<types.StoreGetResult | undefined> {
    await tick;
    const block = this.blocks.get(id);
    if (!block) return;
    return {block: block.data};
  }

  public async exists(id: string): Promise<boolean> {
    await tick;
    return this.blocks.has(id);
  }

  public async seq(id: string): Promise<number | undefined> {
    await tick;
    return this.blocks.get(id)?.data.snapshot.seq;
  }

  public async create(
    snapshot: types.StoreSnapshot,
    batch?: types.StoreIncomingBatch,
  ): Promise<types.StoreCreateResult> {
    const {id} = snapshot;
    await tick;
    if (this.blocks.has(id)) throw new Error('BLOCK_EXISTS');
    const now = snapshot.ts;
    const block = new MemoryBlock({id, snapshot, tip: [], ts: now, uts: now}, []);
    this.blocks.set(id, block);
    if (batch) {
      const {cts, patches} = batch;
      if (!Array.isArray(patches)) throw new Error('NO_PATCHES');
      const batch2: types.StoreBatch = {
        seq: 0,
        ts: snapshot.ts,
        cts,
        patches,
      };
      block.history.push(batch2);
      return {block: block.data, batch: batch2};
    }
    return {block: block.data};
  }

  public async push(
    snapshot0: types.StoreIncomingSnapshot,
    batch0: types.StoreIncomingBatch,
  ): Promise<types.StorePushResult> {
    const {id, seq} = snapshot0;
    const {patches} = batch0;
    await tick;
    if (!Array.isArray(patches) || !patches.length) throw new Error('NO_PATCHES');
    const block = this.blocks.get(id);
    if (!block) throw RpcError.notFound();
    const blockData = block.data;
    const snapshot = blockData.snapshot;
    if (snapshot.seq + 1 !== seq) throw new Error('PATCH_SEQ_INV');
    const history = block.history;
    if (history.length !== seq) throw new Error('CORRUPT_BLOCK');
    const now = Date.now();
    blockData.uts = now;
    snapshot.seq = seq;
    snapshot.ts = now;
    snapshot.blob = snapshot0.blob;
    const batch1: types.StoreBatch = {
      seq,
      ts: now,
      cts: batch0.cts,
      patches,
    };
    history.push(batch1);
    return {snapshot, batch: batch1};
  }

  public async history(id: string, min: number, max: number): Promise<types.StoreBatch[]> {
    await tick;
    const block = this.blocks.get(id);
    if (!block) return [];
    return block.history.slice(min, max + 1);
  }

  public async remove(id: string): Promise<boolean> {
    await tick;
    return this.removeSync(id);
  }

  private removeSync(id: string): boolean {
    return this.blocks.delete(id);
  }

  public stats(): {blocks: number; batches: number} {
    return {
      blocks: this.blocks.size,
      batches: [...this.blocks.values()].reduce((acc, v) => acc + v.history.length, 0),
    };
  }

  public async removeOlderThan(ts: number): Promise<void> {
    await tick;
    for (const [id, block] of this.blocks) if (block.data.ts < ts) this.removeSync(id);
  }

  public async removeAccessedBefore(ts: number): Promise<void> {
    await tick;
    for (const [id, block] of this.blocks) if (block.data.uts < ts) this.removeSync(id);
  }
}
