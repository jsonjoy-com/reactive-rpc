export interface BlockMetadata {
  /**
   * The latest logical time that was successfully synced with the remote.
   */
  time: number;

  /**
   * The last wall clock time the block was synced with the remote successfully,
   * in milliseconds.
   */
  ts: number;

  /**
   * Whether to keep a history of the block.
   */
  hist?: boolean;

  /**
   * The minimum logical time of frontier patches.
   */
  fmin: number;

  /**
   * The next maximum available logical time of frontier patches.
   */
  fmax: number;
}
