import {AvlMap} from 'sonic-forest/lib/avl/AvlMap';
import {RpcError} from '../../../../../common/rpc/caller';
import type * as types from './types';

const tick = new Promise((resolve) => setImmediate(resolve));

export class MemoryBlock {
  constructor(
    public readonly start: types.StoreSnapshot,
    public readonly data: types.StoreBlock,
    public readonly history: types.StoreBatch[],
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

  public async getSnapshot(
    id: string,
    seq: number,
  ): Promise<{snapshot: types.StoreSnapshot; batches: types.StoreBatch[]}> {
    await tick;
    const block = this.blocks.get(id);
    if (!block) throw RpcError.notFound();
    const snapshot = block.start;
    const history = block.history;
    const length = history.length;
    const batches: types.StoreBatch[] = [];
    for (let i = 0; i < length; i++) {
      const batch = history[i];
      const seq2 = batch.seq;
      if (seq2 <= snapshot.seq) continue;
      if (seq2 > seq) break;
      batches.push(batch);
    }
    return {snapshot, batches};
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
    start: types.StoreSnapshot,
    end: types.StoreSnapshot,
    batch?: types.StoreIncomingBatch,
  ): Promise<types.StoreCreateResult> {
    const {id} = end;
    await tick;
    if (this.blocks.has(id)) throw new Error('BLOCK_EXISTS');
    const now = end.ts;
    const data = {id, snapshot: end, tip: [], ts: now, uts: now};
    const block = new MemoryBlock(start, data, []);
    this.blocks.set(id, block);
    if (batch) {
      const {cts, patches} = batch;
      if (!Array.isArray(patches)) throw new Error('NO_PATCHES');
      const batch2: types.StoreBatch = {
        seq: 0,
        ts: end.ts,
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

  public async compact(id: string, to: number, advance: types.Advance): Promise<void> {
    const block = this.blocks.get(id);
    if (!block) throw RpcError.notFound();
    const start = block.start;
    const batches = block.history;
    const length = batches.length;
    let i = 0;
    async function* iterator() {
      for (; i < length; i++) {
        const batch = batches[i];
        const seq = batch.seq;
        if (seq <= start.seq) continue;
        if (seq > to) break;
        yield batch;
      }
    }
    start.blob = await advance(start.blob, iterator());
    start.ts = Date.now();
    start.seq = to;
    batches.splice(0, i);
  }

  public async scan(id: string, min: number, max: number): Promise<types.StoreBatch[]> {
    await tick;
    const block = this.blocks.get(id);
    if (!block) return [];
    const history = block.history;
    const length = history.length;
    const list: types.StoreBatch[] = [];
    for (let i = 0; i < length; i++) {
      const batch = history[i];
      const seq = batch.seq;
      if (seq > max) break;
      if (seq >= min && seq <= max) list.push(batch);
    }
    return list;
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

  public async removeAccessedBefore(ts: number, limit = 10): Promise<void> {
    await tick;
    let cnt = 0;
    for (const [id, block] of this.blocks)
      if (block.data.uts < ts) {
        this.removeSync(id);
        cnt++;
        if (cnt >= limit) return;
      }
  }

  public async removeOldest(x: number): Promise<void> {
    const heap = new AvlMap<number, string>((a, b) => b - a);
    let first = heap.first();
    for await (const [id, block] of this.blocks.entries()) {
      const time = block.data.uts;
      if (heap.size() < x) {
        heap.set(time, id);
        continue;
      }
      if (!first) first = heap.first();
      if (first && time < first.k) {
        heap.del(first.k);
        first = undefined;
        heap.set(time, id);
      }
    }
    if (!heap.size()) return;
    for (const {v} of heap.entries()) {
      try {
        await this.remove(v);
      } catch {}
    }
  }
}
