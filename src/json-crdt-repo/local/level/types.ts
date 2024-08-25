import type {AbstractBatchOperation, AbstractLevel} from 'abstract-level';
import type {BlockId} from '../types';
import type {ServerBatch, ServerSnapshot} from '../../remote/types';
import type {PubSub} from '../../pubsub';

export type BinStrLevel = AbstractLevel<any, string, Uint8Array>;
export type BinStrLevelOperation = AbstractBatchOperation<BinStrLevel, string, Uint8Array>;

export type BlockModelValue = [meta: BlockModelMetadata, model: Uint8Array];

export type BlockModelMetadata = [
  /**
   * The batch sequence number which the model is at.
   */
  seq: number,
];

export interface BlockMetaValue {
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
   * Whether to track the history of the block. By default the block will
   * store only the latest state model. If history tracking is enabled to block
   * will store historic batches and the starting snapshot model, from
   * which to apply the batches.
   */
  hist?: boolean;
}

export interface CrudLocalRepoCipher {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

export type SyncResult = [block: BlockId, success: boolean, err?: Error | unknown];

export type LocalBatch = ServerBatch;
export type LocalSnapshot = ServerSnapshot;

export type LevelLocalRepoPubSub = PubSub<LevelLocalRepoPubSubMessage>;

export type LevelLocalRepoPubSubMessage =
  | LevelLocalRepoPubSubMessageRemoteReset
  | LevelLocalRepoPubSubMessageRemoteMerge
  | LevelLocalRepoPubSubMessageLocalRebase
  | LevelLocalRepoPubSubMessageDelete;

export interface LevelLocalRepoPubSubMessageRemoteReset {
  type: 'reset';
  id: BlockId;
  model: Uint8Array;
}

export interface LevelLocalRepoPubSubMessageRemoteMerge {
  type: 'merge';
  id: BlockId;
  patches: Uint8Array[];
}

export interface LevelLocalRepoPubSubMessageLocalRebase {
  type: 'rebase';
  id: BlockId;
  patches: Uint8Array[];
}

export interface LevelLocalRepoPubSubMessageDelete {
  type: 'del';
  id: BlockId;
}
