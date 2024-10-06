import {routes} from './routes';
import {RpcError} from '../../../common/rpc/caller';
import {RpcValue} from '../../../common/messages/Value';
import {ObjectValueCaller} from '../../../common/rpc/caller/ObjectValueCaller';
import {system} from './system';
import {ObjectValue} from '@jsonjoy.com/json-type/lib/value/ObjectValue';
import {Services} from '../services/Services';
import {MemoryStore} from '../services/blocks/store/MemoryStore';
import {LevelStore} from '../services/blocks/store/level/LevelStore';
import {ClassicLevel} from 'classic-level';
import type {Store} from '../services/blocks/store/types';
import type {RouteDeps} from './types';
import {TypedRpcError} from '../../../common/rpc/caller/error/typed';

export const createRouter = (services: Services) => {
  const router = ObjectValue.create(system);
  const deps: RouteDeps = {
    services,
    router,
    system,
    t: system.t,
  };
  return routes(deps)(router);
};

export const createCaller = (services: Services = new Services()) => {
  const router = createRouter(services);
  const caller = new ObjectValueCaller<typeof router>({
    router,
    wrapInternalError: (error: unknown) => {
      if (error instanceof RpcValue) return error;
      if (error instanceof RpcError) return TypedRpcError.value(error);
      // tslint:disable-next-line:no-console
      console.error(error);
      return TypedRpcError.valueFrom(error);
    },
  });
  return {router, caller, services};
};

export const createServices = async () => {
  let store: Store = new MemoryStore();
  if (process.env.JSON_CRDT_STORE === 'level') {
    const path = process.env.JSON_CRDT_STORE_PATH || './db';
    const kv = new ClassicLevel<string, Uint8Array>(path, {valueEncoding: 'view'});
    await kv.open();
    store = new LevelStore(<any>kv);
  }
  const services = new Services({store});
  return services;
};
