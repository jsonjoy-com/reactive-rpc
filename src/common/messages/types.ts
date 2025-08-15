import type {CompactMessage} from '../codec/compact';
import type {Type, Value} from '@jsonjoy.com/json-type';
import type * as msg from './messages';

/**
 * Messages that client can send.
 */
export type RpcClientMessage =
  | msg.NotificationMessage
  | msg.RequestDataMessage
  | msg.RequestCompleteMessage
  | msg.RequestErrorMessage
  | msg.ResponseUnsubscribeMessage;

/**
 * Messages with which server can respond.
 */
export type RpcServerMessage =
  | msg.ResponseDataMessage
  | msg.ResponseCompleteMessage
  | msg.ResponseErrorMessage
  | msg.RequestUnsubscribeMessage;

/**
 * All Reactive RPC messages.
 */
export type RpcMessage = RpcClientMessage | RpcServerMessage;

export interface Message {
  value?: Value | undefined;
  /**
   * The type of the message `value`.
   */
  type?: Type | undefined;
  // validate(): void;
  toCompact(): CompactMessage<unknown>;
  // encodeBinary(codec: JsonValueCodec): void;
}
