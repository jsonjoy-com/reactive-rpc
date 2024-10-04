import {RpcError, type RpcErrorCodes, type RpcErrorValue} from './RpcError';
import {RpcValue} from '../../../messages/Value';
import {RpcErrorType} from './RpcErrorType';

/**
 * @protected
 *
 * Do not import from this module on the client side. It will import the whole
 * `json-type` and `json-expression` libraries, due to `t` builder.
 */

export class TypedRpcError {
  public static value(error: RpcError): RpcErrorValue {
    return new RpcValue(error, RpcErrorType);
  }

  public static valueFrom(error: unknown, def = TypedRpcError.internalErrorValue(error)): RpcErrorValue {
    if (error instanceof RpcValue && error.data instanceof RpcError && error.type === RpcErrorType) return error;
    if (error instanceof RpcError) return TypedRpcError.value(error);
    return def;
  }

  public static valueFromCode(errno: RpcErrorCodes, message?: string): RpcErrorValue {
    return TypedRpcError.value(RpcError.fromCode(errno, message));
  }

  public static internalErrorValue(originalError: unknown): RpcErrorValue {
    return TypedRpcError.value(RpcError.internal(originalError));
  }
}
