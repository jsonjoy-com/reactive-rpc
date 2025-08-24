import {RpcMessageFormat} from '../constants';
import {stringify, parse} from '@jsonjoy.com/json-pack/lib/json-binary';
import type {MsgCodec, MsgStreamCodec} from '../types';
import type * as types from './types';

type Chunk = string;
type Message = types.CompactMessage;

export class CompactMsgStreamCodec implements MsgCodec<Chunk, Message> {
  id = 'rx.compact';
  format = RpcMessageFormat.Compact;

  public toChunk(messages: Message[]): Chunk {
    return stringify(messages);
  }

  public fromChunk(chunk: Chunk): Message[] {
    return parse(chunk) as Message[];
  }
}
