import {RpcMessageStreamProcessor} from '../RpcMessageStreamProcessor';
import {StreamingRpcClient} from '../client/StreamingRpcClient';
import {ApiRpcCaller} from '../caller/ApiRpcCaller';
import {sampleApi} from './sample-api';
import {runApiTests} from './runApiTests';

const setup = () => {
  const ctx = {ip: '127.0.0.1'};
  const server = new RpcMessageStreamProcessor<any>({
    send: (messages: any) => {
      setTimeout(() => {
        client.onMessages(messages);
      }, 1);
    },
    caller: new ApiRpcCaller<any, any>({
      api: sampleApi,
    }),
    bufferSize: 2,
    bufferTime: 1,
  });
  const client = new StreamingRpcClient({
    send: (messages) => {
      setTimeout(() => {
        server.onMessages(messages, ctx);
      }, 1);
    },
    bufferSize: 2,
    bufferTime: 1,
  });
  return {server, client};
};

runApiTests(() => {
  const client = setup().client;
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async () => void client.stop.bind(client);
  return {
    call,
    call$,
    stop,
    client: {call, call$, stop},
  };
});
