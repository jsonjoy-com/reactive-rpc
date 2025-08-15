import {type ResolveType, ModuleType} from '@jsonjoy.com/json-type';

export const system = new ModuleType();
const t = system.t;

export const JsonRpc2Id = t.num.format('i32').alias('JsonRpc2Id');

export const JsonRpc2Notification = t
  .object({
    jsonrpc: t.con('2.0'),
    method: t.str.title('RPC method name').description('JSON RPC 2.0 method name.'),
    params: t.any.title('RPC method parameters'),
  })
  .alias('JsonRpc2Notification');

export const JsonRpc2Request = t
  .object({
    jsonrpc: t.con('2.0'),
    id: t.Ref<typeof JsonRpc2Id>('JsonRpc2Id'),
    method: t.str.title('RPC method name').description('JSON RPC 2.0 method name.'),
    params: t.any.title('RPC method parameters'),
  })
  .alias('JsonRpc2Request');

export const JsonRpc2Response = t
  .object({
    jsonrpc: t.con('2.0'),
    id: t.Ref<typeof JsonRpc2Id>('JsonRpc2Id'),
    result: t.any,
  })
  .alias('JsonRpc2Response');

export const JsonRpc2Error = t
  .object({
    jsonrpc: t.con('2.0'),
    id: t.Ref<typeof JsonRpc2Id>('JsonRpc2Id'),
    error: t
      .object({
        message: t.str.options({
          title: 'Error message',
          description: 'A string providing a short description of the error.',
        }),
        code: t.num.options({
          title: 'Error code',
          description: 'A number that indicates the error type that occurred.',
          format: 'i32',
        }),
        data: t.any.options({
          title: 'Error data',
          description: 'A Primitive or Structured value that contains additional information about the error.',
        }),
      })
  })
  .alias('JsonRpc2Error');

export type JsonRpc2NotificationMessage = ResolveType<typeof JsonRpc2Notification>;
export type JsonRpc2RequestMessage = ResolveType<typeof JsonRpc2Request>;
export type JsonRpc2ResponseMessage = ResolveType<typeof JsonRpc2Response>;
export type JsonRpc2ErrorMessage = ResolveType<typeof JsonRpc2Error>;
export type JsonRpc2Message =
  | JsonRpc2NotificationMessage
  | JsonRpc2RequestMessage
  | JsonRpc2ResponseMessage
  | JsonRpc2ErrorMessage;
