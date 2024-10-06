import type {ObjectType, TypeSystem} from '@jsonjoy.com/json-type';
import type {ObjectValue} from '@jsonjoy.com/json-type/lib/value/ObjectValue';
import type {TypeBuilder} from '@jsonjoy.com/json-type/lib/type/TypeBuilder';
import type {Services} from '../services/Services';

export interface RouteDeps {
  services: Services;
  system: TypeSystem;
  t: TypeBuilder;
  router: ObjectValue<any>;
}

export type RouterBase = ObjectType<any>;
export type Router<R extends RouterBase> = ObjectValue<R>;
