import {BehaviorSubject, type Subscription} from 'rxjs';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {once} from 'thingies/lib/once';
import {timeout} from 'thingies/lib/timeout';
import type {ServerHistory, ServerPatch} from '../../remote/types';
import type {BlockId, LocalRepoSyncRequest, LocalRepoSyncResponse} from '../types';
import type {BinStrLevel, BinStrLevelOperation, BlockMetaValue, BlockModelMetadata, BlockModelValue, LocalBatch, SyncResult} from './types';
import type {CrudLocalRepoCipher} from './types';
import type {Locks} from 'thingies/lib/Locks';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';

const enum BlockKeyFragment {
  /**
   * The root of the block repository.
   * 
   * ```
   * b!<collection>!<id>!
   * ```
   */
  BlockRepoRoot = 'b',

  /**
   * The root of the key-space where items are marked as "dirty" and need sync.
   * 
   * ```
   * s!<collection>!<id>
   * ```
   */
  SyncRoot = 's',

  /**
   * The metadata of the block.
   * 
   * ```
   * b!<collection>!<id>!x
   * ```
   */
  Metadata = 'x',

  /**
   * The state of the latest known server-side model.
   * 
   * ```
   * b!<collection>!<id>!m
   * ```
   */
  Model = 'm',

  /**
   * List of frontier patches.
   * 
   * ```
   * b!<collection>!<id>!f!<time>
   * ```
   */
  Frontier = 'f',

  /**
   * List of batches verified by the server.
   * 
   * ```
   * b!<collection>!<id>!h!<seq>
   * ```
   */
  History = 'h',
}

export interface LevelLocalRepoCoreOpts {
  /**
   * Session ID of the user on this device. The same session ID is reused across
   * all tabs.
   */
  readonly sid: number;

  /**
   * Local persistance LevelDB API.
   */
  readonly kv: BinStrLevel;

  /**
   * Optional content encryption/decryption API.
   */
  readonly cipher?: CrudLocalRepoCipher;
  
  /**
   * Cross-tab locking API.
   */
  readonly locks: Locks;

  /**
   * Optional observable that emits `true` when the device is connected to the
   * server and `false` when it's not.
   */
  readonly connected$?: BehaviorSubject<boolean>;

  /**
   * RPC API for communication with the server.
   */
  readonly rpc: ServerHistory;

  /**
   * Number of milliseconds after which remote calls are considered timed out.
   */
  readonly remoteTimeout?: number;

  /**
   * Minimum backoff time in milliseconds for the sync loop.
   */
  readonly syncLoopMinBackoff?: number;

  /**
   * Maximum backoff time in milliseconds for the sync loop.
   */
  readonly syncLoopMaxBackoff?: number;
}

export class LevelLocalRepoCore {
  readonly kv: BinStrLevel;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly connected$: BehaviorSubject<boolean>;
  protected readonly cipher?: CrudLocalRepoCipher;
  protected readonly codec: JsonValueCodec = new CborJsonValueCodec(new Writer(1024 * 16));

  constructor(protected readonly opts: LevelLocalRepoCoreOpts) {
    this.kv = opts.kv;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
    this.cipher = opts.cipher;
  }


  private _conSub: Subscription | undefined = undefined;

  @once
  public start(): void {
    this._conSub = this.connected$.subscribe((connected) => {
      if (connected) {
        this.syncAll().catch(() => {});
      } else {
      }
    });
  }

  @once
  public stop(): void {
    this._conSub?.unsubscribe();
  }

  public async encrypt(blob: Uint8Array, zip: boolean): Promise<Uint8Array> {
    // if (zip) blob = await gzip(blob);
    // if (this.cipher) blob = await this.cipher.encrypt(blob);
    return blob;
  }

  public async decrypt(blob: Uint8Array, zip: boolean): Promise<Uint8Array> {
    // if (this.cipher) blob = await this.cipher.decrypt(blob);
    // if (zip) blob = await ungzip(blob);
    return blob;
  }

  /** @todo Encrypt collection and key. */
  public async blockKeyBase(id: BlockId): Promise<string> {
    return BlockKeyFragment.BlockRepoRoot + '!' + id.join('!') + '!';
  }

  public frontierKeyBase(blockKeyBase: string): string {
    return blockKeyBase + BlockKeyFragment.Frontier + '!';
  }

  public frontierKey(blockKeyBase: string, time: number): string {
    const timeFormatted = time.toString(36).padStart(8, '0');
    return this.frontierKeyBase(blockKeyBase) + timeFormatted;
  }

  public histKeyBase(blockKeyBase: string): string {
    return blockKeyBase + BlockKeyFragment.History + '!';
  }

  public batchKey(blockKeyBase: string, seq: number): string {
    const seqFormatted = seq.toString(36).padStart(8, '0');
    return this.histKeyBase(blockKeyBase) + seqFormatted;
  }

  public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
    if (req.batch) {
      const first = req.batch[0];
      const time = first.getId()?.time;
      const isNewDocument = time === 1;
      if (isNewDocument) {
        try {
          return await this.create(req.id, req.batch);
        } catch (error) {
          if (error instanceof Error && error.message === 'EXISTS') {
            return await this.rebaseAndMerge(req.id, req.batch);
          }
          throw error;
        }
      } else {
        throw new Error('not implemented');
        // return await this.update(req.col, req.id, req.batch);
      }
    } else if (!req.cursor && !req.batch) {
      const model = await this.read(req.id);
      return {model};
    } else if (req.cursor && !req.batch) {
      throw new Error('Not implemented: catch up');
    } else {
      throw new Error('INV_SYNC');
    }
  }

  public async create(id: BlockId, patches?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    if (!patches || !patches.length) throw new Error('EMPTY_BATCH');
    const keyBase = await this.blockKeyBase(id);
    const metaKey = keyBase + BlockKeyFragment.Metadata;
    const meta: BlockMetaValue = {
      time: -1,
      ts: 0,
    };
    const blob = await this.encrypt(this.codec.encoder.encode(meta), false);
    const writeMetaOp: BinStrLevelOperation = {
      type: 'put',
      key: metaKey,
      value: blob,
    };
    const ops: BinStrLevelOperation[] = [
      writeMetaOp,
    ];
    if (patches && patches.length) {
      for (const patch of patches) {
        const patchId = patch.getId();
        if (!patchId) throw new Error('PATCH_ID_MISSING');
        const patchKey = this.frontierKey(keyBase, patchId.time);
        const op: BinStrLevelOperation = {
          type: 'put',
          key: patchKey,
          value: patch.toBinary(),
        };
        ops.push(op);
      }
    }
    await this.lockBlock(keyBase, async () => {
      const exists = (await this.kv.keys({gte: metaKey, lte: metaKey, limit: 1}).all()).length > 0;
      if (exists) throw new Error('EXISTS');
      await this.kv.batch(ops);
    });
    const remote = this.markDirtyAndSync(id).then(() => {});
    remote.catch(() => {});
    return {remote};
  }

  public async rebaseAndMerge(id: BlockId, patches?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    const keyBase = await this.blockKeyBase(id);
    if (!patches || !patches.length) throw new Error('EMPTY_BATCH');
    await this.lockBlock(keyBase, async () => {
      let nextTick = 0;
      const tip = await this.readFrontierTip(keyBase);
      if (tip) {
        const patchTime = tip.getId()?.time ?? 0;
        const patchSpan = tip.span();
        nextTick = patchTime + patchSpan + 1;
      }
      const ops: BinStrLevelOperation[] = [];
      const sid = this.sid;
      const length = patches.length;
      for (let i = 0; i < length; i++) {
        const patch = patches[i];
        const patchId = patch.getId();
        if (!patchId) throw new Error('PATCH_ID_MISSING');
        const isSchemaPatch = patchId.sid === SESSION.GLOBAL && patchId.time === 1;
        if (isSchemaPatch) continue;
        let rebased = patch;
        if (patchId.sid === sid) {
          rebased = patch.rebase(nextTick);
          nextTick = rebased.getId()!.time + rebased.span();
        }
        const patchKey = this.frontierKey(keyBase, rebased.getId()!.time);
        const op: BinStrLevelOperation = {
          type: 'put',
          key: patchKey,
          value: rebased.toBinary(),
        };
        ops.push(op);
      }
      await this.kv.batch(ops);
    });
    const remote = this.markDirtyAndSync(id).then(() => {});
    remote.catch(() => {});
    return {remote};
  }

  protected async readMeta(keyBase: string): Promise<BlockMetaValue> {
    const metaKey = keyBase + BlockKeyFragment.Metadata;
    const blob = await this.kv.get(metaKey);
    const meta = this.codec.decoder.decode(blob) as BlockMetaValue;
    return meta;
  }

  public async read(id: BlockId): Promise<Model> {
    const keyBase = await this.blockKeyBase(id);
    const [[model], frontier] = await Promise.all([this.readModel(keyBase), this.readFrontier0(keyBase)]);
    model.applyBatch(frontier);
    return model;
  }

  public async readModel(keyBase: string): Promise<[model: Model, meta: BlockModelMetadata]> {
    const modelKey = keyBase + BlockKeyFragment.Model;
    try {
      const value = await this.kv.get(modelKey);
      const decoded = await this.decrypt(value, true);
      const tuple = this.codec.decoder.decode(decoded) as BlockModelValue;
      const [meta, blob] = tuple;
      const model = Model.load(blob, this.sid);
      return [model, meta];
    } catch (error) {
      if (!!error && typeof error === 'object' && (error as any).code === 'LEVEL_NOT_FOUND')
          return [Model.create(void 0, this.sid), [-1]]
      throw error;
    }
  }

  public async *readFrontierBlobs0(keyBase: string) {
    const gt = this.frontierKeyBase(keyBase);
    const lt = gt + '~';
    for await (const [key, buf] of this.kv.iterator({gt, lt})) {
      /** @todo Remove this conversion once json-pack supports Buffers. */
      const uint8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      yield [key, uint8] as const;
    }
  }

  public async readFrontier0(keyBase: string): Promise<Patch[]> {
    const patches: Patch[] = [];
    for await (const [, blob] of this.readFrontierBlobs0(keyBase)) {
      const patch = Patch.fromBinary(blob);
      patches.push(patch);
    }
    return patches;
  }

  public async readFrontierTip(keyBase: string): Promise<Patch | undefined> {
    const frontierBase = this.frontierKeyBase(keyBase);
    const lte = frontierBase + `~`;
    for await (const blob of this.kv.values({lte, limit: 1, reverse: true})) return Patch.fromBinary(blob);
    return;
  }

  protected async lockBlock(keyBase: string, fn: () => Promise<void>): Promise<void> {
    await this.locks.lock(keyBase, 500, 500)(fn);
  }

  // ---------------------------------------------------------- Synchronization

  protected async markDirty(id: BlockId): Promise<void> {
    const key = BlockKeyFragment.SyncRoot + '!' + id.join('!');
    const blob = this.codec.encoder.encode(Date.now());
    await this.kv.put(key, blob);
  }

  protected async markDirtyAndSync(id: BlockId): Promise<boolean> {
    this.markDirty(id).catch(() => {});
    return await this.push(id);
  }

  public async markTidy(id: BlockId): Promise<void> {
    const key = BlockKeyFragment.SyncRoot + '!' + id.join('!');
    await this.kv.del(key);
  }

  protected remoteTimeout(): number {
    return this.opts.remoteTimeout ?? 5000;
  }

  protected async push(id: BlockId): Promise<boolean> {
    if (!this.connected$.getValue()) throw new Error('DISCONNECTED');
    const keyBase = await this.blockKeyBase(id);
    const remote = this.opts.rpc;
    const remoteId = id.join('/');
    const patches: ServerPatch[] = [];
    const syncMarkerKey = BlockKeyFragment.SyncRoot + '!' + id.join('!');
    const ops: BinStrLevelOperation[] = [{type: 'del', key: syncMarkerKey}];
    for await (const [key, blob] of this.readFrontierBlobs0(keyBase)) {
      ops.push({type: 'del', key});
      patches.push({blob});
    }
    if (!patches) return false;
    return await this.lockForSync(id, async () => {
      // TODO: handle case when this times out, but actually succeeds, so on re-sync it handles the case when the block is already synced.
      return await timeout(this.remoteTimeout(), async () => {
        await this.lockBlock(keyBase, async () => {
          const [[model, modelMeta], meta] = await Promise.all([
            this.readModel(keyBase),
            this.readMeta(keyBase),
          ]);
          const lastKnownSeq = modelMeta[0];
          const response = await remote.update(remoteId, {patches}, lastKnownSeq);
          const encoder = this.codec.encoder;
          const seq = response.batch.seq;
          // TODO: if seq has a jump, we need to pull the latest state from the server.
          // TODO: store batches, if history tracking is enabled. If not enabled, store anyways, for cross-tab sync.
          // TODO: remove old batches, if history tracking is not enabled.
          const batch: LocalBatch = {
            seq,
            ts: response.batch.ts,
            patches,
          };
          ops.push({
            type: 'put',
            key: this.batchKey(keyBase, seq),
            value: encoder.encode(batch),
          });
          for (const patch of patches) model.applyPatch(Patch.fromBinary(patch.blob));
          meta.time = model.clock.time - 1;
          meta.ts = Date.now();
          ops.push({
            type: 'put',
            key: keyBase + BlockKeyFragment.Metadata,
            value: encoder.encode(meta),
          });
          modelMeta[0] = seq;
          const modelTuple: BlockModelValue = [modelMeta, model.toBinary()];
          const modelValue = encoder.encode(modelTuple);
          const modelBlob = await this.encrypt(modelValue, true);
          ops.push({
            type: 'put',
            key: keyBase + BlockKeyFragment.Model,
            value: modelBlob,
          });
          await this.kv.batch(ops);
        });
        return true;
      });
    });
  }

  /**
   * Locks a specific block for synchronization.
   */
  private async lockForSync<T>(id: BlockId, fn: () => Promise<T>): Promise<T> {
    const key = 'sync/' + id.join('/');
    const locker = this.locks.lock(key, this.remoteTimeout() + 200, 200);
    return await locker<T>(fn);
  }

  // protected async putMeta(collection: string[], id: string, meta: BlockSyncMetadata): Promise<void> {
  //   const deps = this.core;
  //   const blob = deps.cborEncoder.encode(meta);
  //   await deps.crud.put(['sync', 'state', ...collection, id], SYNC_FILE_NAME, blob);
  // }

  public async isDirty(collection: string[], id: string): Promise<boolean> {
    throw new Error('not implemented');
    // const dir = ['sync', 'dirty', ...collection];
    // try {
    //   await this.core.crud.info(dir, id);
    //   return true;
    // } catch (error) {
    //   if (error instanceof DOMException && error.name === 'ResourceNotFound') return false;
    //   throw error;
    // }
  }

  protected async *listDirty(collection: string[] = ['sync', 'dirty']): AsyncIterableIterator<BlockId> {
    throw new Error('not implemented');
    // for await (const entry of this.core.crud.scan(collection)) {
    //   if (entry.type === 'collection') yield* this.listDirty([...collection, entry.id]);
    //   else yield {collection, id: entry.id};
    // }
  }

  protected async *syncDirty(): AsyncIterableIterator<SyncResult> {
    // for await (const block of this.listDirty()) {
    //   const {
    //     collection: [_sync, _dirty, ...collection],
    //     id,
    //   } = block;
    //   try {
    //     const success = await this.sync(collection, id);
    //     yield [block, success];
    //   } catch (error) {
    //     yield [block, false, error];
    //   }
    // }
  }

  public async syncAll(): Promise<SyncResult[]> {
    throw new Error('not implemented');
    // const locks = this.locks;
    // if (locks.isLocked('sync')) return [];
    // const list: SyncResultList = [];
    // const duration = 30000;
    // const start = Date.now();
    // return await locks.lock(
    //   'sync',
    //   duration,
    //   3000,
    // )(async () => {
    //   for await (const result of this.syncDirty()) {
    //     if (!this.core.connected$.getValue()) return [];
    //     list.push(result);
    //     const now = Date.now();
    //     if (now - start + 100 > duration) break;
    //   }
    //   return list;
    // });
  }
}
