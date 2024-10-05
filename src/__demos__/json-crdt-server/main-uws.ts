// Run: npx ts-node src/json-crdt-server/main-uws.ts
// curl localhost:9999/rx -d '[1,1,"util.ping"]'

import {App} from 'uWebSockets.js';
import {RpcApp} from '../../server/uws/RpcApp';
import {createCaller, createServices} from './routes';
import type {MyCtx} from './services/types';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const main = async () => {
  const services = await createServices();
  const app = new RpcApp<MyCtx>({
    uws: App({}),
    caller: createCaller(services).caller,
    port: +(process.env.PORT || 9999),
  });
  app.startWithDefaults();

  // tslint:disable-next-line:no-console
  console.log(app + '');
};

// tslint:disable-next-line no-console
main().catch(console.error);
