import {stringify, parse} from '@jsonjoy.com/json-pack/lib/json-binary';
import {RpcMessageFormat} from './constants';
import {toMessage} from './compact/toMessage';
import type {RpcMessage} from '../messages';
import type {TextMsgCodec} from "./types";
import type {CompactMessage} from './compact';

type Chunk = string;

export class JsonCompactMsgCodec implements TextMsgCodec<RpcMessage> {
  id = 'binary-json-compact-lite';
  format = RpcMessageFormat.Compact;

  toChunk(messages: RpcMessage[]): Chunk {
    const json: CompactMessage[] = [];
    const length = messages.length;
    for (let i = 0; i < length; i++) json.push(messages[i].toCompact());
    return stringify(json);
  }

  fromChunk(chunk: Chunk): RpcMessage[] {
    const json = parse(chunk) as any[];
    return json.map((compact: any) => toMessage(compact));
  }
}
