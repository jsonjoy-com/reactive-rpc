import {Value as V} from 'json-joy/lib/json-type-value/Value';
import type {Type} from 'json-joy/lib/json-type';

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
