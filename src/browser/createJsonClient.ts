import {JsonJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/json';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {RpcCodec} from '../common/codec/RpcCodec';
import {CompactRpcMessageCodec} from '../common/codec/compact';
import {createClient} from './createClient';

/**
 * Constructs a JSON Reactive RPC client.
 *
 * @param url RPC endpoint.
 * @param token Authentication token.
 * @returns An RPC client.
 */
export const createJsonClient = (url: string, token?: string) => {
  const writer = new Writer(1024 * 4);
  const msg = new CompactRpcMessageCodec();
  const req = new JsonJsonValueCodec(writer);
  const codec = new RpcCodec(msg, req, req);
  return createClient(codec, url, token);
};
