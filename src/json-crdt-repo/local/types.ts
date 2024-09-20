import type {Model, Patch} from 'json-joy/lib/json-crdt';
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
   * Creates a new block (document) in the local repo.
   */
  create(request: LocalRepoCreateRequest): Promise<LocalRepoCreateResponse>;

  /**
   * Reads a block (document) from the local repo. Simply fetches the current
   * state of the block stored in the repo.
   */
  get(request: LocalRepoGetRequest): Promise<LocalRepoGetResponse>;

  /**
   * Reads a block from the local repo, if the model clock or the remote cursor
   * is behind.
   */
  getIf(request: LocalRepoGetIfRequest): Promise<null | LocalRepoGetIfResponse>;

  /**
   * Synchronizes an in-memory editing session changes to the locally stored
   * data. The `sync` call is used to create, read, and update data.
   */
  sync(request: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse>;

  /**
   * Retrieves the latest state of the block from the remote.
   *
   * @param id Unique ID of the block.
   */
  pull(id: BlockId): Promise<LocalRepoPullResponse>;

  /**
   * Deletes a block (document) from the local repo.
   */
  del(id: BlockId): Promise<void>;

  /**
   * Emits an event every time a block is updated.
   *
   * @param id Unique ID of the block.
   */
  change$(id: BlockId): Observable<LocalRepoEvent>;
}

export interface LocalRepoCreateRequest {
  id: BlockId;
  patches?: Patch[];
}

export interface LocalRepoCreateResponse {
  /**
   * Promise that resolves when the local changes have been successfully
   * synchronized with the server or remote peers.
   */
  remote: Promise<void>;

  /**
   * Model snapshot that the client should reset its "start" state to. The
   * `Model` is sent when `rebase` patches are not available, or when the
   * patch set is too large.
   */
  model: Model;
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
   * The last known cursor returned in the `.sync()` call response. The cursor
   * should be omitted in the first `.sync()` call, and then set to the value
   * returned in the previous `.sync()` call.
   */
  cursor?: undefined | unknown;

  /**
   * List of changes that the client wants to persist.
   */
  patches?: Patch[];

  /**
   * The session ID, which originated this sync call. The session ID is
   * forwarded in events, so the client can distinguish between its own changes
   * and changes made by other clients.
   */
  session?: number;
}

export interface LocalRepoSyncResponse {
  /**
   * Cursor that the client should use in the next `.sync()` call. If the cursor
   * is not set, the client should use the cursor from the previous `.sync()`
   * call.
   */
  cursor: undefined | unknown;

  /**
   * Model snapshot that the client should reset its "start" state to. The
   * `Model` is sent when the *sync* call detects that the client is behind the
   * remote or the local frontier.
   */
  model?: Model;

  /**
   * List of patches that the client should apply to the local editing session.
   */
  merge?: Patch[];

  /**
   * Promise that resolves when the local changes have been successfully
   * synchronized with the server or remote peers.
   */
  remote?: Promise<void>;
}

export interface LocalRepoPullResponse {
  /**
   * Cursor that the client should use in the next `.sync()` call. If the cursor
   * is not set, the client should use the cursor from the previous `.sync()`
   * call.
   */
  cursor: undefined | unknown;

  /** The latest state of the block. */
  model: Model;
}

export interface LocalRepoGetRequest {
  /**
   * Unique ID of the block.
   */
  id: BlockId;

  /**
   * Whether to load the block from the remote, if it does not exist locally.
   * Defaults to `false`.
   */
  remote?: boolean;
}

export interface LocalRepoGetResponse {
  /**
   * Cursor that the client should use in the next `.sync()` call. If the cursor
   * is not set, the client should use the cursor from the previous `.sync()`
   * call.
   */
  cursor: undefined | unknown;

  /** The latest state of the block. */
  model: Model;
}

export interface LocalRepoGetIfRequest {
  /**
   * Unique ID of the block.
   */
  id: BlockId;

  /**
   * The last known cursor returned in the `.sync()` call response.
   */
  cursor?: unknown | undefined;

  /**
   * The last model clock time.
   */
  time?: number;
}

export interface LocalRepoGetIfResponse {
  model: Model;
  cursor: unknown;
}

/**
 * The change event. It is emitted every time a block is updated, either by
 * the local client or by a remote client. It contains various types of changes
 * that can be applied to the local editing session.
 */
export type LocalRepoEvent = LocalRepoMergeEvent | LocalRepoRebaseEvent | LocalRepoResetEvent | LocalRepoDeleteEvent;

export interface LocalRepoMergeEvent {
  /**
   * List of patches that the client should apply to the local editing session.
   * They can be applied "on top" of the current editing session state, without
   * the need to reset or rebase the editing session.
   */
  merge: Patch[];

  cursor: unknown;
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

  session?: number;
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

export interface LocalRepoDeleteEvent {
  del: true;
}
