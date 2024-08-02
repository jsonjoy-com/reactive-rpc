export interface StoreBlock {
  /** Block ID. */
  id: string;

  /** Timestamp in (milliseconds) when the block was created. */
  ts: number;

  /** Timestamp in (milliseconds) when the block was last updated. */
  uts: number;

  /** The latest snapshot of the block. */
  snapshot: StoreSnapshot;

  /**
   * The latest changes that have been stored, but not yet applied to the the
   * latest snapshot.
   */
  tip: StoreBatch[];
}

/**
 * Represents a state snapshot of a block at a certain point in time.
 */
export interface StoreSnapshot {
  /** Block ID. */
  id: string;

  /** Sequence number. The seq number of the last applied {@link StoreBatch}. */
  seq: number;

  /** Timestamp in (milliseconds) when the snapshot was created. */
  ts: number;

  // /** Timestamp in (milliseconds) when the snapshot was last updated. */
  // uts: number;

  /** The state of the snapshot encoded in algorithm-specific format. */
  blob: Uint8Array;
}

/**
 * Represents a list of changes to apply to a block.
 */
export interface StoreBatch {
  /**
   * Server enforced sequence number. The client must provide a sequence number
   * that is greater than the current sequence number of the block.
   */
  seq: number;

  /** Timestamp (in milliseconds) when the batch was processed by the server. */
  ts: number;

  /** Timestamp (in milliseconds) when the batch was created by the client. */
  cts?: number;

  /**
   * A list of atomic changes to apply to the block.
   */
  patches: StorePatch[];
}

/**
 * Represents an atomic change unit in algorithm-specific format.
 */
export interface StorePatch {
  /** Time (in milliseconds) when the patch was created by the client. */
  cts?: number;

  /** Client set, optional, user ID, who created the patch. */
  uid?: string;

  /** The patch contents in algorithm-specific format. */
  blob: Uint8Array;
}

export type StoreIncomingSnapshot = Omit<StoreSnapshot, 'ts' | 'uts'>;
export type StoreIncomingBatch = Omit<StoreBatch, 'seq' | 'ts'>;

export interface Store {
  /**
   * Create a new block.
   *
   * @param id Block ID.
   * @param batch Initial patches to apply to a new block.
   * @returns Newly created block data.
   */
  create(snapshot: StoreIncomingSnapshot, batch?: StoreIncomingBatch): Promise<StoreCreateResult>;

  /**
   * Push changes to an existing block.
   *
   * @param id Block ID.
   * @param batch Patches to apply to the block.
   * @returns Updated block data.
   */
  push(snapshot: StoreIncomingSnapshot, batch: StoreIncomingBatch): Promise<StorePushResult>;

  /**
   * Retrieve an existing block.
   *
   * @param id Block ID.
   * @returns Block data, or `undefined` if the block does not exist.
   */
  get(id: string): Promise<StoreGetResult | undefined>;

  /**
   * Retrieve the existence of a block.
   *
   * @param id Block ID.
   */
  exists(id: string): Promise<boolean>;

  /**
   * Retrieve the sequence number of a block.
   *
   * @param id Block ID.
   * @returns Block sequence number, or `undefined` if the block does not exist.
   */
  seq(id: string): Promise<number | undefined>;

  /**
   * Retrieve the history of batches for a block.
   *
   * @param id Block ID.
   * @param min Minimum sequence number.
   * @param max Maximum sequence number.
   * @returns List of batches.
   */
  history(id: string, min: number, max: number): Promise<StoreBatch[]>;

  /**
   * Remove a block.
   *
   * @param id Block ID.
   * @returns `true` if the block was removed, `false` if the block did not exist.
   */
  remove(id: string): Promise<boolean>;

  /**
   * Remove all blocks that have not been accessed since the given timestamp.
   *
   * @param ts Timestamp in milliseconds.
   */
  removeAccessedBefore(ts: number, limit: number): Promise<void>;

  /**
   * Retrieve statistics about the store.
   *
   * @returns Number of blocks and batches.
   */
  stats(): {blocks: number; batches: number};
}

export interface StoreCreateResult {
  block: StoreBlock;
  batch?: StoreBatch;
}

export interface StorePushResult {
  snapshot: StoreSnapshot;
  batch: StoreBatch;
}

export interface StoreGetResult {
  block: StoreBlock;
}