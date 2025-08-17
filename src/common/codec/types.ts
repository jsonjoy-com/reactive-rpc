import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {RpcMessage} from '../messages';
import type {RpcMessageFormat} from './constants';

export interface MsgCodec<Chunk> {
  id: string;
  format: RpcMessageFormat;
  toChunk(messages: RpcMessage[]): Chunk;
  fromChunk(chunk: Chunk): RpcMessage[];
}

export type TextMsgCodec = MsgCodec<string>;
export type BinaryMsgCodec = MsgCodec<Uint8Array>;


export interface MsgStreamCodec {
  id: string;
  format: RpcMessageFormat;
  write(codec: JsonValueCodec, message: RpcMessage): void;
  writeBatch(codec: JsonValueCodec, messages: RpcMessage[]): void;
  encode(jsonCodec: JsonValueCodec, batch: RpcMessage[]): Uint8Array;
  read(codec: JsonValueCodec): RpcMessage[];
  readChunk(codec: JsonValueCodec, uint8: Uint8Array): RpcMessage[];
}
