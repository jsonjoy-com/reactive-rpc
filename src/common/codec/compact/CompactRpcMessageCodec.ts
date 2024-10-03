import {RpcMessageFormat} from '../constants';
import {RpcError, RpcErrorCodes} from '../../rpc/caller/error';
import * as msg from '../../messages';
import {CompactMessageType} from './constants';
import {RpcValue} from '../../messages/Value';
import type {JsonEncoder} from '@jsonjoy.com/json-pack/lib/json/JsonEncoder';
import type {RpcMessageCodec} from '../types';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type * as types from './types';
import type {TlvBinaryJsonEncoder} from '@jsonjoy.com/json-pack';

const fromJson = (arr: unknown | unknown[] | types.CompactMessage): msg.ReactiveRpcMessage => {
  if (!(arr instanceof Array)) throw RpcError.fromCode(RpcErrorCodes.BAD_REQUEST);
  const type = arr[0];
  switch (type) {
    case CompactMessageType.RequestComplete: {
      const data = arr[3];
      const value = data === undefined ? data : new RpcValue(data, undefined);
      return new msg.RequestCompleteMessage(arr[1], arr[2], value);
    }
    case CompactMessageType.RequestData: {
      const data = arr[3];
      const value = data === undefined ? data : new RpcValue(data, undefined);
      return new msg.RequestDataMessage(arr[1], arr[2], value);
    }
    case CompactMessageType.RequestError: {
      return new msg.RequestErrorMessage(arr[1], arr[2], new RpcValue(arr[3], undefined));
    }
    case CompactMessageType.RequestUnsubscribe: {
      return new msg.RequestUnsubscribeMessage(arr[1]);
    }
    case CompactMessageType.ResponseComplete: {
      const data = arr[2];
      const value = data === undefined ? data : new RpcValue(data, undefined);
      return new msg.ResponseCompleteMessage(arr[1], value);
    }
    case CompactMessageType.ResponseData: {
      return new msg.ResponseDataMessage(arr[1], new RpcValue(arr[2], undefined));
    }
    case CompactMessageType.ResponseError: {
      return new msg.ResponseErrorMessage(arr[1], new RpcValue(arr[2], undefined));
    }
    case CompactMessageType.ResponseUnsubscribe: {
      return new msg.ResponseUnsubscribeMessage(arr[1]);
    }
    case CompactMessageType.Notification: {
      return new msg.NotificationMessage(arr[1], new RpcValue(arr[2], undefined));
    }
  }
  throw RpcError.value(RpcError.validation('Unknown message type'));
};

const encodeCompactWithNameAndPayload = (
  codec: JsonValueCodec,
  type: CompactMessageType,
  msg: msg.RequestDataMessage | msg.RequestCompleteMessage | msg.RequestErrorMessage,
) => {
  const encoder = codec.encoder;
  if (typeof (encoder as any as TlvBinaryJsonEncoder).writeArrHdr === 'function') {
    const binaryEncoder = encoder as any as TlvBinaryJsonEncoder;
    const value = msg.value;
    const hasValue = value !== undefined;
    binaryEncoder.writeArrHdr(hasValue ? 4 : 3);
    encoder.writeUInteger(type);
    encoder.writeUInteger(msg.id);
    encoder.writeAsciiStr(msg.method);
    if (hasValue) {
      if (value.type) value.type.encoder(codec.format)(value.data, encoder);
      else encoder.writeAny(value.data);
    }
  } else if (typeof (encoder as any as JsonEncoder).writeStartArr === 'function' && typeof (encoder as any as JsonEncoder).writeArrSeparator === 'function') {
    const jsonEncoder = encoder as any as JsonEncoder;
    const value = msg.value;
    jsonEncoder.writeStartArr();
    jsonEncoder.writeNumber(type);
    jsonEncoder.writeArrSeparator();
    jsonEncoder.writeNumber(msg.id);
    jsonEncoder.writeArrSeparator();
    jsonEncoder.writeAsciiStr(msg.method);
    const hasValue = value !== undefined;
    if (hasValue) {
      jsonEncoder.writeArrSeparator();
      if (value.type) value.type.encoder(codec.format)(value.data, encoder);
      else jsonEncoder.writeAny(value.data);
    }
    jsonEncoder.writeEndArr();
  } else encoder.writeArr(msg.toCompact());
};

const encodeCompactWithPayload = (
  codec: JsonValueCodec,
  type: CompactMessageType,
  msg: msg.ResponseCompleteMessage | msg.ResponseDataMessage | msg.ResponseErrorMessage,
) => {
  const encoder = codec.encoder;
  if (typeof (encoder as any as TlvBinaryJsonEncoder).writeArrHdr === 'function') {
    const binaryEncoder = encoder as any as TlvBinaryJsonEncoder;
    const value = msg.value;
    const hasValue = value !== undefined;
    binaryEncoder.writeArrHdr(hasValue ? 3 : 2);
    encoder.writeUInteger(type);
    encoder.writeUInteger(msg.id);
    if (hasValue) {
      if (value.type) {
        value.type.encoder(codec.format)(value.data, encoder);
      } else encoder.writeAny(value.data);
    }
  } else if (typeof (encoder as any as JsonEncoder).writeStartArr === 'function' && typeof (encoder as any as JsonEncoder).writeArrSeparator === 'function') {
    const jsonEncoder = encoder as any as JsonEncoder;
    const value = msg.value;
    jsonEncoder.writeStartArr();
    jsonEncoder.writeNumber(type);
    jsonEncoder.writeArrSeparator();
    jsonEncoder.writeNumber(msg.id);
    const hasValue = value !== undefined;
    if (hasValue) {
      jsonEncoder.writeArrSeparator();
      if (value.type) value.type.encoder(codec.format)(value.data, jsonEncoder);
      else encoder.writeAny(value.data);
    }
    jsonEncoder.writeEndArr();
  } else encoder.writeArr(msg.toCompact());
};

export class CompactRpcMessageCodec implements RpcMessageCodec {
  id = 'rx.compact';
  format = RpcMessageFormat.Compact;

  public encodeMessage(codec: JsonValueCodec, message: msg.ReactiveRpcMessage): void {
    if (message instanceof msg.NotificationMessage) {
      const encoder = codec.encoder;
      if (typeof (encoder as any as TlvBinaryJsonEncoder).writeArrHdr === 'function') {
        const binaryEncoder = encoder as any as TlvBinaryJsonEncoder;
        const value = message.value;
        const hasValue = value !== undefined;
        binaryEncoder.writeArrHdr(hasValue ? 3 : 2);
        encoder.writeUInteger(CompactMessageType.Notification);
        encoder.writeAsciiStr(message.method);
        if (hasValue) {
          if (value.type) value.type.encoder(codec.format)(value.data, encoder);
          else encoder.writeAny(value.data);
        }
      } else if (typeof (encoder as any as JsonEncoder).writeStartArr === 'function' && typeof (encoder as any as JsonEncoder).writeArrSeparator === 'function') {
        const jsonEncoder = encoder as any as JsonEncoder;
        const value = message.value;
        jsonEncoder.writeStartArr();
        jsonEncoder.writeNumber(CompactMessageType.Notification);
        jsonEncoder.writeArrSeparator();
        jsonEncoder.writeAsciiStr(message.method);
        const hasValue = value !== undefined;
        if (hasValue) {
          jsonEncoder.writeArrSeparator();
          if (value.type) value.type.encoder(codec.format)(value.data, jsonEncoder);
          else encoder.writeAny(value.data);
        }
        jsonEncoder.writeEndArr();
      } else encoder.writeArr(message.toCompact());
    } else if (message instanceof msg.RequestDataMessage) {
      encodeCompactWithNameAndPayload(codec, CompactMessageType.RequestData, message);
    } else if (message instanceof msg.RequestCompleteMessage) {
      encodeCompactWithNameAndPayload(codec, CompactMessageType.RequestComplete, message);
    } else if (message instanceof msg.RequestErrorMessage) {
      encodeCompactWithNameAndPayload(codec, CompactMessageType.RequestError, message);
    } else if (message instanceof msg.RequestUnsubscribeMessage) {
      codec.encoder.writeArr(message.toCompact());
    } else if (message instanceof msg.ResponseCompleteMessage) {
      encodeCompactWithPayload(codec, CompactMessageType.ResponseComplete, message);
    } else if (message instanceof msg.ResponseDataMessage) {
      encodeCompactWithPayload(codec, CompactMessageType.ResponseData, message);
    } else if (message instanceof msg.ResponseErrorMessage) {
      encodeCompactWithPayload(codec, CompactMessageType.ResponseError, message);
    } else if (message instanceof msg.ResponseUnsubscribeMessage) {
      codec.encoder.writeArr(message.toCompact());
    } else {
      codec.encoder.writeArr((message as any).toCompact());
    }
  }

  public encodeBatch(jsonCodec: JsonValueCodec, batch: msg.ReactiveRpcMessage[]): void {
    const encoder = jsonCodec.encoder;
    if (typeof (encoder as any as TlvBinaryJsonEncoder).writeArrHdr === 'function') {
      const binaryEncoder = encoder as any as TlvBinaryJsonEncoder;
      const length = batch.length;
      binaryEncoder.writeArrHdr(length);
      for (let i = 0; i < length; i++) this.encodeMessage(jsonCodec, batch[i]);
    } else if (typeof (encoder as any as JsonEncoder).writeStartArr === 'function' && typeof (encoder as any as JsonEncoder).writeArrSeparator === 'function') {
      const jsonEncoder = encoder as any as JsonEncoder;
      const length = batch.length;
      const last = length - 1;
      jsonEncoder.writeStartArr();
      for (let i = 0; i < last; i++) {
        this.encodeMessage(jsonCodec, batch[i]);
        jsonEncoder.writeArrSeparator();
      }
      if (length > 0) this.encodeMessage(jsonCodec, batch[last]);
      jsonEncoder.writeEndArr();
    } else {
      const jsonMessages: types.CompactMessage[] = [];
      const length = batch.length;
      for (let i = 0; i < length; i++) jsonMessages.push(batch[i].toCompact());
      const encoder = jsonCodec.encoder;
      encoder.writeArr(jsonMessages);
    }
  }

  public encode(jsonCodec: JsonValueCodec, batch: msg.ReactiveRpcMessage[]): Uint8Array {
    const encoder = jsonCodec.encoder;
    const writer = encoder.writer;
    writer.reset();
    this.encodeBatch(jsonCodec, batch);
    return writer.flush();
  }

  public decodeBatch(jsonCodec: JsonValueCodec, uint8: Uint8Array): msg.ReactiveRpcMessage[] {
    const decoder = jsonCodec.decoder;
    const value = decoder.read(uint8);
    if (!(value instanceof Array)) throw RpcError.badRequest();
    if (typeof value[0] === 'number') return [fromJson(value as unknown[])];
    const result: msg.ReactiveRpcMessage[] = [];
    const length = value.length;
    for (let i = 0; i < length; i++) {
      const item = value[i];
      result.push(fromJson(item as unknown));
    }
    return result;
  }

  public fromJson(compact: types.CompactMessage): msg.ReactiveRpcMessage {
    return fromJson(compact);
  }
}
