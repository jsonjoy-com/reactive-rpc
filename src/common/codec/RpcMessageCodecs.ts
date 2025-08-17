import {BinaryMsgStreamCodec} from './binary/BinaryMsgStreamCodec';
import {CompactMsgStreamCodec} from './compact/CompactMsgStreamCodec';
import {JsonRpc2TypedMsgStreamCodec} from './json-rpc-2/JsonRpc2TypedMsgStreamCodec';
import type {MsgStreamCodec} from './types';

export class RpcMessageCodecs {
  binary: MsgStreamCodec;
  compact: MsgStreamCodec;
  jsonRpc2: MsgStreamCodec;

  constructor() {
    this.binary = new BinaryMsgStreamCodec();
    this.compact = new CompactMsgStreamCodec();
    this.jsonRpc2 = new JsonRpc2TypedMsgStreamCodec();
  }
}
