import {MemoryLevel} from 'memory-level';
import {buildE2eClient} from '../../../common/testing/buildE2eClient';
import {createCaller} from '../routes';
import {LevelStore} from '../services/blocks/store/level/LevelStore';
import {Services} from '../services/Services';

export const setup = async () => {
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  });
  const store = new LevelStore(<any>kv);
  const services = new Services(store);
  const {caller} = createCaller(services);
  const {client} = buildE2eClient(caller, {
    writerDefaultBufferKb: [1, 32],
    clientBufferSize: [1, 3],
    clientBufferTime: [1, 10],
    serverBufferSize: [1, 3],
    serverBufferTime: [1, 10],
  });
  const call = client.call.bind(client);
  const call$ = client.call$.bind(client);
  const stop = () => {};
  return {call, call$, stop};
};

export type JsonCrdtTestSetup = typeof setup;
