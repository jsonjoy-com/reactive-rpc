import {RpcMessageStreamProcessor} from '../RpcMessageStreamProcessor';
import {RpcMessageStreamProcessorLocalClient} from '../RpcMessageStreamProcessorLocalClient';
import {ApiRpcCaller} from '../caller/ApiRpcCaller';
import {runApiTests} from './runApiTests';
import {sampleApi} from './sample-api';

const setup = () => {
  const server = new RpcMessageStreamProcessor<any>({
    send: (messages: unknown) => {},
    caller: new ApiRpcCaller<any, any>({
      api: sampleApi,
    }),
    bufferSize: 2,
    bufferTime: 1,
  });
  const client = new RpcMessageStreamProcessorLocalClient({
    ctx: {},
    server,
  });

  return {
    server,
    client,
  };
};

runApiTests(() => {
  const client = setup().client;
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = client.stop.bind(client);
  return {
    call,
    call$,
    stop,
    client: {call, call$, stop},
  };
});
