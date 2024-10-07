// Run: npx ts-node src/json-crdt-server/main-http1.ts
// curl localhost:9999/rpc -d '{"method": "util.ping", "id": 0}'
// curl localhost:9999/rx -d '[1,1,"util.ping"]'

import {createCaller, createServices} from './routes';
import {RpcServer} from '../../server/http1/RpcServer';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const main = async () => {
  const services = await createServices();
  const server = await RpcServer.startWithDefaults({
    port: +(process.env.PORT || 9999),
    caller: createCaller(services).caller,
    logger: console,
  });

  // tslint:disable-next-line:no-console
  console.log(server + '');
};

// tslint:disable-next-line no-console
main().catch(console.error);
