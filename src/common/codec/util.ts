import {EncodingFormat} from '@jsonjoy.com/json-pack/lib/constants';
import {CborCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/cbor/CborCodegen';
import {MsgPackCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/msgpack/MsgPackCodegen';
import {JsonCodegen} from '@jsonjoy.com/json-type/lib/codegen/binary/json/JsonCodegen';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {CompiledBinaryEncoder} from '@jsonjoy.com/json-type/lib/codegen/types';
import type {Type} from '@jsonjoy.com/json-type';

export const getTypeEncoder = (codec: JsonValueCodec, type: Type): CompiledBinaryEncoder => {
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
