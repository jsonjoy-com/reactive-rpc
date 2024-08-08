import type {AbstractBatchOperation, AbstractLevel} from 'abstract-level';
import type {BlockId} from '../types';
import {ServerBatch} from '../../remote/types';

export type BinStrLevel = AbstractLevel<any, string, Uint8Array>;
export type BinStrLevelOperation = AbstractBatchOperation<BinStrLevel, string, Uint8Array>;

export type BlockModelValue = [
  meta: BlockModelMetadata,
  model: Uint8Array,
];

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
   * Number of batches to keep in the local history. If not specified, some
   * default history length will be used.
   */
  hist?: number;
}

export interface CrudLocalRepoCipher {
  encrypt(plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array): Promise<Uint8Array>;
}

export type SyncResult = [block: BlockId, success: boolean, err?: Error | unknown];

export type LocalBatch = ServerBatch;
