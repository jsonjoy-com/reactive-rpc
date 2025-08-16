// import {RpcMessageFormat} from '../constants';
// import {decode} from './decode';
// import type * as msg from '../../messages';
// import type {Uint8ArrayCut} from '@jsonjoy.com/util/lib/buffers/Uint8ArrayCut';
// import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
// import type {CompactMessageCodec, RpcMessageCodec} from '../types';
// import {CompactMessage, CompactMessageType} from '../compact';

// export class BinaryCompactMessageCodec implements CompactMessageCodec {
//   id = 'rx.binary';
//   format = RpcMessageFormat.Compact;

//   // public encodeMessage(jsonCodec: JsonValueCodec, message: msg.ReactiveRpcMessage): void {
//   //   message.encodeBinary(jsonCodec);
//   // }

//   // public encodeBatch(jsonCodec: JsonValueCodec, batch: msg.ReactiveRpcMessage[]): void {
//   //   const length = batch.length;
//   //   for (let i = 0; i < length; i++) batch[i].encodeBinary(jsonCodec);
//   // }

//   // public decodeBatch(jsonCodec: JsonValueCodec, uint8: Uint8Array): msg.ReactiveRpcMessage[] {
//   //   const decoder = jsonCodec.decoder;
//   //   const reader = decoder.reader;
//   //   reader.reset(uint8);
//   //   const size = uint8.length;
//   //   const messages: msg.ReactiveRpcMessage[] = [];
//   //   while (reader.x < size) {
//   //     const message = decode(reader);
//   //     messages.push(message);
//   //   }
//   //   const length = messages.length;
//   //   for (let i = 0; i < length; i++) {
//   //     const message = messages[i];
//   //     const value = (message as any).value;
//   //     if (value) {
//   //       const cut = value.data as Uint8ArrayCut;
//   //       const arr = cut.uint8.subarray(cut.start, cut.start + cut.size);
//   //       const data = arr.length ? decoder.read(arr) : undefined;
//   //       if (data === undefined) (message as any).value = undefined;
//   //       else value.data = data;
//   //     }
//   //   }
//   //   return messages;
//   // }

//   // public encode(jsonCodec: JsonValueCodec, batch: msg.ReactiveRpcMessage[]): Uint8Array {
//   //   const encoder = jsonCodec.encoder;
//   //   const writer = encoder.writer;
//   //   writer.reset();
//   //   this.encodeBatch(jsonCodec, batch);
//   //   return writer.flush();
//   // }

//   public encodeMessage(codec: JsonValueCodec, message: CompactMessage): void {
//     const encoder = codec.encoder;
//     const writer = encoder.writer;
//     const type = message[0];
//     switch (type) {
//       case CompactMessageType.Notification: {
//         const name = message[1];
//         const nameLength = name.length;
//         writer.move(4);
//         writer.ascii(name);
//         const x0 = writer.x0;
//         const x = writer.x;
//         encoder.writeAny(message[2]);
//         const shift = writer.x0 - x0;
//         const payloadStart = x + shift;
//         const start = payloadStart - 4 - nameLength;
//         const payloadSize = writer.x - payloadStart;
//         writer.view.setUint32(start, (payloadSize << 8) + nameLength);
//       }
//     }
//   }

//   public encodeMessages(codec: JsonValueCodec, batch: CompactMessage[]): void {

//   }

//   public encode(codec: JsonValueCodec, batch: CompactMessage[]): Uint8Array {

//   }

//   public decodeBatch(codec: JsonValueCodec, uint8: Uint8Array): CompactMessage[] {

//   }
// }
