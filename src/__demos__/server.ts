// npx ts-node src/reactive-rpc/__demos__/server.ts
// curl localhost:9999/rpc -H 'Content-Type: rpc.rx.compact.json' -d '[1,1,"ping"]'

import {App} from 'uWebSockets.js';
import {createCaller} from '../common/rpc/__tests__/sample-api';
import {RpcApp} from '../server/uws/RpcApp';

const app = new RpcApp({
  uws: App({}),
  caller: createCaller(),
});

app.startWithDefaults();
