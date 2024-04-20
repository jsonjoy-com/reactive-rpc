// npx ts-node src/__demos__/sample-api/main-http1.ts
// curl localhost:9999/rpc -H 'Content-Type: rpc.rx.compact.json' -d '[1,1,"ping"]'

import {createCaller} from '../../common/rpc/__tests__/sample-api';
import {RpcServer} from '../../server/http1/RpcServer';

const server = RpcServer.startWithDefaults({
  port: 9999,
  caller: createCaller(),
  logger: console,
});

// tslint:disable-next-line no-console
console.log(server + '');
