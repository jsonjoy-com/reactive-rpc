import {BinaryJsonEncoder} from '@jsonjoy.com/json-pack';
import {unknown, Value} from '@jsonjoy.com/json-type';
import {RpcMessageFormat} from '../constants';
import * as msg from '../../messages';
import {getTypeEncoder} from '../util';
import {decode} from './decode';
import {BinaryMessageType} from './constants';
import type {Uint8ArrayCut} from '@jsonjoy.com/util/lib/buffers/Uint8ArrayCut';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {MsgStreamCodec} from '../types';

const writeHeader = (
  writer: BinaryJsonEncoder['writer'],
  typeU16: number,
  id: number,
  payloadSize: number,
  start: number,
) => {
  if (payloadSize <= 0b1111_11111111) {
    const w1 = typeU16 | payloadSize;
    const w2 = id;
    writer.view.setUint32(start, (w1 << 16) | w2);
  } else if (payloadSize <= 0b1111_11111111_1111111) {
    writer.u8(id & 0xff);
    const w1 = typeU16 | 0b000_1_0000_00000000 | (payloadSize >> 7);
    const w2 = ((payloadSize & 0b0111_1111) << 8) | (id >> 8);
    writer.view.setUint32(start, (w1 << 16) | w2);
  } else {
    writer.u16(id);
    const w1 = typeU16 | 0b000_1_0000_00000000 | (payloadSize >> 15);
    const w2 = 0b1000_0000_00000000 | (payloadSize & 0b0111_1111_11111111);
    writer.view.setUint32(start, (w1 << 16) | w2);
  }
};

const writeType3 = (
  codec: JsonValueCodec,
  typeU16: number,
  id: number,
  value: Value<any> | undefined,
) => {
  const encoder = codec.encoder;
  const writer = encoder.writer;
  writer.move(4);
  const x0 = writer.x0;
  const x = writer.x;
  if (value) {
    const type = value.type;
    const data = value.data;
    if (type) getTypeEncoder(codec, type)(data, encoder);
    else if (data !== void 0) encoder.writeAny(data);
  }
  const shift = writer.x0 - x0;
  const payloadStart = x + shift;
  const start = payloadStart - 4;
  const payloadSize = writer.x - payloadStart;
  writeHeader(writer, typeU16, id, payloadSize, start);
};

const writeType4 = (
  codec: JsonValueCodec,
  typeU16: number,
  id: number,
  name: string,
  value: Value<any> | undefined,
) => {
  const encoder = codec.encoder;
  const writer = encoder.writer;
  const nameLength = name.length;
  writer.ensureCapacity(5 + nameLength);
  writer.uint8[writer.x + 4] = nameLength;
  writer.x += 5;
  writer.ascii(name);
  const x0 = writer.x0;
  const x = writer.x;
  if (value) {
    const type = value.type;
    const data = value.data;
    if (type) getTypeEncoder(codec, type)(data, encoder);
    else if (data !== void 0) encoder.writeAny(data);
  }
  const shift = writer.x0 - x0;
  const payloadStart = x + shift;
  const start = payloadStart - 5 - nameLength;
  const payloadSize = writer.x - payloadStart;
  writeHeader(writer, typeU16, id, payloadSize, start);
};

export class BinaryMsgStreamCodec implements MsgStreamCodec {
  id = 'rx.binary';
  format = RpcMessageFormat.Compact;

  public write(codec: JsonValueCodec, message: msg.RpcMessage): void {
    if (message instanceof msg.NotificationMessage) {
      const encoder = codec.encoder;
      const writer = encoder.writer;
      const name = message.method;
      const nameLength = name.length;
      writer.move(4);
      writer.ascii(name);
      const x0 = writer.x0;
      const x = writer.x;
      const value = message.value;
      if (value) {
        const type = value.type;
        const data = value.data;
        if (type) getTypeEncoder(codec, type)(data, encoder);
        else if (data !== void 0) encoder.writeAny(data);
      }
      const shift = writer.x0 - x0;
      const payloadStart = x + shift;
      const start = payloadStart - 4 - nameLength;
      const payloadSize = writer.x - payloadStart;
      writer.view.setUint32(start, (payloadSize << 8) + nameLength);
    } else if (message instanceof msg.RequestDataMessage) {
      writeType4(codec, BinaryMessageType.RequestData << 13, message.id, message.method, message.value);
    } else if (message instanceof msg.RequestCompleteMessage) {
      writeType4(codec, BinaryMessageType.RequestComplete << 13, message.id, message.method, message.value);
    } else if (message instanceof msg.RequestErrorMessage) {
      writeType4(codec, BinaryMessageType.RequestError << 13, message.id, message.method, message.value);
    } else if (message instanceof msg.RequestUnsubscribeMessage) {
      codec.encoder.writer.u32(0b11100000_00000000_00000000_00000000 | message.id);
    } else if (message instanceof msg.ResponseCompleteMessage) {
      writeType3(codec, BinaryMessageType.ResponseComplete << 13, message.id, message.value);
    } else if (message instanceof msg.ResponseDataMessage) {
      writeType3(codec, BinaryMessageType.ResponseData << 13, message.id, message.value);
    } else if (message instanceof msg.ResponseErrorMessage) {
      writeType3(codec, BinaryMessageType.ResponseError << 13, message.id, message.value);
    } else if (message instanceof msg.ResponseUnsubscribeMessage) {
      codec.encoder.writer.u32(0b11100000_00000001_00000000_00000000 | message.id);
    }
  }

  public writeBatch(codec: JsonValueCodec, batch: msg.RpcMessage[]): void {
    const length = batch.length;
    for (let i = 0; i < length; i++) this.write(codec, batch[i]);
  }

  public encode(jsonCodec: JsonValueCodec, batch: msg.RpcMessage[]): Uint8Array {
    const encoder = jsonCodec.encoder;
    const writer = encoder.writer;
    writer.reset();
    this.writeBatch(jsonCodec, batch);
    return writer.flush();
  }

  public read(codec: JsonValueCodec): msg.RpcMessage[] {
    const decoder = codec.decoder;
    const reader = decoder.reader;
    const messages: msg.RpcMessage[] = [];
    while (reader.x < reader.uint8.length) {
      const message = decode(reader);
      messages.push(message);
    }
    const length = messages.length;
    for (let i = 0; i < length; i++) {
      const message = messages[i];
      if (message instanceof msg.NotificationMessage
        || message instanceof msg.RequestCompleteMessage
        || message instanceof msg.RequestDataMessage
        || message instanceof msg.RequestErrorMessage
        || message instanceof msg.ResponseCompleteMessage
        || message instanceof msg.ResponseDataMessage
        || message instanceof msg.ResponseErrorMessage
      ) {
        const value = message.value;
        if (value) {
          const cut = value.data as Uint8ArrayCut;
          if (!cut || cut.size === 0) message.value = unknown(undefined);
          else {
            const arr = cut.uint8.subarray(cut.start, cut.start + cut.size);
            const data = arr.length ? decoder.read(arr) : undefined;
            if (data === undefined) message.value = unknown(undefined);
            else value.data = data;
          }
        } else
          message.value = unknown(undefined);
      }
    }
    return messages;
  }

  public readChunk(jsonCodec: JsonValueCodec, uint8: Uint8Array): msg.RpcMessage[] {
    jsonCodec.decoder.reader.reset(uint8);
    return this.read(jsonCodec);
  }
}
