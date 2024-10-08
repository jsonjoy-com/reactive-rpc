import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {RpcMessageCodec} from '../common/codec/types';

export interface ConnectionContext<Meta = Record<string, unknown>> {
  /**
   * Random connection ID. A 32-bit unsigned integer. Can be used to identify a
   * connection, such as socket ID. For example, to not send back own messages.
   */
  id: number;
  path: string;
  query: string;
  ip: string;
  token: string;
  params: string[] | null;
  meta: Meta;
  reqCodec: JsonValueCodec;
  resCodec: JsonValueCodec;
  msgCodec: RpcMessageCodec;
}
