import {BinaryJsonEncoder} from '@jsonjoy.com/json-pack';
import {Value} from '@jsonjoy.com/json-type';
import {getTypeEncoder} from '../util';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';

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

export const writeType2 = (
  codec: JsonValueCodec,
  name: string,
  value: unknown | Value<any> | undefined,
) => {
  const encoder = codec.encoder;
  const writer = encoder.writer;
  const nameLength = name.length;
  writer.move(4);
  writer.ascii(name);
  const x0 = writer.x0;
  const x = writer.x;
  if (value !== void 0) {
    if (value instanceof Value) {
      const type = value.type;
      const data = value.data;
      if (type) getTypeEncoder(codec, type)(data, encoder);
      else if (data !== void 0) encoder.writeAny(data);
    } else encoder.writeAny(value);
  }
  const shift = writer.x0 - x0;
  const payloadStart = x + shift;
  const start = payloadStart - 4 - nameLength;
  const payloadSize = writer.x - payloadStart;
  writer.view.setUint32(start, (payloadSize << 8) + nameLength);
};

export const writeType3 = (
  codec: JsonValueCodec,
  typeU16: number,
  id: number,
  value: unknown | Value<any> | undefined,
) => {
  const encoder = codec.encoder;
  const writer = encoder.writer;
  writer.move(4);
  const x0 = writer.x0;
  const x = writer.x;
  if (value !== void 0) {
    if (value instanceof Value) {
      const type = value.type;
      const data = value.data;
      if (type) getTypeEncoder(codec, type)(data, encoder);
      else if (data !== void 0) encoder.writeAny(data);
    } else encoder.writeAny(value);
  }
  const shift = writer.x0 - x0;
  const payloadStart = x + shift;
  const start = payloadStart - 4;
  const payloadSize = writer.x - payloadStart;
  writeHeader(writer, typeU16, id, payloadSize, start);
};

export const writeType4 = (
  codec: JsonValueCodec,
  typeU16: number,
  id: number,
  name: string,
  value: unknown | Value<any> | undefined,
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
  if (value !== void 0) {
    if (value instanceof Value) {
      const type = value.type;
      const data = value.data;
      if (type) getTypeEncoder(codec, type)(data, encoder);
      else if (data !== void 0) encoder.writeAny(data);
    } else encoder.writeAny(value);
  }
  const shift = writer.x0 - x0;
  const payloadStart = x + shift;
  const start = payloadStart - 5 - nameLength;
  const payloadSize = writer.x - payloadStart;
  writeHeader(writer, typeU16, id, payloadSize, start);
};
