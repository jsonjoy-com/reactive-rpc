import {Model, Patch} from 'json-joy/lib/json-crdt';
import type * as types from './types';

const tick = new Promise((resolve) => setImmediate(resolve));

export class MemoryStore implements types.Store {
  protected readonly snapshots = new Map<string, types.StoreSnapshot>();
  protected readonly patches = new Map<string, types.StorePatch[]>();

  public async get(id: string): Promise<types.StoreGetResult | undefined> {
    await tick;
    const snapshot = this.snapshots.get(id);
    if (!snapshot) return;
    return {snapshot};
  }

  public async seq(id: string): Promise<number | undefined> {
    await tick;
    return this.snapshots.get(id)?.seq;
  }

  public async create(id: string, model: types.StoreSnapshot, patches: types.StorePatch[]): Promise<void> {
    await tick;
    if (!Array.isArray(patches)) throw new Error('NO_PATCHES');
    if (this.snapshots.has(id)) throw new Error('BLOCK_EXISTS');
    this.snapshots.set(id, model);
    this.patches.set(id, patches);
  }

  public async edit(id: string, patches: types.StorePatch[]): Promise<types.StoreApplyResult> {
    await tick;
    if (!Array.isArray(patches) || !patches.length) throw new Error('NO_PATCHES');
    const snapshot = this.snapshots.get(id);
    const existingPatches = this.patches.get(id);
    if (!snapshot || !existingPatches) throw new Error('BLOCK_NOT_FOUND');
    let seq = patches[0].seq;
    const diff = seq - snapshot.seq - 1;
    if (snapshot.seq + 1 < seq) throw new Error('PATCH_SEQ_TOO_HIGH');
    const model = Model.fromBinary(snapshot.blob);
    for (const patch of patches) {
      if (seq !== patch.seq) throw new Error('PATCHES_OUT_OF_ORDER');
      model.applyPatch(Patch.fromBinary(patch.blob));
      patch.seq -= diff;
      seq++;
    }
    snapshot.seq += patches.length;
    snapshot.blob = model.toBinary();
    snapshot.updated = Date.now();
    for (const patch of patches) existingPatches.push(patch);
    return {snapshot};
  }

  public async history(id: string, min: number, max: number): Promise<types.StorePatch[]> {
    await tick;
    const patches = this.patches.get(id);
    if (!patches) return [];
    return patches.slice(min, max + 1);
  }

  public async remove(id: string): Promise<boolean> {
    await tick;
    return this.removeSync(id);
  }

  private removeSync(id: string): boolean {
    this.snapshots.delete(id);
    return this.patches.delete(id);
  }

  public stats(): {blocks: number; patches: number} {
    return {
      blocks: this.snapshots.size,
      patches: [...this.patches.values()].reduce((acc, v) => acc + v.length, 0),
    };
  }

  public async removeOlderThan(ts: number): Promise<void> {
    await tick;
    for (const [id, snapshot] of this.snapshots) if (snapshot.created < ts) this.removeSync(id);
  }

  public async removeAccessedBefore(ts: number): Promise<void> {
    await tick;
    for (const [id, snapshot] of this.snapshots) if (snapshot.updated < ts) this.removeSync(id);
  }
}
