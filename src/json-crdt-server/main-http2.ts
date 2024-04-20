// Run: npx ts-node src/json-crdt-server/main-http2.ts
// curl localhost:9999/rpc -H 'Content-Type: rpc.rx.compact.json' -d '[1,1,"util.ping"]'

import {createCaller} from './routes';
import {Services} from './services/Services';
import {Http2Server} from '../server/http2/Http2Server';

// export type JsonJoyDemoRpcCaller = ReturnType<typeof createCaller>['caller'];

const server = Http2Server.start({
  
}, 9999);
server.start();
