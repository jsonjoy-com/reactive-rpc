// Run: npx ts-node src/json-crdt-server/main-http1.ts
// curl localhost:9999/rpc -H 'Content-Type: rpc.rx.compact.json' -d '[1,1,"util.ping"]'

import {createCaller} from './routes';
import {Services} from './services/Services';
import {RpcServer} from '../../server/http1/RpcServer';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const server = RpcServer.startWithDefaults({
  port: 9999,
  caller: createCaller(new Services()).caller,
  logger: console,
});
