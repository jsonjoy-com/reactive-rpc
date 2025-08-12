import {RpcMessageBatchProcessor} from '../../RpcMessageBatchProcessor';
import {runApiTests} from '../../__tests__/runApiTests';
import {sampleApi} from '../../__tests__/sample-api';
import {ApiRpcCaller} from '../../caller/ApiRpcCaller';
import {StaticRpcClient} from '../StaticRpcClient';

const setup = () => {
  const ctx = {ip: '127.0.0.1'};
  const server = new RpcMessageBatchProcessor<any>({
    caller: new ApiRpcCaller<any, any>({
      api: sampleApi,
    }),
  });
  const client = new StaticRpcClient({
    send: async (messages) => await server.onBatch(messages as any, ctx),
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
