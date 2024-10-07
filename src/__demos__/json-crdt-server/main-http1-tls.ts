// Run: npx ts-node src/__demos__/json-crdt-server/main-http1-tls.ts
// curl https://localhost/rx --insecure -d '[1,1,"util.ping"]'

import type * as tls from 'tls';
import * as fs from 'fs';
import {createCaller, createServices} from './routes';
import {RpcServer} from '../../server/http1/RpcServer';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const main = async () => {
  const secureContext = async (): Promise<tls.SecureContextOptions> => {
    return {
      key: await fs.promises.readFile(__dirname + '/../../__tests__/certs/server.key'),
      cert: await fs.promises.readFile(__dirname + '/../../__tests__/certs/server.crt'),
    };
  };

  const services = await createServices();
  const server = await RpcServer.startWithDefaults({
    create: {
      tls: true,
      secureContext,
      secureContextRefreshInterval: 1000 * 60 * 60 * 24,
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
