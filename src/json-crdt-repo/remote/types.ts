/**
 * A history of patches that have been applied to a model, stored on the
 * "remote": (1) server; (2) content addressable storage; or (3) somewhere in a
 * peer-to-peer network.
 */
export interface RemoteHistory<Cursor, M extends RemoteModel = RemoteModel, P extends RemotePatch = RemotePatch> {
  /**
   * Create a new block with the given patches.
   *
   * @param id A unique ID for the block.
   * @param patches A list of patches, which constitute the initial state of the block.
   */
  create(id: string, patches: RemotePatch[]): Promise<void>;

  /**
   * Load the latest model of the block, and any unmerged "tip" of patches
   * it might have.
   *
   * @todo Maybe `state` and `tip` should be serialized to JSON?
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

export interface RemoteModel {
  blob: Uint8Array;
}

export interface RemotePatch {
  blob: Uint8Array;
}
