import {MemoryStore} from './MemoryStore';
import {RpcError, RpcErrorCodes} from '../../../../common/rpc/caller';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import type {StoreSnapshot, StorePatch} from './types';
import type {Services} from '../Services';

const BLOCK_TTL = 1000 * 60 * 30; // 30 minutes

const validatePatches = (patches: Pick<StorePatch, 'blob'>[]) => {
  for (const patch of patches) {
    if (patch.blob.length > 2000) throw RpcError.validation('patch blob too large');
    // if (patch.seq > 500_000) throw RpcError.validation('patch seq too large');
  }
};

export class BlocksServices {
  protected readonly store = new MemoryStore();

  constructor(protected readonly services: Services) {}

  public async create(id: string, partialPatches: Pick<StorePatch, 'blob'>[]) {
    this.maybeGc();
    validatePatches(partialPatches);
    if (!Array.isArray(partialPatches)) throw new Error('INVALID_PATCHES');
    const length = partialPatches.length;
    const now = Date.now();
    if (!length) {
      const model = Model.withLogicalClock(SESSION.GLOBAL);
      const snapshot: StoreSnapshot = {
        id,
        seq: -1,
        blob: model.toBinary(),
        created: now,
        updated: now,
      };
      return await this.__create(id, snapshot, []);
    }
    const rawPatches: Patch[] = [];
    const patches: StorePatch[] = [];
    let seq = 0;
    for (; seq < length; seq++) {
      const blob = partialPatches[seq].blob;
      rawPatches.push(Patch.fromBinary(blob));
      patches.push({seq, created: now, blob});
    }
    const model = Model.fromPatches(rawPatches);
    const snapshot: StoreSnapshot = {
      id,
      seq: seq - 1,
      blob: model.toBinary(),
      created: now,
      updated: now,
    };
    return await this.__create(id, snapshot, patches);
  }

  private async __create(id: string, snapshot: StoreSnapshot, patches: StorePatch[]) {
    await this.store.create(id, snapshot, patches);
    this.__emitUpd(id, patches);
    return {
      snapshot,
      patches,
    };
  }

  private __emitUpd(id: string, patches: StorePatch[]) {
    const msg = ['upd', {patches}];
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

  public async remove(id: string) {
    const deleted = await this.store.remove(id);
    const msg = ['del'];
    this.services.pubsub.publish(`__block:${id}`, msg).catch((error) => {
      // tslint:disable-next-line:no-console
      console.error('Error publishing block deletion', error);
    });
    return deleted;
  }

  public async scan(
    id: string,
    offset: number | undefined,
    limit: number | undefined = 10,
    returnStartSnapshot: boolean = limit < 0,
  ) {
    const {store} = this;
    if (typeof offset !== 'number') offset = await store.seq(id);
    let min: number = 0,
      max: number = 0;
    if (!limit || Math.round(limit) !== limit) throw RpcError.badRequest('INVALID_LIMIT');
    if (limit > 0) {
      min = Number(offset) || 0;
      max = min + limit;
    } else {
      max = Number(offset) || 0;
      min = max - limit;
    }
    if (min < 0) {
      min = 0;
      max = Math.abs(limit);
    }
    const patches = await store.history(id, min, max);
    let model: Model | undefined;
    if (returnStartSnapshot) {
      const startPatches = await store.history(id, 0, min);
      if (startPatches.length) {
        model = Model.fromPatches(startPatches.map((p) => Patch.fromBinary(p.blob)));
      }
    }
    return {patches, model};
  }

  public async edit(id: string, patches: Pick<StorePatch, 'blob'>[]) {
    this.maybeGc();
    if (!Array.isArray(patches)) throw RpcError.validation('patches must be an array');
    if (!patches.length) throw RpcError.validation('patches must not be empty');
    validatePatches(patches);
    const {store} = this;
    const seq = (await store.seq(id)) ?? -1;
    const fullPatches: StorePatch[] = [];
    const now = Date.now();
    for (let i = 0; i < patches.length; i++) {
      const seqNum = seq + i;
      const patch = patches[i];
      fullPatches.push({seq: seqNum, created: now, blob: patch.blob});
    }
    const {snapshot} = await store.edit(id, fullPatches);
    this.__emitUpd(id, fullPatches);
    const expectedBlockSeq = seq + patches.length - 1;
    const hadConcurrentEdits = snapshot.seq !== expectedBlockSeq;
    let patchesBack: StorePatch[] = [];
    if (hadConcurrentEdits) patchesBack = await store.history(id, seq, snapshot.seq);
    return {
      snapshot,
      patches: patchesBack,
    };
  }

  public stats() {
    return this.store.stats();
  }

  private maybeGc(): void {
    if (Math.random() < 0.05)
      this.gc().catch((error) => {
        // tslint:disable-next-line:no-console
        console.error('Error running gc', error);
      });
  }

  private async gc(): Promise<void> {
    const ts = Date.now() - BLOCK_TTL;
    const {store} = this;
    await store.removeAccessedBefore(ts);
  }
}
