import {JsonJsonValueCodec} from "@jsonjoy.com/json-pack/lib/codecs/json";
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {CompactMsgStreamCodec} from "../../../codec/compact";
import {RpcCodec} from "../../../codec/RpcCodec";
import {MockWsConnection} from "../../__tests__/MockWsConnection";
import {WsConnectionContext} from "../WsConnectionContext";

export const createWsConnectionContext = () => {
  const connection = new MockWsConnection();
  const msg = new CompactMsgStreamCodec();
  const req = new JsonJsonValueCodec(new Writer());
  const codec = new RpcCodec(msg, req, req);
  const ctx = new WsConnectionContext(
    connection,
    '/test',
    '',
    '127.0.0.1',
    'secret-token-xxx',
    [],
    {},
    codec,
  );
  return {ctx, connection};
};