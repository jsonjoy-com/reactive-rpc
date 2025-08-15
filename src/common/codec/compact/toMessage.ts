import {CompactMessageType} from './constants';
import * as msg from '../../messages';
import type * as types from './types';
import {unknown} from '@jsonjoy.com/json-type';

export const toMessage = (arr: unknown | unknown[] | types.CompactMessage): msg.RpcMessage => {
  if (!(arr instanceof Array)) throw new Error('INV_MSG');
  const type = arr[0];
  switch (type) {
    case CompactMessageType.RequestComplete:
      return new msg.RequestCompleteMessage(arr[1], arr[2], arr[3] !== undefined ? unknown(arr[3]) : undefined);
    case CompactMessageType.RequestData:
      return new msg.RequestDataMessage(arr[1], arr[2], arr[3] !== undefined ? unknown(arr[3]) : undefined);
    case CompactMessageType.RequestError:
      return new msg.RequestErrorMessage(arr[1], arr[2], unknown(arr[3]));
    case CompactMessageType.RequestUnsubscribe:
      return new msg.RequestUnsubscribeMessage(arr[1]);
    case CompactMessageType.ResponseComplete:
      return new msg.ResponseCompleteMessage(arr[1], arr[2] !== undefined ? unknown(arr[2]) : undefined);
    case CompactMessageType.ResponseData:
      return new msg.ResponseDataMessage(arr[1], unknown(arr[2]));
    case CompactMessageType.ResponseError:
      return new msg.ResponseErrorMessage(arr[1], unknown(arr[2]));
    case CompactMessageType.ResponseUnsubscribe:
      return new msg.ResponseUnsubscribeMessage(arr[1]);
    case CompactMessageType.Notification:
      return new msg.NotificationMessage(arr[1], arr[2] !== undefined ? unknown(arr[2]) : undefined);
  }
  throw new Error('UNK_MSG');
};
