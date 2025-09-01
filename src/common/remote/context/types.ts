import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {MsgStreamCodec} from '../../codec/types';

export interface ConnectionContext<Meta = Record<string, unknown>> {
  path: string;
  query: string;
  ip: string;
  token: string;
  params: string[] | null;
  meta: Meta;
  reqCodec: JsonValueCodec;
  resCodec: JsonValueCodec;
  msgCodec: MsgStreamCodec;
}
