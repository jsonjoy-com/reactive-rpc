import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {Codecs} from '@jsonjoy.com/json-pack/lib/codecs/Codecs';
import {RpcCodecs} from '../../common/codec/RpcCodecs';
import {RpcMessageCodecs} from '../../common/codec/RpcMessageCodecs';
import {RpcCodec} from '../../common/codec/RpcCodec';

export interface SetupCodecsOpts {
  skipJson2?: boolean;
}

export const setupCodecs = (opts: SetupCodecsOpts = {}) => {
  const codecs = new RpcCodecs(new Codecs(new Writer()), new RpcMessageCodecs());
  const {binary, compact, jsonRpc2} = codecs.messages;
  const {json, cbor, msgpack} = codecs.value;
  const list: RpcCodec[] = [
    new RpcCodec(compact, json, json),
    // new RpcCodec(compact, cbor, cbor),
    // new RpcCodec(compact, msgpack, msgpack),
    // new RpcCodec(compact, json, cbor),
    // new RpcCodec(compact, json, msgpack),
    // new RpcCodec(compact, cbor, json),
    // new RpcCodec(compact, cbor, msgpack),
    // new RpcCodec(compact, msgpack, json),
    // new RpcCodec(compact, msgpack, cbor),
    // new RpcCodec(binary, cbor, cbor),
    // new RpcCodec(binary, msgpack, msgpack),
    // new RpcCodec(binary, json, json),
    // new RpcCodec(binary, json, cbor),
    // new RpcCodec(binary, json, msgpack),
    // new RpcCodec(binary, cbor, json),
    // new RpcCodec(binary, cbor, msgpack),
    // new RpcCodec(binary, msgpack, json),
    // new RpcCodec(binary, msgpack, cbor),
  ];
  if (!opts.skipJson2) {
    list.push(new RpcCodec(jsonRpc2, json, json));
    // list.push(new RpcCodec(jsonRpc2, cbor, cbor));
    // list.push(new RpcCodec(jsonRpc2, msgpack, msgpack));
    // list.push(new RpcCodec(jsonRpc2, json, cbor));
    // list.push(new RpcCodec(jsonRpc2, json, msgpack));
    // list.push(new RpcCodec(jsonRpc2, cbor, json));
    // list.push(new RpcCodec(jsonRpc2, cbor, msgpack));
    // list.push(new RpcCodec(jsonRpc2, msgpack, json));
    // list.push(new RpcCodec(jsonRpc2, msgpack, cbor));
  }
  return {
    codecs,
    list,
  };
};
