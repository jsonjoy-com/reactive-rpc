// import {UnaryClient, type UnaryClientOptions} from './UnaryClient';
// import {EncodedStaticRpcClient} from './EncodedStaticRpcClient';
// import type {RpcCodec} from '../codec/RpcCodec';
// import type {Observable} from 'rxjs';
// import type {RpcClient} from './types';

// type IFetch = typeof fetch;

// export interface FetchRpcClientOptions extends Omit<UnaryClientOptions, 'send'> {
//   url: string;

//   codec: RpcCodec;

//   fetch?: IFetch;
// }

// /**
//  * Unary method RPC client, which uses `fetch` to send requests.
//  */
// export class FetchRpcClient implements RpcClient {
//   public readonly client: EncodedStaticRpcClient;

//   constructor(options: FetchRpcClientOptions) {
//     const {codec, url} = options;
//     let contentType = `application/x.rpc.${codec.msg.id}.${codec.req.id}`;
//     if (codec.req.id !== codec.res.id) contentType += `-${codec.res.id}`;
//     const currentFetch = options.fetch || fetch;
//     this.client = new EncodedStaticRpcClient({
//       client: new UnaryClient({
//         bufferSize: options.bufferSize,
//         bufferTime: options.bufferTime,
//       }),
//       msgCodec,
//       reqCodec,
//       resCodec,
//       send: async (body) => {
//         const response = await currentFetch(url, {
//           method: 'POST',
//           headers: {
//             'Content-Type': contentType,
//           },
//           body,
//         });
//         const buffer = await response.arrayBuffer();
//         return new Uint8Array(buffer);
//       },
//     });
//   }

//   public call$(method: string, data: unknown | Observable<unknown>): Observable<unknown> {
//     return this.client.call$(method, data);
//   }

//   public async call(method: string, request: unknown): Promise<unknown> {
//     return this.client.call(method, request);
//   }

//   public notify(method: string, data: undefined | unknown): void {
//     this.client.notify(method, data);
//   }

//   public stop() {}
// }
