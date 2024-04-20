// Run: npx ts-node src/json-crdt-server/main-uws.ts
// curl localhost:9999/rpc -H 'Content-Type: rpc.rx.compact.json' -d '[1,1,"util.ping"]'

import {App} from 'uWebSockets.js';
import {RpcApp} from '../../server/uws/RpcApp';
import {createCaller} from './routes';
import {Services} from './services/Services';
import type {MyCtx} from './services/types';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const app = new RpcApp<MyCtx>({
  uws: App({}),
  caller: createCaller(new Services()).caller,
});
app.startWithDefaults();
