import {type ResolveType, t} from '@jsonjoy.com/json-type';

/**
 * @protected
 *
 * Do not import from this module on the client side. It will import the whole
 * `json-type` and `json-expression` libraries, due to `t` builder.
 */

export const RpcErrorType = t
  .Object(
    t.Key('message', t.str).options({
      title: 'Error message',
      description: 'A human-readable error message.',
    }),
    t.KeyOpt('code', t.str.options({ascii: true})).options({
      title: 'Error code',
      description: 'A machine-readable fixed error code tag.',
    }),
    t.KeyOpt('errno', t.num).options({
      title: 'Error number',
      description: 'A machine-readable fixed error code number. Same as "code" but in numeric form.',
    }),
    t.KeyOpt('errorId', t.str.options({ascii: true})).options({
      title: 'Error ID',
      description:
        'Unique ID of the error as it is stored the system. Can be referenced to later to retrieve from storage.',
    }),
    t.KeyOpt('meta', t.any).options({
      title: 'Error metadata',
      description: 'Additional extra metadata.',
    }),
  )
  .options({
    title: 'RPC Error',
    encodeUnknownKeys: false,
  });

export type IRpcError = ResolveType<typeof RpcErrorType>;
