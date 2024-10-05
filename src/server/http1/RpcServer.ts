import * as http from 'http';
import type {Printable} from 'sonic-forest/lib/print/types';
import {printTree} from 'sonic-forest/lib/print/printTree';
import {Http1Server} from './Http1Server';
import {RpcError} from '../../common/rpc/caller';
import {
  type IncomingBatchMessage,
  type ReactiveRpcClientMessage,
  type ReactiveRpcMessage,
  RpcMessageBatchProcessor,
  RpcMessageStreamProcessor,
} from '../../common';
import type {Http1ConnectionContext, WsConnectionContext} from './context';
import type {RpcCaller} from '../../common/rpc/caller/RpcCaller';
import type {ServerLogger} from './types';
import type {ConnectionContext} from '../types';
import {ObjectValueCaller} from '../../common/rpc/caller/ObjectValueCaller';
import {ObjectValue} from 'json-joy/lib/json-type-value/ObjectValue';
import {ObjectType} from 'json-joy/lib/json-type/type/classes';
import {gzip} from '@jsonjoy.com/util/lib/compression/gzip';

const DEFAULT_MAX_PAYLOAD = 4 * 1024 * 1024;

export interface RpcServerOpts {
  http1: Http1Server;
  caller: RpcCaller<any>;
  logger?: ServerLogger;
}

export interface RpcServerStartOpts extends Omit<RpcServerOpts, 'http1'> {
  port?: number;
  server?: http.Server;
}

export class RpcServer implements Printable {
  public static readonly create = (opts: RpcServerOpts) => {
    const server = new RpcServer(opts);
    opts.http1.enableHttpPing();
    return server;
  };

  public static readonly startWithDefaults = (opts: RpcServerStartOpts): RpcServer => {
    const port = opts.port ?? 8080;
    const logger = opts.logger ?? console;
    const server = http.createServer();
    const http1Server = new Http1Server({
      server,
    });
    const rpcServer = new RpcServer({
      caller: opts.caller,
      http1: http1Server,
      logger,
    });
    rpcServer.enableDefaults();
    http1Server.start();
    server.listen(port, () => {
      let host = server.address() || 'localhost';
      if (typeof host === 'object') host = (host as any).address;
      logger.log({msg: 'SERVER_STARTED', host, port});
    });
    return rpcServer;
  };

  public readonly http1: Http1Server;
  protected readonly batchProcessor: RpcMessageBatchProcessor<ConnectionContext>;

  constructor(protected readonly opts: RpcServerOpts) {
    const http1 = (this.http1 = opts.http1);
    const onInternalError = http1.oninternalerror;
    http1.oninternalerror = (error, res, req) => {
      if (error instanceof RpcError) {
        res.statusCode = 400;
        const data = JSON.stringify(error.toJson());
        res.end(data);
        return;
      }
      onInternalError(error, res, req);
    };
    this.batchProcessor = new RpcMessageBatchProcessor<ConnectionContext>({caller: opts.caller});
  }

  public enableHttpPing(): void {
    this.http1.enableHttpPing();
  }

  public enableCors(): void {
    this.http1.route({
      method: 'OPTIONS',
      path: '/{::\n}',
      handler: (ctx) => {
        const res = ctx.res;
        res.writeHead(200, 'OK', {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
          // 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          // 'Access-Control-Allow-Headers': 'Content-Type',
          // 'Access-Control-Max-Age': '86400',
        });
        res.end();
      },
    });
  }

  private processHttpRpcRequest = async (ctx: Http1ConnectionContext) => {
    const res = ctx.res;
    const body = await ctx.body(DEFAULT_MAX_PAYLOAD);
    if (!res.socket) return;
    try {
      const messageCodec = ctx.msgCodec;
      const incomingMessages = messageCodec.decodeBatch(ctx.reqCodec, body);
      try {
        const outgoingMessages = await this.batchProcessor.onBatch(incomingMessages as IncomingBatchMessage[], ctx);
        if (!res.socket) return;
        const resCodec = ctx.resCodec;
        messageCodec.encodeBatch(resCodec, outgoingMessages);
        const buf = resCodec.encoder.writer.flush();
        if (!res.socket) return;
        res.end(buf);
      } catch (error) {
        const logger = this.opts.logger ?? console;
        logger.error('HTTP_RPC_PROCESSING', error, {messages: incomingMessages});
        throw RpcError.from(error);
      }
    } catch (error) {
      if (typeof error === 'object' && error)
        if ((error as any).message === 'Invalid JSON') throw RpcError.badRequest();
      throw RpcError.from(error);
    }
  };

  public enableHttpRpc(path = '/rx'): void {
    const http1 = this.http1;
    http1.route({
      method: 'POST',
      path,
      handler: this.processHttpRpcRequest,
      msgCodec: http1.codecs.messages.compact,
    });
  }
  
  public enableJsonRcp2HttpRpc(path = '/rpc'): void {
    const http1 = this.http1;
    http1.route({
      method: 'POST',
      path,
      handler: this.processHttpRpcRequest,
      msgCodec: http1.codecs.messages.jsonRpc2,
    });
  }

  public enableWsRpc(path = '/rx'): void {
    const opts = this.opts;
    const logger = opts.logger ?? console;
    const caller = opts.caller;
    this.http1.ws({
      path,
      maxIncomingMessage: 2 * 1024 * 1024,
      maxOutgoingBackpressure: 2 * 1024 * 1024,
      handler: (ctx: WsConnectionContext) => {
        const connection = ctx.connection;
        const reqCodec = ctx.reqCodec;
        const resCodec = ctx.resCodec;
        const msgCodec = ctx.msgCodec;
        const encoder = resCodec.encoder;
        const rpc = new RpcMessageStreamProcessor({
          caller,
          send: (messages: ReactiveRpcMessage[]) => {
            try {
              const writer = encoder.writer;
              writer.reset();
              msgCodec.encodeBatch(resCodec, messages);
              const encoded = writer.flush();
              connection.sendBinMsg(encoded);
            } catch (error) {
              logger.error('WS_SEND', error, {messages});
              connection.close();
            }
          },
          bufferSize: 1,
          bufferTime: 0,
        });
        connection.onmessage = (uint8: Uint8Array) => {
          let messages: ReactiveRpcClientMessage[];
          try {
            messages = msgCodec.decodeBatch(reqCodec, uint8) as ReactiveRpcClientMessage[];
          } catch (error) {
            logger.error('RX_RPC_DECODING', error, {codec: reqCodec.id, buf: Buffer.from(uint8).toString('base64')});
            connection.close();
            return;
          }
          try {
            rpc.onMessages(messages, ctx);
          } catch (error) {
            logger.error('RX_RPC_PROCESSING', error, messages!);
            connection.close();
            return;
          }
        };
        connection.onclose = () => {
          rpc.stop();
        };
      },
    });
  }

  /**
   * Exposes JSON Type schema under the GET /schema endpoint.
   */
  public enableSchema(path: string = '/schema', method: string = 'GET'): void {
    const caller = this.opts.caller;
    let responseBody: Uint8Array = Buffer.from('{}');
    if (caller instanceof ObjectValueCaller) {
      const api = caller.router as ObjectValue<ObjectType<any>>;
      const schema = {
        value: api.type.getSchema(),
        types: api.type.system?.exportTypes(),
      };
      responseBody = Buffer.from(JSON.stringify(schema));
    }
    let responseBodyCompressed: Uint8Array = new Uint8Array(0);
    gzip(responseBody).then((compressed) => responseBodyCompressed = compressed);
    this.http1.route({
      method,
      path,
      handler: (ctx) => {
        const res = ctx.res;
        res.writeHead(200, 'OK', {
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Cache-Control': 'public, max-age=3600, immutable',
          'Content-Length': responseBodyCompressed.length,
        });
        res.end(responseBodyCompressed);
      },
    });
  }

  public enableDefaults(): void {
    this.enableCors();
    this.enableHttpPing();
    this.enableHttpRpc();
    this.enableJsonRcp2HttpRpc();
    this.enableWsRpc();
    this.enableSchema();
  }

  // ---------------------------------------------------------------- Printable

  public toString(tab = ''): string {
    return (
      `${this.constructor.name}` +
      printTree(tab, [
        (tab) => this.http1.toString(tab),
        () => '',
        (tab) => (this.opts.caller as unknown as Printable).toString(tab),
      ])
    );
  }
}
