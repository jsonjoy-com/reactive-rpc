import type {CompactMessageType} from './constants';

/** Must be positive integer. */
export type Id = number;

/** Must be non-empty string, no longer than 128 characters. */
export type Name = string;

export type CompactNotificationMessage<Data = unknown> =
  | [CompactMessageType.Notification, Name]
  | [CompactMessageType.Notification, Name, Data];

export type CompactRequestDataMessage<Data = unknown> =
  | [CompactMessageType.RequestData, Id, Name]
  | [CompactMessageType.RequestData, Id, Name, Data];
export type CompactRequestCompleteMessage<Data = unknown> =
  | [CompactMessageType.RequestComplete, Id, Name]
  | [CompactMessageType.RequestComplete, Id, Name, Data];
export type CompactRequestErrorMessage<Data = unknown> = [CompactMessageType.RequestError, Id, Name, Data];
export type CompactRequestUnsubscribeMessage = [CompactMessageType.RequestUnsubscribe, Id];

export type CompactResponseDataMessage<Data = unknown> = [CompactMessageType.ResponseData, Id, Data];
export type CompactResponseCompleteMessage<Data = unknown> =
  | [CompactMessageType.ResponseComplete, Id]
  | [CompactMessageType.ResponseComplete, Id, Data];
export type CompactResponseErrorMessage<Data = unknown> = [CompactMessageType.ResponseError, Id, Data];
export type CompactResponseUnsubscribeMessage = [CompactMessageType.ResponseUnsubscribe, Id];

export type CompactClientMessage<Data = unknown> =
  | CompactNotificationMessage<Data>
  | CompactRequestDataMessage<Data>
  | CompactRequestCompleteMessage<Data>
  | CompactRequestErrorMessage<Data>
  | CompactResponseUnsubscribeMessage;

  export type CompactServerMessage<Data = unknown> =
  | CompactNotificationMessage<Data>
  | CompactResponseDataMessage<Data>
  | CompactResponseCompleteMessage<Data>
  | CompactResponseErrorMessage<Data>
  | CompactRequestUnsubscribeMessage;

export type CompactMessage<Data = unknown> =
  | CompactClientMessage<Data>
  | CompactServerMessage<Data>;

export type CompactMessageBatch = (CompactMessage | CompactMessageBatch)[];
