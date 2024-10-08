import {RpcPersistentClient} from '../common/rpc/RpcPersistentClient';
import {WebSocketChannel} from '../common/channel/channel';
import type {RpcCodec} from '../common/codec/RpcCodec';

/**
 * Constructs a {@link RpcPersistentClient} with the given codec.
 *
 * ```typescript
 * const client = createRpcPersistentClient(codec, 'wss://api.host.com', 'token');
 * ```
 *
 * @param codec RPC codec.
 * @param url RPC endpoint.
 * @param token Authentication token.
 * @returns An RPC client.
 */
export const createClient = (codec: RpcCodec, url: string, token?: string) => {
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
