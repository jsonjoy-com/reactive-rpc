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

  // TODO: Track frontier min/max time in metadata.
}
