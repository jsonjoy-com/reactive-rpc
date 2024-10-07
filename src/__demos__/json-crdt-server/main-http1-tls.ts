// Run: npx ts-node src/__demos__/json-crdt-server/main-http1-tls.ts
// curl https://localhost/rx --insecure -d '[1,1,"util.ping"]'

import * as https from 'https';
import * as tls from 'tls';
import * as fs from 'fs';
import {createCaller, createServices} from './routes';
import {RpcServer} from '../../server/http1/RpcServer';

export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const main = async () => {
  const getSecureContext = (): tls.SecureContextOptions => {
    return {
      key: fs.readFileSync(__dirname + '/../../__tests__/certs/server.key'),
      cert: fs.readFileSync(__dirname + '/../../__tests__/certs/server.crt'),
    };
  };

  const services = await createServices();
  const server = RpcServer.startWithDefaults({
    create: {
      tls: true,
      conf: getSecureContext(),
    },
    port: +(process.env.PORT || 443),
    caller: createCaller(services).caller,
    logger: console,
  });

  const nodeServer = server.http1.server;
  if (nodeServer instanceof https.Server) {
    const onceADay = 1000 * 60 * 60 * 24;
    setInterval(() => {
      try {
        nodeServer.setSecureContext(getSecureContext());
      } catch (error) {
        console.error('Failed to update secure context:', error);
      }
    }, onceADay);
  }

  // tslint:disable-next-line:no-console
  console.log(server + '');
};

// tslint:disable-next-line no-console
main().catch(console.error);
