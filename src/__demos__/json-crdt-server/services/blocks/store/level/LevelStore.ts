import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Mutex} from '../../../../../../util/Mutex';
import {RpcError} from '../../../../../../common/rpc/caller';
import type {AbstractBatchOperation, AbstractLevel} from 'abstract-level';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type * as types from '../types';

type BinStrLevel = AbstractLevel<any, string, Uint8Array>;
type BinStrLevelOperation = AbstractBatchOperation<BinStrLevel, string, Uint8Array>;

export class LevelStore implements types.Store {
  constructor(
    protected readonly kv: BinStrLevel,
    protected readonly codec: JsonValueCodec = new CborJsonValueCodec(new Writer(1024 * 16)),
    protected readonly mutex: Mutex = new Mutex(),
    protected readonly history: number = 10000,
  ) {}

  protected keyBase(id: string) {
    return 'b!' + id + '!';
  }

  protected endKey(id: string) {
    return this.keyBase(id) + 'e';
  }

  protected startKey(id: string) {
    return this.keyBase(id) + 's';
  }

  protected batchBase(id: string) {
    return this.keyBase(id) + 'b!';
  }

  protected batchKey(id: string, seq: number) {
    const seqFormatted = seq.toString(36).padStart(6, '0');
    return this.batchBase(id) + seqFormatted;
  }

  protected touchKey(id: string) {
    return 'u!' + id + '!';
  }

  public async get(id: string): Promise<types.StoreGetResult | undefined> {
    const key = this.endKey(id);
    try {
      const blob = await this.kv.get(key);
      if (!blob) return;
      const block = this.codec.decoder.decode(blob) as types.StoreBlock;
      return {block};
    } catch (error) {
      if (error && typeof error === 'object' && (error as any).code === 'LEVEL_NOT_FOUND') return;
      throw error;
    }
  }

  public async exists(id: string): Promise<boolean> {
    const key = this.endKey(id);
    const existing = await this.kv.keys({gte: key, lte: key, limit: 1}).all();
    return existing && existing.length > 0;
  }

  public async seq(id: string): Promise<number | undefined> {
    return await this.mutex.acquire(id, async () => {
      const base = this.batchBase(id);
      const keys = await this.kv.keys({lt: base + '~', limit: 1, reverse: true}).all();
      if (!keys || keys.length < 1) return;
      const key = keys[0];
      const seq = +key.slice(base.length);
      return seq;
    });
  }

  public async create(
    snapshot: types.StoreSnapshot,
    batch?: types.StoreIncomingBatch,
  ): Promise<types.StoreCreateResult> {
    if (batch) {
      const {patches} = batch;
      if (!Array.isArray(patches) || patches.length < 1) throw new Error('NO_PATCHES');
    }
    const {id} = snapshot;
    const key = this.endKey(id);
    const now = snapshot.ts;
    const encoder = this.codec.encoder;
    return await this.mutex.acquire(id, async () => {
      const existing = await this.kv.keys({gte: key, lte: key, limit: 1}).all();
      if (existing && existing.length > 0) throw new Error('BLOCK_EXISTS');
      const block: types.StoreBlock = {id, snapshot, tip: [], ts: now, uts: now};
      const blob = encoder.encode(block);
      const ops: BinStrLevelOperation[] = [
        {type: 'put', key, value: blob}
      ];
      const response: types.StoreCreateResult = {block};
      if (batch) {
        const {cts, patches} = batch;
        const batch2: types.StoreBatch = {
          seq: 0,
          ts: snapshot.ts,
          cts,
          patches,
        };
        const batchBlob = encoder.encode(batch2);
        const batchKey = this.batchKey(id, 0);
        ops.push({type: 'put', key: batchKey, value: batchBlob});
        response.batch = batch2;
      }
      await this.kv.batch(ops);
      this.touch(id, now).catch(() => {});
      return response;
    });
  }

  public async push(
    snapshot0: types.StoreIncomingSnapshot,
    batch0: types.StoreIncomingBatch,
  ): Promise<types.StorePushResult> {
    const {id, seq} = snapshot0;
    const {patches} = batch0;
    const key = this.endKey(id);
    if (!Array.isArray(patches) || !patches.length) throw new Error('NO_PATCHES');
    return await this.mutex.acquire(id, async () => {
      const block = await this.get(id);
      if (!block) throw RpcError.notFound();
      const blockData = block.block;
      const snapshot = blockData.snapshot;
      if (snapshot.seq + 1 !== seq) throw new Error('PATCH_SEQ_INV');
      const now = Date.now();
      blockData.uts = now;
      snapshot.seq = seq;
      snapshot.ts = now;
      snapshot.blob = snapshot0.blob;
      const encoder = this.codec.encoder;
      const blob = encoder.encode(blockData);
      await this.kv.put(key, blob);
      const batch1: types.StoreBatch = {
        seq,
        ts: now,
        cts: batch0.cts,
        patches,
      };
      const batchBlob = encoder.encode(batch1);
      const batchKey = this.batchKey(id, seq);
      await this.kv.put(batchKey, batchBlob);
      this.touch(id, now).catch(() => {});
      return {snapshot, batch: batch1};
    });
  }

  public async scan(id: string, min: number, max: number): Promise<types.StoreBatch[]> {
    const from = this.batchKey(id, min);
    const to = this.batchKey(id, max);
    const list: types.StoreBatch[] = [];
    const decoder = this.codec.decoder;
    for await (const blob of this.kv.values({gte: from, lte: to})) {
      const batch = decoder.decode(blob) as types.StoreBatch;
      list.push(batch);
    }
    return list;
  }

  public async remove(id: string): Promise<boolean> {
    const exists = await this.exists(id);
    if (!exists) return false;
    const base = this.keyBase(id);
    const success = await this.mutex.acquire(id, async () => {
      await this.kv.clear({
        gte: base,
        lte: base + '~',
      });
      return true;
    });
    const touchKey = this.touchKey(id);
    this.kv.del(touchKey).catch(() => {});
    return success;
  }

  public stats(): {blocks: number; batches: number} {
    return {blocks: 0, batches: 0};
  }

  public async removeAccessedBefore(ts: number, limit: number = 10): Promise<void> {
    const from = this.touchKey('');
    const to = from + '~';
    const decoder = this.codec.decoder;
    let cnt = 0;
    for await (const [key, blob] of this.kv.iterator({gte: from, lte: to})) {
      const value = Number(decoder.decode(blob));
      if (ts >= value) continue;
      cnt++;
      const id = key.slice(from.length);
      this.remove(id).catch(() => {});
      if (cnt >= limit) return;
    }
  }

  protected async touch(id: string, time: number): Promise<void> {
    const key = this.touchKey(id);
    const blob = this.codec.encoder.encode(time);
    await this.kv.put(key, blob);
  }
}
