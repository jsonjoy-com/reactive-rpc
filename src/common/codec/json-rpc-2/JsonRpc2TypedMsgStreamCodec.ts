import {EncodingFormat} from '@jsonjoy.com/json-pack/lib/constants';
import {CborCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/cbor/CborCodegen';
import {MsgPackCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/msgpack/MsgPackCodegen';
import {JsonCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/json/JsonCodegen';
import {RpcMessageFormat} from '../constants';
import {RpcError} from '../../error';
import * as msg from '../../messages';
import * as schema from './schema';
import {toMessage} from './toMessage';
import type {TlvBinaryJsonEncoder} from '@jsonjoy.com/json-pack/lib/types';
import type {JsonJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/json';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {CompiledBinaryEncoder} from '@jsonjoy.com/json-type/lib/codegen/types';
import type {MsgStreamCodec} from '../types';
import type {Type} from '@jsonjoy.com/json-type';

const RESPONSE_TYPE = schema.JsonRpc2Response.type;
const ERROR_TYPE = schema.JsonRpc2Error.type;
const NOTIFICATION_TYPE = schema.JsonRpc2Notification.type;
const REQUEST_TYPE = schema.JsonRpc2Request.type;

const getEncoder = (codec: JsonValueCodec, type: Type): CompiledBinaryEncoder => {
  switch (codec.format) {
    case EncodingFormat.Cbor: {
      return CborCodegen.get(type);
    }
    case EncodingFormat.MsgPack: {
      return MsgPackCodegen.get(type);
    }
    case EncodingFormat.Json: {
      return JsonCodegen.get(type);
    }
    default:
      throw new Error('UNK_CODEC');
  }
};

export class JsonRpc2TypedMsgStreamCodec implements MsgStreamCodec {
  id = 'json2.verbose';
  format = RpcMessageFormat.JsonRpc2;

  public write(jsonCodec: JsonValueCodec, message: msg.RpcMessage): void {
    if (message instanceof msg.ResponseCompleteMessage || message instanceof msg.ResponseDataMessage) {
      const pojo: schema.JsonRpc2ResponseMessage = {
        id: message.id,
        result: message.value,
      } as schema.JsonRpc2ResponseMessage;
      const encoder = getEncoder(jsonCodec, RESPONSE_TYPE);
      encoder(pojo, jsonCodec.encoder);
    } else if (message instanceof msg.ResponseErrorMessage) {
      const error = message.value.data;
      let pojo: schema.JsonRpc2ErrorMessage;
      if (error instanceof RpcError) {
        pojo = {
          id: message.id,
          error: {
            message: error.message,
            code: error.errno,
            data: error.toJson(),
          },
        } as schema.JsonRpc2ErrorMessage;
      } else {
        pojo = {
          id: message.id,
          error: {
            message: 'Unknown error',
            code: 0,
            data: error,
          },
        } as schema.JsonRpc2ErrorMessage;
      }
      const encoder = getEncoder(jsonCodec, ERROR_TYPE);
      encoder(pojo, jsonCodec.encoder);
    } else if (message instanceof msg.NotificationMessage) {
      const pojo: schema.JsonRpc2NotificationMessage = {
        method: message.method,
        params: message.value,
      } as schema.JsonRpc2NotificationMessage;
      const encoder = getEncoder(jsonCodec, NOTIFICATION_TYPE);
      encoder(pojo, jsonCodec.encoder);
    } else if (
      message instanceof msg.RequestCompleteMessage ||
      message instanceof msg.RequestDataMessage ||
      message instanceof msg.RequestErrorMessage
    ) {
      const pojo: schema.JsonRpc2RequestMessage = {
        jsonrpc: '2.0',
        id: message.id,
        method: message.method,
        params: message.value,
      };
      const encoder = getEncoder(jsonCodec, REQUEST_TYPE);
      encoder(pojo, jsonCodec.encoder);
    }
  }

  public writeBatch(jsonCodec: JsonValueCodec, batch: msg.RpcMessage[]): void {
    const length = batch.length;
    if (length === 1) {
      this.write(jsonCodec, batch[0]);
    } else {
      switch (jsonCodec.format) {
        case EncodingFormat.Cbor:
        case EncodingFormat.MsgPack: {
          const encoder = jsonCodec.encoder as unknown as TlvBinaryJsonEncoder;
          encoder.writeArrHdr(length);
          for (let i = 0; i < length; i++) {
            this.write(jsonCodec, batch[i]);
          }
          break;
        }
        case EncodingFormat.Json: {
          const encoder = (jsonCodec as JsonJsonValueCodec).encoder;
          encoder.writeStartArr();
          const last = length - 1;
          for (let i = 0; i < last; i++) {
            this.write(jsonCodec, batch[i]);
            encoder.writeArrSeparator();
          }
          if (length > 0) this.write(jsonCodec, batch[last]);
          encoder.writeEndArr();
          break;
        }
      }
    }
  }

  public read(jsonCodec: JsonValueCodec): msg.RpcMessage[] {
    try {
      let jsonRpcMessages = jsonCodec.decoder.readAny() as unknown as schema.JsonRpc2Message[];
      if (!Array.isArray(jsonRpcMessages)) jsonRpcMessages = [jsonRpcMessages];
      const messages: msg.RpcMessage[] = [];
      const length = jsonRpcMessages.length;
      for (let i = 0; i < length; i++) messages.push(toMessage(jsonRpcMessages[i]));
      return messages;
    } catch (error) {
      if (error instanceof RpcError) throw error;
      throw RpcError.badRequest();
    }
  }

  public readChunk(jsonCodec: JsonValueCodec, uint8: Uint8Array): msg.RpcMessage[] {
    jsonCodec.decoder.reader.reset(uint8);
    return this.read(jsonCodec);
  }
}
