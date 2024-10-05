import WebSocket from 'ws';
import type {RpcCodec} from '../../common/codec/RpcCodec';
import {RpcPersistentClient, WebSocketChannel} from '../../common';
import {FetchRpcClient} from '../../common/rpc/client/FetchRpcClient';
import {StreamingRpcClient} from '../../common';

export const setupRpcPersistentClient = (codec: RpcCodec) => {
  const port = +(process.env.PORT || 9999);
  const url = `ws://localhost:${port}/rx`;
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

export const setupFetchRpcClient = (codec: RpcCodec) => {
  const port = +(process.env.PORT || 9999);
  const url = `http://localhost:${port}/rx`;
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

export const setupStreamingRpcClient = (codec: RpcCodec) => {
  const protocolSpecifier = codec.specifier();
  const contentType = 'application/x.' + protocolSpecifier;
  const client = new StreamingRpcClient({
    send: async (messages) => {
      const port = +(process.env.PORT || 9999);
      const url = `http://localhost:${port}/rx`;
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
