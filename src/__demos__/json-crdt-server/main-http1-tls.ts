// Run: npx ts-node src/__demos__/json-crdt-server/main-http1-tls.ts
// curl https://localhost/rx --insecure -d '[1,1,"util.ping"]'

import {createCaller, createServices} from './routes';
import {RpcServer} from '../../server/http1/RpcServer';
import * as fs from 'fs';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const main = async () => {
  const services = await createServices();
  const server = RpcServer.startWithDefaults({
    create: {
      tls: true,
      conf: {
        key: fs.readFileSync(__dirname + '/../../__tests__/certs/server.key'),
        cert: fs.readFileSync(__dirname + '/../../__tests__/certs/server.crt'),
      },
    },
    port: +(process.env.PORT || 443),
    caller: createCaller(services).caller,
    logger: console,
  });

  // tslint:disable-next-line:no-console
  console.log(server + '');
};

// tslint:disable-next-line no-console
main().catch(console.error);
