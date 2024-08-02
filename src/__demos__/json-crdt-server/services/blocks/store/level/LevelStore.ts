import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Mutex} from '../../../../../../util/Mutex';
import {RpcError} from '../../../../../../common/rpc/caller';
import type {AbstractLevel} from 'abstract-level';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type * as types from '../types';

type BinStrLevel = AbstractLevel<any, string, Uint8Array>;

export class LevelStore implements types.Store {
  constructor(
    protected readonly kv: BinStrLevel,
    protected readonly codec: JsonValueCodec = new CborJsonValueCodec(new Writer(1024 * 16)),
    protected readonly mutex: Mutex = new Mutex(),
  ) {}

  protected keyBase(id: string) {
    return 'bl!' + id + '!';
  }

  protected snapshotKey(id: string) {
    return this.keyBase(id) + 'block';
  }

  protected batchBase(id: string) {
    return this.keyBase(id) + 'batch!';
  }

  protected batchKey(id: string, seq: number) {
    const seqFormatted = seq.toString(36).padStart(6, '0');
    return this.batchBase(id) + seqFormatted;
  }

  public async get(id: string): Promise<types.StoreGetResult | undefined> {
    const key = this.snapshotKey(id);
    try {
      const blob = await this.kv.get(key);
      if (!blob) return;
      const block = this.codec.decoder.decode(blob) as types.StoreBlock;
      return {block};
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'LEVEL_NOT_FOUND') return;
      throw error;
    }
  }

  public async exists(id: string): Promise<boolean> {
    const key = this.snapshotKey(id);
    const existing = await this.kv.keys({gte: key, lte: key, limit: 1}).all();
    return existing && existing.length > 0;
  }

  public async seq(id: string): Promise<number | undefined> {
    return await this.mutex.acquire(id, () => this.seqUnsafe(id));
  }

  protected async seqUnsafe(id: string): Promise<number | undefined> {
    const base = this.batchBase(id);
    const keys = await this.kv.keys({lt: base + '~', limit: 1, reverse: true}).all();
    if (!keys || keys.length < 1) return;
    const key = keys[0];
    const seq = +key.slice(base.length);
    return seq;
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
    const key = this.snapshotKey(id);
    const now = snapshot.ts;
    return await this.mutex.acquire(id, async () => {
      const existing = await this.kv.keys({gte: key, lte: key, limit: 1}).all();
      if (existing && existing.length > 0) throw new Error('BLOCK_EXISTS');
      const block: types.StoreBlock = {id, snapshot, tip: [], ts: now, uts: now};
      const blob = this.codec.encoder.encode(block);
      await this.kv.put(key, blob);
      if (batch) {
        const {cts, patches} = batch;
        const batch2: types.StoreBatch = {
          seq: 0,
          ts: snapshot.ts,
          cts,
          patches,
        };
        const batchBlob = this.codec.encoder.encode(batch2);
        const batchKey = this.batchKey(id, 0);
        await this.kv.put(batchKey, batchBlob);
        return {block, batch} as types.StoreCreateResult;
      }
      return {block};
    });
  }

  public async push(
    snapshot0: types.StoreIncomingSnapshot,
    batch0: types.StoreIncomingBatch,
  ): Promise<types.StorePushResult> {
    const {id, seq} = snapshot0;
    const {patches} = batch0;
    const key = this.snapshotKey(id);
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
      const batchKey = this.batchKey(id, 0);
      await this.kv.put(batchKey, batchBlob);
      return {snapshot, batch: batch1};
    });
  }

  public async history(id: string, min: number, max: number): Promise<types.StoreBatch[]> {
    const from = this.batchKey(id, min);
    const to = this.batchKey(id, max);
    const list: types.StoreBatch[] = [];
    console.log(from, to);
    const decoder = this.codec.decoder;
    for await (const blob of this.kv.values({gte: from, lte: to})) {
      const batch = decoder.decode(blob) as types.StoreBatch;
      list.push(batch);
    }
    console.log(list);
    return list;
  }

  public async remove(id: string): Promise<boolean> {
    const exists = await this.exists(id);
    if (!exists) return false;
    const base = this.keyBase(id);
    return await this.mutex.acquire(id, async () => {
      await this.kv.clear({
        gte: base,
        lte: base + '~',
      });
      return true;
    });
  }

  public stats(): {blocks: number; batches: number} {
    return {blocks: 0, batches: 0};
  }

  public async removeAccessedBefore(ts: number): Promise<void> {
    console.warn('removeAccessedBefore not implemented');
  }
}
