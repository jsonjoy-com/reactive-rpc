import {BehaviorSubject, Observable, Subject, type Subscription} from 'rxjs';
import {filter, finalize, map, switchMap} from 'rxjs/operators';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {deepEqual} from 'json-joy/lib/json-equal/deepEqual';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {once} from 'thingies/lib/once';
import {timeout} from 'thingies/lib/timeout';
import {pubsub} from '../../pubsub';
import type {RemoteBatch, ServerHistory, ServerPatch} from '../../remote/types';
import type {BlockId, LocalRepoChangeEvent, LocalRepoSyncRequest, LocalRepoSyncResponse} from '../types';
import type {BinStrLevel, BinStrLevelOperation, BlockMetaValue, BlockModelMetadata, BlockModelValue, LevelLocalRepoLocalRebase, LevelLocalRepoPubSub, LevelLocalRepoRemotePull, LocalBatch, SyncResult} from './types';
import type {CrudLocalRepoCipher} from './types';
import type {Locks} from 'thingies/lib/Locks';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';

/**
 * @todo
 * 
 * 1. Implement pull loop, when WebSocket subscription cannot be established.
 */

const enum Defaults {
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
  Batches = 'h',

  /**
   * List of snapshots.
   * 
   * ```
   * b!<collection>!<id>!s!<seq>
   * ```
   */
  Snapshots = 's',

  /**
   * The default length of the history, if `hist` metadata property not
   * specified.
   */
  HistoryLength = 100,
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
   * Event bus.
   */
  readonly pubsub?: LevelLocalRepoPubSub;

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
  protected readonly pubsub: LevelLocalRepoPubSub;
  protected readonly cipher?: CrudLocalRepoCipher;
  protected readonly codec: JsonValueCodec = new CborJsonValueCodec(new Writer(1024 * 16));

  constructor(protected readonly opts: LevelLocalRepoCoreOpts) {
    this.kv = opts.kv;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
    this.pubsub = opts.pubsub ?? pubsub('level-local-repo');
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

  protected async encrypt(blob: Uint8Array, zip: boolean): Promise<Uint8Array> {
    // if (zip) blob = await gzip(blob);
    // if (this.cipher) blob = await this.cipher.encrypt(blob);
    return blob;
  }

  protected async decrypt(blob: Uint8Array, zip: boolean): Promise<Uint8Array> {
    // if (this.cipher) blob = await this.cipher.decrypt(blob);
    // if (zip) blob = await ungzip(blob);
    return blob;
  }

  protected async encode(value: unknown, zip: boolean): Promise<Uint8Array> {
    const encoded = this.codec.encoder.encode(value);
    const encrypted = await this.encrypt(encoded, zip);
    return encrypted;
  }

  protected async decode(blob: Uint8Array, zip: boolean): Promise<unknown> {
    const decrypted = await this.decrypt(blob, zip);
    const decoded = this.codec.decoder.decode(decrypted);
    return decoded;
  }

  /** @todo Encrypt collection and key. */
  public async blockKeyBase(id: BlockId): Promise<string> {
    return Defaults.BlockRepoRoot + '!' + id.join('!') + '!';
  }

  public frontierKeyBase(blockKeyBase: string): string {
    return blockKeyBase + Defaults.Frontier + '!';
  }

  public frontierKey(blockKeyBase: string, time: number): string {
    const timeFormatted = time.toString(36).padStart(8, '0');
    return this.frontierKeyBase(blockKeyBase) + timeFormatted;
  }

  public batchKeyBase(blockKeyBase: string): string {
    return blockKeyBase + Defaults.Batches + '!';
  }

  public batchKey(blockKeyBase: string, seq: number): string {
    const seqFormatted = seq.toString(36).padStart(8, '0');
    return this.batchKeyBase(blockKeyBase) + seqFormatted;
  }

  public snapshotKeyBase(blockKeyBase: string): string {
    return blockKeyBase + Defaults.Snapshots + '!';
  }

  public snapshotKey(blockKeyBase: string, seq: number): string {
    const seqFormatted = seq.toString(36).padStart(8, '0');
    return this.snapshotKeyBase(blockKeyBase) + seqFormatted;
  }

  public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
    if (req.patches) {
      const first = req.patches[0];
      const time = first.getId()?.time;
      const isNewDocument = time === 1;
      if (isNewDocument) {
        try {
          return await this.create(req.id, req.patches);
        } catch (error) {
          if (error instanceof Error && error.message === 'EXISTS') {
            return await this.rebaseAndMerge(req.id, req.patches);
          }
          throw error;
        }
      } else {
        throw new Error('not implemented');
        // return await this.update(req.col, req.id, req.batch);
      }
    } else if (!req.cursor && !req.patches) {
      try {
        return await this.read(req.id);
      } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
          return await this.create(req.id);
        }
        throw error;
      }
    } else if (req.cursor && !req.patches) {
      throw new Error('Not implemented: catch up');
    } else {
      throw new Error('INV_SYNC');
    }
  }

  protected async _exists(keyBase: string): Promise<boolean> {
    const metaKey = keyBase + Defaults.Metadata;
    const exists = (await this.kv.keys({gte: metaKey, lte: metaKey, limit: 1}).all()).length > 0;
    return exists;
  }

  public async create(id: BlockId, patches?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    // if (!patches || !patches.length) throw new Error('EMPTY_BATCH');
    const keyBase = await this.blockKeyBase(id);
    const metaKey = keyBase + Defaults.Metadata;
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
      const exists = await this._exists(keyBase);
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
    const rebasedPatches: Uint8Array[] = [];
    await this.lockBlock(keyBase, async () => {
      let nextTick = 0;
      const tip = await this.readFrontierTip(keyBase);
      if (tip) {
        const patchTime = tip.getId()?.time ?? 0;
        const patchSpan = tip.span();
        nextTick = patchTime + patchSpan + 1; // TODO: Shall we add 1 here?
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
        const uint8 = rebased.toBinary();
        rebasedPatches.push(uint8);
        const op: BinStrLevelOperation = {
          type: 'put',
          key: patchKey,
          value: uint8,
        };
        ops.push(op);
      }
      await this.kv.batch(ops);
    });
    const remote = this.markDirtyAndSync(id).then(() => {});
    remote.catch(() => {});
    if (rebasedPatches.length)
      this.pubsub.pub(['merge', {id, patches: rebasedPatches}]);
    return {remote};
  }

  // /** Load and reset to latest state from the remote. */
  // protected async reset(id: BlockId): Promise<void> {
  //   throw new Error('not implemented');
  //   // TODO: run one such reset per block, at a time
  //   // TODO: when data is loaded, check that seq is greater than the current seq
  // }

  // protected async catchup(id: BlockId, batch): Promise<void> {
  //   // TODO: try catching up using batches, if not possible, reset
  //   // TODO: load batches to catch up with remote
  // }

  protected async _writeModelAndMeta(keyBase: string, modelMeta: BlockModelMetadata, model: Uint8Array, meta: BlockMetaValue): Promise<void> {
    const tuple = [modelMeta, model];
    const ops: BinStrLevelOperation[] = await Promise.all([
      this.encode(tuple, true).then((value) => ({
        type: 'put',
        key: keyBase + Defaults.Model,
        value,
      } as BinStrLevelOperation)),
      this.encode(meta, false).then((value) => ({
        type: 'put',
        key: keyBase + Defaults.Metadata,
        value,
      } as BinStrLevelOperation)),
    ]);
    await this.kv.batch(ops);
  }

  public async pull(id: BlockId): Promise<void> {
    const keyBase = await this.blockKeyBase(id);
    const modelKey = keyBase + Defaults.Model;
    const modelTupleBlob = await this.kv.get(modelKey);
    let seq = -1;
    if (modelTupleBlob) {
      const tuple = await this.decode(modelTupleBlob, true) as BlockModelMetadata;
      seq = tuple[0];
    }
    const blockId = id.join('/');
    const pull = await this.opts.rpc.pull(blockId, seq);
    const nextSeq = pull.batches.length ? pull.batches[pull.batches.length - 1].seq : pull.snapshot?.seq ?? seq;
    const pubsub = this.pubsub;
    return await this.lockBlock(keyBase, async () => {
      const [[model, modelMeta], meta] = await Promise.all([
        this.readModel(keyBase),
        this.readMeta(keyBase),
      ]);
      const seq2 = modelMeta[0];
      if (seq2 !== seq) throw new Error('CONFLICT');
      // const createNewBlock = !modelTupleBlob;
      // if (createNewBlock) {
      //   if (!pull.snapshot) throw new Error('DELETED');
      //   const model = Model.load(pull.snapshot.blob, this.sid);
      //   for (const batch of pull.batches)
      //     for (const patch of batch.patches)
      //       model.applyPatch(Patch.fromBinary(patch.blob));
      //   meta.ts = Date.now();
      //   const modelMeta: BlockModelMetadata = [pull.snapshot.seq];
      //   const tuple = [modelMeta, model.toBinary()];
      //   const ops: BinStrLevelOperation[] = [
      //     {
      //       type: 'put',
      //       key: modelKey,
      //       value: await this.encode(tuple, true),
      //     },
      //     {
      //       type: 'put',
      //       key: keyBase + Defaults.Metadata,
      //       value: await this.encode(meta, false),
      //     },
      //   ];
      //   await this.kv.batch(ops);
      //   // TODO: Emit pubsub event.
      //   return;
      // }
      if (pull.snapshot) {
        if (nextSeq > seq2) {
          const model = Model.load(pull.snapshot.blob, this.sid);
          for (const batch of pull.batches)
            for (const patch of batch.patches)
              model.applyPatch(Patch.fromBinary(patch.blob));
          meta.ts = Date.now();
          const modelBlob = model.toBinary();
          await this._writeModelAndMeta(keyBase, [nextSeq], modelBlob, meta);
          pubsub.pub(['reset', {id, model: modelBlob}]);
        }
        return;
      }
      if (!model) throw new Error('NO_MODEL');
      const patches: Uint8Array[] = [];
      for (const batch of pull.batches)
        for (const patch of batch.patches) {
          model.applyPatch(Patch.fromBinary(patch.blob));
          patches.push(patch.blob);
        }
      modelMeta[0] = nextSeq;
      await this._writeModelAndMeta(keyBase, modelMeta, model.toBinary(), meta);
      pubsub.pub(['merge', {id, patches}]);
    });
  }

  protected async _merge(batch: RemoteBatch): Promise<void> {
    
  }

  private _remoteSubs: Record<string, Observable<LocalRepoChangeEvent>> = {};

  protected subscribeToRemoteChanges(id: BlockId): Observable<LocalRepoChangeEvent> {
    const blockId = id.join('/');
    let sub = this._remoteSubs[blockId];
    if (sub) return sub;
    sub = this.opts.rpc.listen(blockId).pipe(
      finalize(() => {
        delete this._remoteSubs[blockId];
      }),
      switchMap(async ({event}) => {
        switch (event[0]) {
          case 'new': {
            throw new Error('not implemented');
          }
          case 'upd': {
            const {batch} = event[1];
            this._merge(batch).catch(() => {});
            throw new Error('not implemented');
            break;
          }
          case 'del': {
            throw new Error('not implemented');
          }
        }
      }),
    );
    this._remoteSubs[blockId] = sub;
    return sub;
  }

  public async get(id: BlockId): Promise<{model: Model}> {
    try {
      // TODO: fetch latest on read.
      return await this.read(id);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND')
        return await this.load(id);
      throw error;
    }
  }

  protected async load(id: BlockId): Promise<{model: Model}> {
    const blockId = id.join('/');
    const res = await this.opts.rpc.read(blockId);
    const block = res.block;
    const snapshot = block.snapshot;
    const seq = snapshot.seq;
    const sid = this.sid;
    const model = Model.load(snapshot.blob, sid);
    for (const batch of block.tip)
      for (const patch of batch.patches)
        model.applyPatch(Patch.fromBinary(patch.blob));
    const keyBase = await this.blockKeyBase(id);
    const metaKey = keyBase + Defaults.Metadata;
    const meta: BlockMetaValue = {
      time: -1,
      ts: Date.now(),
    };
    const modelBlob = model.toBinary();
    const modelTuple: BlockModelValue = [[seq], modelBlob];
    const [metaBlob, modelTupleBlob] = await Promise.all([
      this.encode(meta, false),
      this.encode(modelTuple, true),
    ]);
    const ops: BinStrLevelOperation[] = [
      {
        type: 'put',
        key: metaKey,
        value: metaBlob,
      },
      {
        type: 'put',
        key: keyBase + Defaults.Model,
        value: modelTupleBlob,
      },
    ];
    await this.lockBlock(keyBase, async () => {
      const exists = await this._exists(keyBase);
      if (exists) throw new Error('EXISTS');
      await this.kv.batch(ops);
    });
    this.pubsub.pub(['pull', {id, batches: [], snapshot: {seq, blob: modelBlob}}])
    return {model};
  }

  public async read(id: BlockId): Promise<{model: Model}> {
    const keyBase = await this.blockKeyBase(id);
    const [[model], frontier] = await Promise.all([this.readModel(keyBase), this.readFrontier0(keyBase)]);
    const notFound = model.clock.time === 1 && frontier.length === 0;
    if (notFound) throw new Error('NOT_FOUND');
    model.applyBatch(frontier);
    return {model};
  }

  public del$(id: BlockId): Observable<void> {
    const blockId = id.join('/');
    return this.opts.rpc.listen(blockId)
      .pipe(
        filter(({event}) => event[0] === 'del'),
        map(() => void 0),
      );
  }

  public change$(id: BlockId): Observable<LocalRepoChangeEvent> {
    const blockId = id.join('/');
    // this.opts.rpc.listen(blockId).subscribe(({event}) => {
    //   switch (event[0]) {
    //     case 'upd': {
    //       const {batch} = event[1];

    //       // const rebase: Patch[] = [];
    //       // for (const blob of patches) rebase.push(Patch.fromBinary(blob));
    //       // const event: LocalRepoChangeEvent = {rebase};
    //       // this.pubsub.pub(['merge', {id, patches}]);
    //       // return event;
    //     }
    //   }
    // });
    return this.pubsub.bus$.pipe(
      map(([topic, data]) => {
        switch (topic) {
          case 'rebase': {
            if (!deepEqual(id, data.id)) return;
            const rebase: Patch[] = [];
            for (const blob of (<LevelLocalRepoLocalRebase>data).patches) rebase.push(Patch.fromBinary(blob));
            const event: LocalRepoChangeEvent = {rebase};
            return event;
          }
          case 'pull': {
            if (!deepEqual(id, data.id)) return;
            const {batch, batches, snapshot} = data as LevelLocalRepoRemotePull;
            const merge: Patch[] = [];
            const event: LocalRepoChangeEvent = {merge};
            if (batches) for (const b of batches) for (const p of b.patches) merge.push(Patch.fromBinary(p.blob));
            if (snapshot) {
              const reset = Model.load(snapshot.blob, this.sid);
              if (batch) for (const p of batch.patches) reset.applyPatch(Patch.fromBinary(p.blob));
              reset.applyBatch(merge);
              event.reset = reset;
            }
            return event;
          }
          case 'reset': {
            throw new Error('not implemented');
          }
          case 'merge': {
            throw new Error('not implemented');
          }
        }
      }),
      filter(event => !!event),
    );
  }

  protected async readMeta(keyBase: string): Promise<BlockMetaValue> {
    const metaKey = keyBase + Defaults.Metadata;
    const blob = await this.kv.get(metaKey);
    const meta = this.codec.decoder.decode(blob) as BlockMetaValue;
    return meta;
  }

  public async readModel0(keyBase: string): Promise<[meta: BlockModelMetadata, blob: Uint8Array]> {
    const modelKey = keyBase + Defaults.Model;
    const value = await this.kv.get(modelKey);
    const decoded = await this.decode(value, true) as [meta: BlockModelMetadata, blob: Uint8Array];
    return decoded;
  }

  public async readModel(keyBase: string): Promise<[model: Model, meta: BlockModelMetadata]> {
    try {
      const [meta, blob] = await this.readModel0(keyBase);
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

  protected async lockBlock<T>(keyBase: string, fn: () => Promise<T>): Promise<T> {
    return await this.locks.lock(keyBase, 500, 500)<T>(fn);
  }

  // ---------------------------------------------------------- Synchronization

  protected async markDirty(id: BlockId): Promise<void> {
    const key = Defaults.SyncRoot + '!' + id.join('!');
    const blob = this.codec.encoder.encode(Date.now());
    await this.kv.put(key, blob);
  }

  protected async markDirtyAndSync(id: BlockId): Promise<boolean> {
    this.markDirty(id).catch(() => {});
    return await this.push(id);
  }

  protected remoteTimeout(): number {
    return this.opts.remoteTimeout ?? 5000;
  }

  protected async push(id: BlockId, doPull: boolean = false): Promise<boolean> {
    if (!this.connected$.getValue()) throw new Error('DISCONNECTED');
    const keyBase = await this.blockKeyBase(id);
    const remote = this.opts.rpc;
    const remoteId = id.join('/');
    const patches: ServerPatch[] = [];
    const syncMarkerKey = Defaults.SyncRoot + '!' + id.join('!');
    const ops: BinStrLevelOperation[] = [{type: 'del', key: syncMarkerKey}];
    const encoder = this.codec.encoder;
    for await (const [key, blob] of this.readFrontierBlobs0(keyBase)) {
      ops.push({type: 'del', key});
      patches.push({blob});
    }
    if (!patches && !doPull) return false;
    // TODO: handle case when this times out, but actually succeeds, so on re-sync it handles the case when the block is already synced.
    return await this.lockBlock(keyBase, async () => {
      const TIMEOUT = this.remoteTimeout();
      const startTime = Date.now();
      const assertTimeout = () => {
        if (Date.now() - startTime > TIMEOUT) throw new Error('TIMEOUT');
      };
      return await timeout(TIMEOUT, async () => {
        const read = await Promise.all([
          this.readModel(keyBase),
          this.readMeta(keyBase),
        ]);
        assertTimeout();
        const meta = read[1];
        if (Date.now() - meta.ts < 1000) return false;
        const hist = !!meta.hist;
        const modelMeta = read[0][1];
        let model = read[0][0];
        const lastKnownSeq = modelMeta[0];
        const response = await remote.update(remoteId, {patches}, lastKnownSeq);
        assertTimeout();
        // TODO: handle case when block is deleted on the server.
        // Process pull
        const pull = response.pull;
        if (pull) {
          const snapshot = pull.snapshot;
          const batches = pull.batches;
          if (snapshot) {
            model = Model.load(snapshot.blob, this.sid);
            if (hist) {
              ops.push({
                type: 'put',
                key: this.snapshotKey(keyBase, snapshot.seq),
                value: await this.encode(snapshot, true),
              });
              assertTimeout();
            }
          }
          if (batches) {
            for (const b of batches) {
              const patches = b.patches;
              for (const patch of patches) model.applyPatch(Patch.fromBinary(patch.blob));
              if (hist) {
                ops.push({
                  type: 'put',
                  key: this.batchKey(keyBase, b.seq),
                  value: await this.encode(b, false),
                });
                assertTimeout();
              }
            }
          }
        }
        // Process the latest batch
        for (const patch of patches) model.applyPatch(Patch.fromBinary(patch.blob));
        const batch: LocalBatch = {...response.batch, patches};
        const seq = batch.seq;
        if (hist) {
          ops.push({
            type: 'put',
            key: this.batchKey(keyBase, seq),
            value: await this.encode(batch, false),
          });
          assertTimeout();
        }
        // Process the model
        modelMeta[0] = seq;
        const modelTuple: BlockModelValue = [modelMeta, model.toBinary()];
        const modelValue = encoder.encode(modelTuple);
        const modelBlob = await this.encrypt(modelValue, true);
        assertTimeout();
        ops.push({
          type: 'put',
          key: keyBase + Defaults.Model,
          value: modelBlob,
        });
        // Process block metadata
        meta.time = model.clock.time - 1;
        meta.ts = Date.now();
        ops.push({
          type: 'put',
          key: keyBase + Defaults.Metadata,
          value: encoder.encode(meta),
        });
        // Persist and wrap up
        assertTimeout();
        await this.kv.batch(ops);
        if (pull) {
          const data: LevelLocalRepoRemotePull = {
            id,
            batch,
            batches: pull.batches,
            snapshot: pull.snapshot
          };
          this.pubsub.pub(['pull', data]);
        }
        return true;
      });
    });
  }

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
