import {RpcMessageFormat} from '../constants';
import * as msg from '../../messages';
import {decode} from './decode';
import {BinaryMessageType} from './constants';
import {writeType2, writeType3, writeType4} from './encode';
import type {Uint8ArrayCut} from '@jsonjoy.com/buffers/lib/Uint8ArrayCut';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {MsgStreamCodec} from '../types';

export class BinaryMsgStreamCodec implements MsgStreamCodec {
  id = 'rx.binary';
  format = RpcMessageFormat.Compact;

  public write(codec: JsonValueCodec, message: msg.RpcMessage): void {
    if (message instanceof msg.NotificationMessage) {
      writeType2(codec, message.method, message.value);
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
          // if (!cut || cut.size === 0) message.value = unknown(undefined);
          if (!cut || cut.size === 0) message.value = void 0;
          else {
            const arr = cut.uint8.subarray(cut.start, cut.start + cut.size);
            const data = arr.length ? decoder.read(arr) : undefined;
            // if (data === undefined) message.value = unknown(undefined);
            if (data === undefined) message.value = void 0;
            else value.data = data;
          }
        } else
          // message.value = unknown(undefined);
          message.value = void 0;
      }
    }
    return messages;
  }

  public readChunk(jsonCodec: JsonValueCodec, uint8: Uint8Array): msg.RpcMessage[] {
    jsonCodec.decoder.reader.reset(uint8);
    return this.read(jsonCodec);
  }
}
