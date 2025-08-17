import {CompactMessageType} from '../codec/compact/constants';
import {validateId, validateMethod} from '../remote/validation';
import type * as cmsg from '../codec/compact/types';
import type {Value} from '@jsonjoy.com/json-type';
import type {Message} from './types';

// /**
//  * @category Message
//  */
export class NotificationMessage implements Message {
  constructor(
    public readonly method: string,
    public value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactNotificationMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.Notification, this.method]
      : [CompactMessageType.Notification, this.method, value.data];
  }

  public validate(): void {
    validateMethod(this.method);
  }
}

/**
 * @category Message
 */
export class RequestDataMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactRequestDataMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.RequestData, this.id, this.method]
      : [CompactMessageType.RequestData, this.id, this.method, value.data];
  }

  public validate(): void {
    validateId(this.id);
    if (this.method) validateMethod(this.method);
  }
}

/**
 * @category Message
 */
export class RequestCompleteMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactRequestCompleteMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.RequestComplete, this.id, this.method]
      : [CompactMessageType.RequestComplete, this.id, this.method, value.data];
  }

  public validate(): void {
    validateId(this.id);
    if (this.method) validateMethod(this.method);
  }
}

/**
 * @category Message
 */
export class RequestErrorMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public value: Value,
  ) {}

  public toCompact(): cmsg.CompactRequestErrorMessage<unknown> {
    return [CompactMessageType.RequestError, this.id, this.method, this.value.data];
  }

  public validate(): void {
    validateId(this.id);
    if (this.method) validateMethod(this.method);
  }
}

/**
 * @category Message
 */
export class RequestUnsubscribeMessage implements Message {
  constructor(public readonly id: number) {}

  public toCompact(): cmsg.CompactRequestUnsubscribeMessage {
    return [CompactMessageType.RequestUnsubscribe, this.id];
  }

  // public validate(): void {
  //   validateId(this.id);
  // }
}

/**
 * @category Message
 */
export class ResponseCompleteMessage implements Message {
  constructor(
    public readonly id: number,
    public value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactResponseCompleteMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.ResponseComplete, this.id]
      : [CompactMessageType.ResponseComplete, this.id, value.data];
  }

  public validate(): void {
    validateId(this.id);
  }
}

/**
 * @category Message
 */
export class ResponseDataMessage implements Message {
  constructor(
    public readonly id: number,
    public value: Value,
  ) {}

  public toCompact(): cmsg.CompactResponseDataMessage<unknown> {
    return [CompactMessageType.ResponseData, this.id, this.value.data];
  }

  public validate(): void {
    validateId(this.id);
  }
}

/**
 * @category Message
 */
export class ResponseErrorMessage implements Message {
  constructor(
    public readonly id: number,
    public value: Value,
  ) {}

  public toCompact(): cmsg.CompactResponseErrorMessage<unknown> {
    return [CompactMessageType.ResponseError, this.id, this.value.data];
  }

  public validate(): void {
    validateId(this.id);
  }
}

/**
 * @category Message
 */
export class ResponseUnsubscribeMessage implements Message {
  constructor(public readonly id: number) {}

  public toCompact(): cmsg.CompactResponseUnsubscribeMessage {
    return [CompactMessageType.ResponseUnsubscribe, this.id];
  }

  public validate(): void {
    validateId(this.id);
  }
}
