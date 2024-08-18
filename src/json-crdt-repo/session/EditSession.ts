import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {Subject, takeUntil} from 'rxjs';
import type {BlockId, LocalRepo, LocalRepoChangeEvent} from '../local/types';

export class EditSession {
  public static readonly open = async (repo: LocalRepo, id: BlockId): Promise<EditSession> => {
    const res = await repo.sync({id});
    const start = res.model;
    if (!start) throw new Error('NO_MODEL');
    const session = new EditSession(repo, id, start);
    return session;
  };

  public log: Log;
  private _stop$ = new Subject<void>();

  constructor(
    public readonly repo: LocalRepo,
    public readonly id: BlockId,
    protected start: Model,
  ) {
    this.log = new Log(() => this.start.clone());
    this.repo.change$(this.id)
      .pipe(takeUntil(this._stop$))
      .subscribe(this.onEvent);
    this.repo.del$(this.id)
      .pipe(takeUntil(this._stop$))
      .subscribe(() => this.clear());
  }

  public dispose(): void {
    this._stop$.next();
  }

  private events: LocalRepoChangeEvent[] = [];

  private onEvent = (event: LocalRepoChangeEvent): void => {
    this.events.push(event);
    this.drainEvents();
  };

  private drainEvents(): void {
    if (this.saveInProgress) return;
    const events = this.events;
    const length = events.length;
    for (let i = 0; i < length; i++) this.processChange(events[i]);
    this.events = [];
  }

  private processChange({reset, rebase, merge}: LocalRepoChangeEvent): void {
    if (reset) this.reset(reset);
    if (rebase && rebase.length) this.rebase(rebase);
    if (merge && merge.length) this.merge(merge);
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

  protected merge(patches: Patch[]): void {
    this.log.end.applyBatch(patches);
    this.start.applyBatch(patches);
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
      // TODO: After async call check that sync state is still valid. New patches, might have been added.
      const res = await this.repo.sync({id: this.id, patches});
      return {remote: res.remote};
    } finally {
      this.saveInProgress = false;
      this.drainEvents();
    }
  }
}
