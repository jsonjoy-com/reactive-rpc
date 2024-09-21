import WebSocket from 'ws';
import {RpcCodec} from '../../common/codec/RpcCodec';
import {RpcPersistentClient, StreamingRpcClient, WebSocketChannel} from '../../common';
import {FetchRpcClient} from '../../common/rpc/client/FetchRpcClient';

const host = '54.204.106.133';

export const setupDemoServerPersistentClient = (codec: RpcCodec) => {
  const url = `ws://${host}/rpc`;
  const client = new RpcPersistentClient({
    codec,
    channel: {
      newChannel: () =>
        new WebSocketChannel({
          newSocket: () => new WebSocket(url, [codec.specifier()]) as any,
        }),
    },
  });
  client.start();
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async () => void client.stop();
  return {client, call, call$, stop};
};

export const setupDemoServerFetchClient = (codec: RpcCodec) => {
  const url = `http://${host}/rpc`;
  const client = new FetchRpcClient({
    url,
    msgCodec: codec.msg,
    reqCodec: codec.req,
    resCodec: codec.res,
  });
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async () => void client.stop();
  return {client, call, call$, stop};
};

export const setupDemoServerStreamingClient = (codec: RpcCodec) => {
  const protocolSpecifier = codec.specifier();
  const contentType = 'application/x.' + protocolSpecifier;
  const client = new StreamingRpcClient({
    send: async (messages) => {
      const port = +(process.env.PORT || 9999);
      const url = `http://${host}/rpc`;
      codec.req.encoder.writer.reset();
      codec.msg.encodeBatch(codec.req, messages);
      const body = codec.req.encoder.writer.flush();
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
          body,
        });
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        const responseMessages = codec.msg.decodeBatch(codec.res, data);
        client.onMessages(responseMessages as any);
      } catch (err) {
        // tslint:disable-next-line:no-console
        console.error(err);
      }
    },
  });
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async () => void client.stop();
  return {client, call, call$, stop};
};
