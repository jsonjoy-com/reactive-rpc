import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {concurrency} from 'thingies/lib/concurrencyDecorator';
import {Subject, takeUntil} from 'rxjs';
import type {BlockId, LocalRepo, LocalRepoDeleteEvent, LocalRepoEvent, LocalRepoMergeEvent, LocalRepoRebaseEvent, LocalRepoResetEvent} from '../local/types';

export class EditSession {
  public log: Log;
  protected _stopped = false;
  protected _stop$ = new Subject<void>();
  protected readonly session: number = Math.floor(Math.random() * 0x7fffffff);

  public get model(): Model {
    return this.log.end;
  }

  constructor(
    public readonly repo: LocalRepo,
    public readonly id: BlockId,
    protected start: Model,
    public cursor: undefined | unknown = undefined
  ) {
    this.log = new Log(() => this.start.clone());
    this.repo.change$(this.id)
      .pipe(takeUntil(this._stop$))
      .subscribe(this.onEvent);
  }

  public dispose(): void {
    this._stopped = true;
    this._stop$.next();
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
   * Push (persist) any in-memory changes and pull (load) the latest state
   * from the local repo.
   */
  @concurrency(1) public async sync(): Promise<null | {remote?: Promise<void>}> {
    const log = this.log;
    const api = log.end.api;
    api.flush();
    this.saveInProgress = true;
    try {
      const patches: Patch[] = [];
      log.patches.forEach((patch) => {
        patches.push(patch.v);
      });
      const length = patches.length;
      // TODO: After async call check that sync state is still valid. New patches, might have been added.
      if (length || this.cursor === undefined) {
        const res = await this.repo.sync({id: this.id, patches, cursor: this.cursor, session: this.session});
        // TODO: After sync call succeeds, remove the patches from the log.
        // TODO: reset the `start` model manually
        if (length) {
          const last = patches[length - 1];
          const lastId = last.getId();
          if (lastId) {
            this.log.advanceTo(lastId);
          }
        }
        if (typeof res.cursor !== undefined) this.cursor = res.cursor;
        if (res.model) this.reset(res.model);
        return {remote: res.remote};
      } else {
        const res = await this.repo.getIf({id: this.id, time: this.model.clock.time - 1, cursor: this.cursor});
        if (res) {
          this.reset(res.model);
          this.cursor = res.cursor;
        }
        return null;
      }
    } finally {
      this.saveInProgress = false;
      this.drainEvents();
    }
  }

  /**
   * Load latest state from the local repo.
   */
  public async load(): Promise<void> {
    const {model} = await this.repo.get({id: this.id});
    if (model.clock.time > this.start.clock.time) this.reset(model);
  }

  public loadSilent(): void {
    this.load().catch(() => {});
  }

  // ------------------------------------------------------- change integration

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
    if (patches.length === 0) return;
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
    if (!patches.length) return;
    this.log.end.applyBatch(patches);
    this.start.applyBatch(patches);
  }

  // ------------------------------------------------ reactive event processing

  private events: LocalRepoEvent[] = [];

  private onEvent = (event: LocalRepoEvent): void => {
    if (this._stopped) return;
    if ((event as LocalRepoRebaseEvent).rebase) {
      if ((event as LocalRepoRebaseEvent).session === this.session) return;
    }
    this.events.push(event);
    this.drainEvents();
  };

  private drainEvents(): void {
    if (this.saveInProgress || this._stopped) return;
    const events = this.events;
    const length = events.length;
    for (let i = 0; i < length; i++) {
      const event = events[i];
      try {
        if ((event as LocalRepoResetEvent).reset) this.reset((event as LocalRepoResetEvent).reset);
        else if ((event as LocalRepoRebaseEvent).rebase) this.rebase((event as LocalRepoRebaseEvent).rebase);
        else if ((event as LocalRepoMergeEvent).merge) this.merge((event as LocalRepoMergeEvent).merge);
        else if ((event as LocalRepoDeleteEvent).del) {
          this.clear();
          break;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to apply event', event, error);
      }
    }
    this.events = [];
  }
}
