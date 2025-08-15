// import {BinaryMessageType} from '../codec/binary/constants';
// import {validateId, validateMethod} from '../remote/validation';
// import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
// import type {BinaryJsonEncoder} from '@jsonjoy.com/json-pack/lib/types';
// import type {Value} from '@jsonjoy.com/json-type/lib/value/Value';
// import type {Type} from '@jsonjoy.com/json-type';
import {CompactMessageType} from '../codec/compact/constants';
import type * as cmsg from '../codec/compact/types';
import type {Value} from '@jsonjoy.com/json-type';
import type {Message} from './types';

// const encodeHeader = (
//   writer: BinaryJsonEncoder['writer'],
//   typeU16: number,
//   id: number,
//   payloadSize: number,
//   start: number,
// ) => {
//   if (payloadSize <= 0b1111_11111111) {
//     const w1 = typeU16 | payloadSize;
//     const w2 = id;
//     writer.view.setUint32(start, (w1 << 16) | w2);
//   } else if (payloadSize <= 0b1111_11111111_1111111) {
//     writer.u8(id & 0xff);
//     const w1 = typeU16 | 0b000_1_0000_00000000 | (payloadSize >> 7);
//     const w2 = ((payloadSize & 0b0111_1111) << 8) | (id >> 8);
//     writer.view.setUint32(start, (w1 << 16) | w2);
//   } else {
//     writer.u16(id);
//     const w1 = typeU16 | 0b000_1_0000_00000000 | (payloadSize >> 15);
//     const w2 = 0b1000_0000_00000000 | (payloadSize & 0b0111_1111_11111111);
//     writer.view.setUint32(start, (w1 << 16) | w2);
//   }
// };

// const encodeBinaryWithNameAndPayload = (
//   codec: JsonValueCodec,
//   typeU16: number,
//   id: number,
//   name: string,
//   value: Value<any> | undefined,
// ) => {
//   const writer = codec.encoder.writer;
//   const nameLength = name.length;
//   writer.ensureCapacity(5 + nameLength);
//   writer.uint8[writer.x + 4] = nameLength;
//   writer.x += 5;
//   writer.ascii(name);
//   const x0 = writer.x0;
//   const x = writer.x;
//   if (value) value.encode(codec);
//   const shift = writer.x0 - x0;
//   const payloadStart = x + shift;
//   const start = payloadStart - 5 - nameLength;
//   const payloadSize = writer.x - payloadStart;
//   encodeHeader(writer, typeU16, id, payloadSize, start);
// };

// const encodeBinaryWithPayload = (
//   codec: JsonValueCodec,
//   typeU16: number,
//   id: number,
//   value: Value<any> | undefined,
// ) => {
//   const writer = codec.encoder.writer;
//   writer.move(4);
//   const x0 = writer.x0;
//   const x = writer.x;
//   if (value) {
//     value.encode(codec);
//   }
//   const shift = writer.x0 - x0;
//   const payloadStart = x + shift;
//   const start = payloadStart - 4;
//   const payloadSize = writer.x - payloadStart;
//   encodeHeader(writer, typeU16, id, payloadSize, start);
// };

// /**
//  * @category Message
//  */
export class NotificationMessage implements Message {
  constructor(
    public readonly method: string,
    public readonly value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactNotificationMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.Notification, this.method]
      : [CompactMessageType.Notification, this.method, value.data];
  }

  // public validate(): void {
  //   validateMethod(this.method);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   const writer = codec.encoder.writer;
  //   const name = this.method;
  //   const nameLength = name.length;
  //   writer.move(4);
  //   writer.ascii(name);
  //   const x0 = writer.x0;
  //   const x = writer.x;
  //   this.value.encode(codec);
  //   const shift = writer.x0 - x0;
  //   const payloadStart = x + shift;
  //   const start = payloadStart - 4 - nameLength;
  //   const payloadSize = writer.x - payloadStart;
  //   writer.view.setUint32(start, (payloadSize << 8) + nameLength);
  // }
}

/**
 * @category Message
 */
export class RequestDataMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public readonly value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactRequestDataMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.RequestData, this.id, this.method]
      : [CompactMessageType.RequestData, this.id, this.method, value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  //   if (this.method) validateMethod(this.method);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithNameAndPayload(codec, BinaryMessageType.RequestData << 13, this.id, this.method, this.value);
  // }
}

/**
 * @category Message
 */
export class RequestCompleteMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public readonly value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactRequestCompleteMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.RequestComplete, this.id, this.method]
      : [CompactMessageType.RequestComplete, this.id, this.method, value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  //   if (this.method) validateMethod(this.method);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithNameAndPayload(codec, BinaryMessageType.RequestComplete << 13, this.id, this.method, this.value);
  // }
}

/**
 * @category Message
 */
export class RequestErrorMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly method: string,
    public readonly value: Value,
  ) {}

  public toCompact(): cmsg.CompactRequestErrorMessage<unknown> {
    return [CompactMessageType.RequestError, this.id, this.method, this.value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  //   if (this.method) validateMethod(this.method);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithNameAndPayload(codec, BinaryMessageType.RequestError << 13, this.id, this.method, this.value);
  // }
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

  // public encodeBinary(codec: JsonValueCodec): void {
  //   codec.encoder.writer.u32(0b11100000_00000000_00000000_00000000 | this.id);
  // }
}

/**
 * @category Message
 */
export class ResponseCompleteMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly value: Value | undefined = undefined,
  ) {}

  public toCompact(): cmsg.CompactResponseCompleteMessage<unknown> {
    const value = this.value;
    return value === undefined
      ? [CompactMessageType.ResponseComplete, this.id]
      : [CompactMessageType.ResponseComplete, this.id, value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithPayload(codec, BinaryMessageType.ResponseComplete << 13, this.id, this.value);
  // }
}

/**
 * @category Message
 */
export class ResponseDataMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly value: Value,
  ) {}

  public toCompact(): cmsg.CompactResponseDataMessage<unknown> {
    return [CompactMessageType.ResponseData, this.id, this.value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithPayload(codec, BinaryMessageType.ResponseData << 13, this.id, this.value);
  // }
}

/**
 * @category Message
 */
export class ResponseErrorMessage implements Message {
  constructor(
    public readonly id: number,
    public readonly value: Value,
  ) {}

  public toCompact(): cmsg.CompactResponseErrorMessage<unknown> {
    return [CompactMessageType.ResponseError, this.id, this.value.data];
  }

  // public validate(): void {
  //   validateId(this.id);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   encodeBinaryWithPayload(codec, BinaryMessageType.ResponseError << 13, this.id, this.value);
  // }
}

/**
 * @category Message
 */
export class ResponseUnsubscribeMessage implements Message {
  constructor(public readonly id: number) {}

  public toCompact(): cmsg.CompactResponseUnsubscribeMessage {
    return [CompactMessageType.ResponseUnsubscribe, this.id];
  }

  // public validate(): void {
  //   validateId(this.id);
  // }

  // public encodeBinary(codec: JsonValueCodec): void {
  //   codec.encoder.writer.u32(0b11100000_00000001_00000000_00000000 | this.id);
  // }
}
