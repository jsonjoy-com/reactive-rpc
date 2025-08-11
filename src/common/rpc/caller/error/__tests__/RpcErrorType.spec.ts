import {JsonTextCodegen} from '@jsonjoy.com/json-type/lib/codegen/json/JsonTextCodegen';
import {RpcError} from '../RpcError';
import {RpcErrorType} from '../RpcErrorType';

test('can encode an internal error', () => {
  const error = RpcError.internal(null);
  const encoded = JsonTextCodegen.get(RpcErrorType)(error);
  // console.log(RpcErrorType.encoder(EncodingFormat.Json).toString());
  const json = JSON.parse(Buffer.from(encoded).toString());
  expect(json).toEqual({
    message: 'Internal Server Error',
    code: 'INTERNAL_ERROR',
    errno: 0,
  });
});
