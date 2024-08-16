import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {Subscription} from 'rxjs';
import type {BlockId, LocalRepo, LocalRepoBlockEvent} from '../local/types';

export class EditSession {
  public static readonly open = async (repo: LocalRepo, id: BlockId): Promise<EditSession> => {
    const res = await repo.sync({id});
    const start = res.model;
    if (!start) throw new Error('NO_MODEL');
    const session = new EditSession(repo, id, start);
    return session;
  };

  public log: Log;
  protected readonly _sub: Subscription;

  constructor(
    public readonly repo: LocalRepo,
    public readonly id: BlockId,
    protected start: Model,
  ) {
    this.log = new Log(() => this.start.clone());
    this._sub = this.repo.sub(this.id).subscribe(this.onEvent);
  }

  public dispose(): void {
    this._sub.unsubscribe();
  }

  private events: LocalRepoBlockEvent[] = [];

  private onEvent = (event: LocalRepoBlockEvent): void => {
    this.events.push(event);
    this.drainEvents();
  };

  private drainEvents(): void {
    if (this.saveInProgress) return;
    const events = this.events;
    const length = events.length;
    for (let i = 0; i < length; i++) this.processEvent(events[i]);
    this.events = [];
  }

  private processEvent(event: LocalRepoBlockEvent): void {
    switch (event.type) {
      case 'lpull': {
        this.rebase(event.patches);
        break;
      }
      case 'rpull': {
        const model = event.model;
        if (model) this.reset(model);
        const patches = event.patches;
        if (patches) this.apply(patches);
        break;
      }
      case 'delete': {
        this.clear();
        break;
      }
    }
  }

  protected apply(patches: Patch[]): void {
    this.log.end.applyBatch(patches);
    this.start.applyBatch(patches);
  }

  protected rebase(patches: Patch[]): void {
    const log = this.log;
    const end = log.end;
    // TODO: Remove this condition, make flush always safe to call.
    if (end.api.builder.patch.ops.length) end.api.flush();
    const newEnd = log.start();
    newEnd.applyBatch(patches);
    const lastPatch = patches[patches.length - 1];
    let nextTick = lastPatch.getId()!.time + lastPatch.span();
    const rebased: Patch[] = [];
    log.patches.forEach(({v}) => {
      const patch = v.rebase(nextTick);
      rebased.push(patch);
      nextTick += patch.span();
    });
    log.patches.clear();
    for (const patch of rebased) log.patches.set(patch.getId()!, patch);
    log.end.reset(newEnd);
  }

  protected reset(model: Model): void {
    this.start = model.clone();
    const log = this.log;
    const end = log.end;
    // TODO: Remove this condition, make flush always safe to call.
    if (end.api.builder.patch.ops.length) end.api.flush();
    end.reset(model);
    log.patches.forEach((patch) => end.applyPatch(patch.v));
  }

  protected clear(): void {
    const {start, log} = this;
    const empty = Model.create(undefined, start.clock.sid);
    start.reset(empty);
    log.patches.clear();
    log.end.reset(empty);
  }

  private saveInProgress = false;

  /**
   * Save any pending changes to the local repo.
   */
  public async sync(): Promise<null | {remote?: Promise<void>}> {
    if (this.saveInProgress) return null;
    this.saveInProgress = true;
    try {
      const log = this.log;
      if (!log.patches.size()) return {};
      const patches: Patch[] = [];
      log.patches.forEach((patch) => {
        patches.push(patch.v);
      });
      // TODO: After async call check that sync state is still valid.
      const res = await this.repo.sync({id: this.id, patches});
      if (res.rebase) this.rebase(res.rebase);
      else if (res.model) this.reset(res.model);
      return {remote: res.remote};
    } finally {
      this.saveInProgress = false;
      this.drainEvents();
    }
  }
}
