import type {ITimestampStruct, Model, Patch} from 'json-joy/lib/json-crdt';
import type {Observable} from 'rxjs';

export type BlockId = [...collection: string[], id: string] | string[];

/**
 * The local repo persists data on the local device. It is the primary building
 * block for the local-first applications. The local repo also facilitates
 * synchronization and conflict resolution between multiple tabs or processes
 * running on the same device.
 */
export interface LocalRepo {
  /**
   * Synchronizes an in-memory editing session changes to the locally stored
   * data. The `sync` call is used to create, read, and update data.
   */
  sync(request: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse>;

  /**
   * Reads a block (document) from the local repo.
   */
  get(id: BlockId): Promise<{model: Model}>;

  /**
   * Deletes a block (document) from the local repo.
   */
  del(id: BlockId): Promise<void>;

  /**
   * Retrieves the latest state of the block from the remote.
   *
   * @param id Unique ID of the block.
   */
  pull(id: BlockId): Promise<void>;

  /**
   * Emits an event when the block is deleted.
   *
   * @param id Unique ID of the block.
   */
  del$(id: BlockId): Observable<void>;

  /**
   * Emits an event every time a block is updated.
   * 
   * @param id Unique ID of the block.
   */
  change$(id: BlockId): Observable<LocalRepoChangeEvent>;
}

/**
 * A single "sync" call servers as three different operations: "create", "read",
 * and "update".
 *
 * - When `cursor` is not set and `batch` is set, the call is equivalent to "create".
 * - When `cursor` and `batch` ar both not set, the call is equivalent to "read".
 * - When `cursor` is set and `batch` is set, the call is equivalent to "update".
 */
export interface LocalRepoSyncRequest {
  /**
   * Unique ID of the block.
   */
  id: BlockId;

  /**
   * When a new block is created, the client can specify whether the block
   * should be created only if it does not exist yet, or if it should be
   * created only if it already exists.
   */
  throwIf?: 'missing' | 'exists';

  /**
   * Latest known cursor position of already loaded data. If `null`, means that
   * no data was loaded yet. Setting this to `null` will load the latest
   * `Model` snapshot, making this call equivalent to "read" operation.
   */
  cursor?: ITimestampStruct;

  /**
   * List of changes that the client wants to persist.
   */
  patches?: Patch[];
}

export interface LocalRepoSyncResponse {
  /**
   * List of changes that the client should apply to the local state.
   */
  rebase?: Patch[];

  /**
   * Model snapshot that the client should reset its "start" state to. The
   * `Model` is sent when `rebase` patches are not available, or when the
   * patch set is too large.
   */
  model?: Model;

  /**
   * Promise that resolves when the local changes have been successfully
   * synchronized with the server or remote peers.
   */
  remote?: Promise<void>;
}

/**
 * The change event. It is emitted every time a block is updated, either by
 * the local client or by a remote client. It contains various types of changes
 * that can be applied to the local editing session.
 */
export type LocalRepoChangeEvent =
  | LocalRepoMergeEvent
  | LocalRepoRebaseEvent
  | LocalRepoResetEvent;

export interface LocalRepoMergeEvent {
  /**
   * List of patches that the client should apply to the local editing session.
   * They can be applied "on top" of the current editing session state, without
   * the need to reset or rebase the editing session.
   */
  merge: Patch[];
}

export interface LocalRepoRebaseEvent {
  /**
   * List of patches that the client should rebase its editing session on top
   * of. The rebase patches usually result from the changes happening in another
   * local editing session, for example, another tab. This is because the tabs
   * reuse the same session ID, hence, for the timestamps to be unique, the
   * timestamps of the in-progress editing session are "rebased".
   * 
   * In practice, this should almost never happen, as by the time the user
   * switches tabs, the changes are already synchronized.
   */
  rebase: Patch[];
}

export interface LocalRepoResetEvent {
  /**
   * The new model snapshot that the client should reset its editing session to.
   * This happens when the changes are too large to be sent as patches, or when
   * the changes are too many and the client should reset its editing session
   * to the new state. When resetting, the client might still need to apply
   * `merge` and `rebase` patches on top of the new model.
   */
  reset: Model;
}
