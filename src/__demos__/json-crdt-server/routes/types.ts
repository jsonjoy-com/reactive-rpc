import type {ObjType, ModuleType} from '@jsonjoy.com/json-type';
import type {ObjValue} from '@jsonjoy.com/json-type/lib/value/ObjValue';
import type {TypeBuilder} from '@jsonjoy.com/json-type/lib/type/TypeBuilder';
import type {Services} from '../services/Services';

export interface RouteDeps {
  services: Services;
  system: ModuleType;
  t: TypeBuilder;
  router: ObjValue<any>;
}

export type RouterBase = ObjType<any>;
export type Router<R extends RouterBase> = ObjValue<R>;
