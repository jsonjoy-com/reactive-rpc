import type {ITimestampStruct, Model, Patch} from 'json-joy/lib/json-crdt';
import type {FanOut} from 'thingies/lib/fanout';

export interface LocalRepo {
  sync(collection: string[], id: string, request: LocalRepoSyncRequest): Promise<LocalRepoSyncResponse>;
  del(collection: string[], id: string): Promise<void>;
  sub(collection: string[], id: string): FanOut<LocalRepoSubData>;
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
   * Latest known cursor position of already loaded data. If `null`, means that
   * no data was loaded yet. Setting this to `null` will load the latest
   * `Model` snapshot, making this call equivalent to "read" operation.
   */
  cursor?: ITimestampStruct;

  /**
   * List of changes that the client wants to persist.
   */
  batch?: Patch[];
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
  reset?: Model;
}

export interface LocalRepoSubData {
  /**
   * List of changes received from other clients.
   */
  batch?: Patch[];
}
