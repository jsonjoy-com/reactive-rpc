import type {RpcCodec} from '../../codec/RpcCodec';

export interface ConnectionContext<Meta = Record<string, unknown>> {
  path: string;
  query: string;
  ip: string;
  token: string;
  params: string[] | null;
  meta: Meta;
  codec: RpcCodec;
}
