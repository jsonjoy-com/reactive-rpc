import {BehaviorSubject} from 'rxjs';
import {gzip, ungzip} from '@jsonjoy.com/util/lib/compression/gzip';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {LocalRepoSyncRequest, LocalRepoSyncResponse} from '../../types';
import {BinStrLevel, BinStrLevelOperation, BlockMetadata} from '../types';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
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
   * The root of the keyspace where items are marked as "dirty" and need sync.
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
  readonly locks: Locks;
  readonly kv: BinStrLevel;
  readonly sid: number;
  readonly connected$?: BehaviorSubject<boolean>;
  readonly cipher?: CrudLocalRepoCipher;
}

export class LevelLocalRepoCore {
  readonly kv: BinStrLevel;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly connected$: BehaviorSubject<boolean>;
  protected readonly cipher?: CrudLocalRepoCipher;
  protected readonly codec: JsonValueCodec = new CborJsonValueCodec(new Writer(1024 * 16));

  constructor(opts: LevelLocalRepoCoreOpts) {
    this.kv = opts.kv;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
    this.cipher = opts.cipher;
  }

  public async encrypt(blob: Uint8Array): Promise<Uint8Array> {
    blob = await gzip(blob);
    if (this.cipher) blob = await this.cipher.encrypt(blob);
    return blob;
  }

  public async decrypt(blob: Uint8Array): Promise<Uint8Array> {
    if (this.cipher) blob = await this.cipher.decrypt(blob);
    blob = await ungzip(blob);
    return blob;
  }

  public blockKeyBase(col: string[], id: string): string {
    return BlockKeyFragment.BlockRepoRoot + '!' + col.join('!') + '!' + id + '!';
  }

  public blockKey(col: string[], id: string, dest: BlockKeyFragment): string {
    return this.blockKeyBase(col, id) + dest;
  }

  public modelKey(col: string[], id: string): string {
    return this.blockKey(col, id, BlockKeyFragment.Model);
  }

  public metaKey(col: string[], id: string): string {
    return this.blockKey(col, id, BlockKeyFragment.Metadata);
  }

  public frontierKeyBase(blockKeyBase: string): string {
    return blockKeyBase + BlockKeyFragment.Frontier + '!';
  }

  public frontierKey(blockKeyBase: string, time: number): string {
    const timeFormatted = time.toString(36).padStart(6, '0');
    return this.frontierKeyBase(blockKeyBase) + timeFormatted;
  }

  // public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
  //   const {col, id, batch} = req;
  //   const crud = this.crud;
  //   const dir = this.blockDir(col, id);
  //   let patchSeqBlob: Uint8Array | undefined;
  //   if (batch && batch.length) {
  //     patchSeqBlob = patchListBlob(batch);
  //   }
  //   await this.lockModelWrite(col, id, async () => {
  //     if (patchSeqBlob) {
  //       console.log('patchSeqBlob' , patchSeqBlob, dir, FileName.UnSyncedPatches);
  //       await crud.put(dir, FileName.UnSyncedPatches, patchSeqBlob, {throwIf: req.throwIf, pos: -1});
  //     }
  //   });
  //   // const blob = this.encode(log);
  //   // await this.write(collection, id, blob, 'missing');

  //     // if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
  //     // const blob = this.encode(log);
  //     // await this.lockForWrite({collection, id}, async () => {
  //     //   await this.core.write(collection, id, blob);
  //     // });
  //     const remote = (async () => {
  //       // const sync = this.sync;
  //       // await sync.markDirty(collection, id);
  //       // // TODO: use pushNewBlock instead?
  //       // const success = await sync.sync(collection, id);
  //       // if (!success) throw new Error('NOT_SYNCED');
  //     })();
  //     remote.catch(() => {});
  //     return {remote};
  // }

  public async sync(req: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse> {
    if (req.batch) {
      const first = req.batch[0];
      const time = first.getId()?.time;
      const isNewDocument = time === 1;
      if (isNewDocument) {
        try {
          return await this.create(req.col, req.id, req.batch);
        } catch (error) {
          if (error instanceof Error && error.message === 'EXISTS') {
            throw new Error('not implemented');
            // return await this.rebaseAndMerge(req.col, req.id, req.batch);
          }
          throw error;
        }
      } else {
        throw new Error('not implemented');
        // return await this.update(req.col, req.id, req.batch);
      }
    } else if (!req.cursor && !req.batch) {
      const model = await this.read(req.col, req.id);
      return {model};
    } else if (req.cursor && !req.batch) {
      throw new Error('Not implemented: catch up');
    } else {
      throw new Error('INV_SYNC');
    }
  }

  public async create(col: string[], id: string, patches?: Patch[]): Promise<Pick<LocalRepoSyncResponse, 'remote'>> {
    if (!patches || !patches.length) throw new Error('EMPTY_BATCH');
    const keyBase = this.blockKeyBase(col, id);
    const modelKey = keyBase + BlockKeyFragment.Model;
    const metaKey = keyBase + BlockKeyFragment.Metadata;
    const meta: BlockMetadata = {
      time: -1,
      ts: 0,
    };
    const blob = this.codec.encoder.encode(meta);
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
    await this.lockModel(modelKey, async () => {
      const exists = (await this.kv.keys({gte: modelKey, lte: modelKey, limit: 1}).all()).length > 0;
      if (exists) throw new Error('EXISTS');
      console.log('writing batch', ops);
      await this.kv.batch(ops);
      console.log('done');
    });
    const remote = this.markDirtyAndSync(col, id);
    remote.catch(() => {});
    return {remote};
  }

  public async read(col: string[], id: string): Promise<Model> {
    const keyBase = this.blockKeyBase(col, id);
    const [model, frontier] = await Promise.all([this.readModel(keyBase), this.readFrontier(keyBase)]);
    model.applyBatch(frontier);
    return model;
  }

  public async readModel(keyBase: string): Promise<Model> {
    const modelKey = keyBase + BlockKeyFragment.Model;
    try {
      const blob = await this.kv.get(modelKey);
      const model = Model.load(blob, this.sid);
      return model;
    } catch (error) {
      if (!!error && typeof error === 'object' && (error as any).code === 'LEVEL_NOT_FOUND')
          return Model.create(void 0, this.sid);
      throw error;
    }
  }

  public async readFrontier(keyBase: string): Promise<Patch[]> {
    const patches: Patch[] = [];
    const gt = this.frontierKeyBase(keyBase);
    const lt = gt + '~';
    for await (const blob of this.kv.values({gt, lt})) {
      const patch = Patch.fromBinary(blob);
      patches.push(patch);
    }
    return patches;
  }

  public async markDirty(col: string[], id: string): Promise<void> {
    const key = BlockKeyFragment.SyncRoot + '!' + col.join('!') + '!' + id + '!';
    const blob = this.codec.encoder.encode(Date.now());
    await this.kv.put(key, blob);
  }

  public async markDirtyAndSync(collection: string[], id: string): Promise<void> {
    await this.markDirty(collection, id);
    // TODO: ask remote to sync.
  }

  public async markTidy(col: string[], id: string): Promise<void> {
    const key = BlockKeyFragment.SyncRoot + '!' + col.join('!') + '!' + id + '!';
    await this.kv.del(key);
  }

  protected async lockModel(modelKey: string, fn: () => Promise<void>): Promise<void> {
    await this.locks.lock(modelKey, 500, 500)(fn);
  }
}
