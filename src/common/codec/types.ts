import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {RpcMessage} from '../messages';
import type {RpcMessageFormat} from './constants';
// import type {CompactMessage} from './compact';

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

// export interface MessageStreamWriter {
//   id: string;
//   format: RpcMessageFormat;

//   // encodeMessage(codec: JsonValueCodec, message: Message): void;
//   // encodeMessages(codec: JsonValueCodec, batch: Message[]): void;
//   // encode(codec: JsonValueCodec, batch: Message[]): Uint8Array;
//   // decodeBatch(codec: JsonValueCodec, uint8: Uint8Array): Message[];
// }

// export type CompactMessageCodec = MessageCodec<CompactMessage>;

// export interface RpcMessageCodec {
//   id: string;
//   format: RpcMessageFormat;
//   encodeMessage(jsonCodec: JsonValueCodec, message: RpcMessage): void;
//   encodeBatch(jsonCodec: JsonValueCodec, batch: RpcMessage[]): void;
//   encode(jsonCodec: JsonValueCodec, batch: RpcMessage[]): Uint8Array;
//   decodeBatch(jsonCodec: JsonValueCodec, uint8: Uint8Array): RpcMessage[];
// }
