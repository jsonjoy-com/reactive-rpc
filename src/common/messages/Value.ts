import {Value as V} from '@jsonjoy.com/json-type/lib/value/Value';
import type {Type} from '@jsonjoy.com/json-type';

/**
 * @deprecated Use `Value` directly.
 */
export class RpcValue<V = unknown> extends V<any> {
  constructor(
    public data: V,
    public type: Type | undefined,
  ) {
    super(type, data);
  }
}
