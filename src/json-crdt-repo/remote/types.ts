/**
 * A history of patches that have been applied to a model, stored in the
 * "remote" location, i.e. requires network communication to access. Can be
 * slow to access, or not accessible at all, depending on the network.
 * 
 * The `RemoteHistory` interface is a low-level interface that abstracts: (1)
 * a centra server; (2) un-fetched content addressable storage files; or (3) a
 * peer-to-peer network.
 * 
 * A *block* is a collaboratively edited document, which is a JSON-like object
 * that can be edited by multiple clients, it has a globally unique ID. A
 * *snapshot* of the block is a point-in-time representation of the block's
 * state. A *patch* is a change to the block's state. *History* is a sequence
 * of patches that have been applied to the block. The history can be applied
 * to a snapshot, hence one needs to keep track of the oldest snapshot from
 * which the history starts, or keep the history from the beginning of time.
 * 
 * The `Cursor` is any JSON-like serializable value. It can be a number, a string,
 * or even a list of logical timestamps. The cursor is used to identify the
 * position in the history of the block.
 * 
 * In a central server architecture, the cursor will typically be a number. In
 * content addressable storage, the cursor will also a number or a hash of the
 * block's state. In a peer-to-peer network, the cursor will be a list of logical
 * timestamps, which represent the latest logical clock values of all peers.
 * 
 * The higher levels should treat the cursor as `unknown` and only pass it to the
 * `RemoteHistory` methods without modifying it.
 */
export interface RemoteHistory<Cursor, M extends RemoteSnapshot = RemoteSnapshot, P extends RemotePatch = RemotePatch> {
  /**
   * Load the latest snapshot of the block, and any unmerged "tip" of patches
   * it might have.
   */
  read(id: string): Promise<{cursor: Cursor; model: M; patches: P[]}>;

  /**
   * Load block history going forward from the given cursor. This method is
   * useful to fetch the latest patches that have been applied to the block
   * by other clients.
   *
   * @param id ID of the block.
   * @param cursor The cursor to start scanning from.
   */
  scanFwd(id: string, cursor: Cursor): Promise<{cursor: Cursor; patches: P[]}>;

  /**
   * Load past history of the block going backwards from the given cursor.
   * This method is useful to fetch the patches that have been applied to the
   * block in the past, to show the user the history of changes.
   *
   * @param id ID of the block.
   * @param cursor The cursor until which to scan.
   */
  scanBwd(id: string, cursor: Cursor): Promise<{cursor: Cursor; model: M; patches: P[]}>;

  /**
   * Create a new block with the given patches.
   *
   * @param id A unique ID for the block.
   * @param patches A list of patches, which constitute the initial state of the block.
   */
  create(id: string, patches: RemotePatch[]): Promise<void>;

  /**
   * Update the block with the given patches.
   *
   * @param id ID of the block.
   * @param cursor The cursor of the last known model state of the block.
   * @param patches A list of patches to apply to the block.
   */
  update(id: string, cursor: Cursor, patches: RemotePatch[]): Promise<{cursor: Cursor; patches: P[]}>;

  /**
   * Delete the block.
   *
   * @param id ID of the block.
   */
  delete?(id: string): Promise<void>;

  /**
   * Subscribe to the latest changes for a block.
   *
   * @param callback
   */
  listen(id: string, cursor: Cursor, callback: (patches: P[]) => void): void;
}

export interface RemoteBlock {
  id: string;
  created: number;
  latest: RemoteSnapshot;
  tip: RemotePatch[];
}

export interface RemoteSnapshot {
  blob: Uint8Array;
}

export interface RemotePatch {
  blob: Uint8Array;
}
