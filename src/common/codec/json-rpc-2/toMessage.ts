import {RpcError} from '../../error';
import {unknown} from '../../messages/unknown';
import * as msg from '../../messages';
import type * as schema from './schema';

export const toMessage = (message: schema.JsonRpc2Message): msg.RpcMessage => {
  if (!message || typeof message !== 'object') throw RpcError.badRequest();
  if ((message as any).id === undefined) {
    const notification = message as schema.JsonRpc2NotificationMessage;
    const data = notification.params;
    const value = unknown(data);
    return new msg.NotificationMessage(notification.method, value);
  }
  if (typeof (message as schema.JsonRpc2RequestMessage).method === 'string') {
    const request = message as schema.JsonRpc2RequestMessage;
    const data = request.params;
    const value = data === undefined ? undefined : unknown(request.params);
    if (typeof request.id !== 'number') throw RpcError.badRequest();
    return new msg.RequestCompleteMessage(request.id, request.method, value);
  }
  if ((message as schema.JsonRpc2ResponseMessage).result !== undefined) {
    const response = message as schema.JsonRpc2ResponseMessage;
    if (typeof response.id !== 'number') throw RpcError.badRequest();
    const data = response.result;
    const value = data === undefined ? undefined : unknown(response.result);
    return new msg.ResponseCompleteMessage(response.id, value);
  }
  if ((message as schema.JsonRpc2ErrorMessage).error !== undefined) {
    const response = message as schema.JsonRpc2ErrorMessage;
    const value = unknown(response.error.data);
    if (typeof response.id !== 'number') throw RpcError.badRequest();
    return new msg.ResponseErrorMessage(response.id, value);
  }
  throw RpcError.badRequest();
};
