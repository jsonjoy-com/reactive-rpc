import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {RpcPersistentClient} from '../common/rpc/RpcPersistentClient';
import {WebSocketChannel} from '../common/channel/channel';
import {RpcCodec} from '../common/codec/RpcCodec';
import {BinaryRpcMessageCodec} from '../common/codec/binary';

/**
 * Constructs a JSON Reactive RPC client.
 *
 * ```typescript
 * const client = createJsonWsRpcClient('wss://api.host.com', 'token');
 * ```
 *
 * @param url RPC endpoint.
 * @param token Authentication token.
 * @returns An RPC client.
 */
export const createBinaryWsRpcClient = (url: string, token?: string) => {
  const writer = new Writer(1024 * 4);
  const msg = new BinaryRpcMessageCodec();
  const req = new CborJsonValueCodec(writer);
  const codec = new RpcCodec(msg, req, req);
  const protocols: string[] = [codec.specifier()];
  if (token) protocols.push(token);
  const client = new RpcPersistentClient({
    codec,
    channel: {
      newChannel: () =>
        new WebSocketChannel({
          newSocket: () => new WebSocket(url, protocols),
        }),
    },
  });
  client.start();
  return client;
};
