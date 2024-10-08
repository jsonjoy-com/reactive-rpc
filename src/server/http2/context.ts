import type * as http from 'http';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {RpcMessageCodec} from '../../common/codec/types';
import type {ConnectionContext} from '../types';

export class Http2ConnectionContext<Meta = Record<string, unknown>> implements ConnectionContext<Meta> {
  constructor(
    public readonly req: http.IncomingMessage,
    public readonly res: http.ServerResponse,
    public path: string,
    public query: string,
    public readonly ip: string,
    public token: string,
    public readonly params: string[] | null,
    public readonly meta: Meta,
    public reqCodec: JsonValueCodec,
    public resCodec: JsonValueCodec,
    public msgCodec: RpcMessageCodec,
  ) {}

  public async body(): Promise<Uint8Array> {
    throw new Error('not implemented');
  }
}
