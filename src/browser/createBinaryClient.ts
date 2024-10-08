import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {RpcCodec} from '../common/codec/RpcCodec';
import {BinaryRpcMessageCodec} from '../common/codec/binary';
import {createClient} from './createClient';

/**
 * Constructs a JSON Reactive RPC client.
 *
 * ```typescript
 * const client = createBinaryClient('wss://api.host.com', 'token');
 * ```
 *
 * @param url RPC endpoint.
 * @param token Authentication token.
 * @returns An RPC client.
 */
export const createBinaryClient = (url: string, token?: string) => {
  const writer = new Writer(1024 * 4);
  const msg = new BinaryRpcMessageCodec();
  const req = new CborJsonValueCodec(writer);
  const codec = new RpcCodec(msg, req, req);
  return createClient(codec, url, token);
};
