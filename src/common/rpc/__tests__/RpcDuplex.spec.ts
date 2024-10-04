import {RpcMessageStreamProcessor} from '../RpcMessageStreamProcessor';
import {StreamingRpcClient} from '../client/StreamingRpcClient';
import {RpcDuplex} from '../RpcDuplex';
import {ApiRpcCaller} from '../caller/ApiRpcCaller';
import {sampleApi} from './sample-api';
import {type ApiTestSetup, runApiTests} from './runApiTests';

const setup = () => {
  const server = new RpcDuplex({
    client: new StreamingRpcClient({
      send: (messages) => {
        setTimeout(() => {
          client.onMessages(messages, {ip: '127.0.0.1'});
        }, 1);
      },
      bufferSize: 2,
      bufferTime: 1,
    }),
    server: new RpcMessageStreamProcessor<any>({
      send: (messages: any) => {
        setTimeout(() => {
          client.onMessages(messages, {ip: '127.0.0.1'});
        }, 1);
      },
      caller: new ApiRpcCaller<any, any>({
        api: sampleApi,
      }),
      bufferSize: 2,
      bufferTime: 1,
    }),
  });
  const client = new RpcDuplex({
    client: new StreamingRpcClient({
      send: (messages) => {
        setTimeout(() => {
          server.onMessages(messages, {ip: '127.0.0.1'});
        }, 1);
      },
      bufferSize: 2,
      bufferTime: 1,
    }),
    server: new RpcMessageStreamProcessor<any>({
      send: (messages: any) => {
        setTimeout(() => {
          server.onMessages(messages, {ip: '127.0.0.1'});
        }, 1);
      },
      caller: new ApiRpcCaller<any, any>({
        api: sampleApi,
      }),
      bufferSize: 2,
      bufferTime: 1,
    }),
  });
  return {server, client};
};

const setup1: ApiTestSetup = () => {
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
};
const setup2: ApiTestSetup = () => {
  const client = setup().server;
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = async () => void client.stop.bind(client);
  return {
    call,
    call$,
    stop,
    client: {call, call$, stop},
  };
};

describe('duplex 1', () => {
  runApiTests(setup1);
});

describe('duplex 2', () => {
  runApiTests(setup2);
});
