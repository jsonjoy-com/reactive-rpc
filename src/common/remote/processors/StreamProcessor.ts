import * as msg from '../../messages';
import {TimedQueue} from '../../util/TimedQueue';
import {RpcErrorCodes, RpcError} from 'rpc-error';
import {subscribeCompleteObserver} from '../../util/subscribeCompleteObserver';
import {TypedRpcError} from '../../caller/error/typed';
import {unknown, Value} from '@jsonjoy.com/json-type';
import type {Call} from '../../caller/Call';
import type {Caller} from '../../caller';
import type {ServerLogger, WsConnection} from '../types';
import type {WsConnectionContext} from '../context/WsConnectionContext';
import type {Observable} from 'rxjs';

export interface StreamProcessorOptions<Ctx = unknown> {
  caller: Caller<Ctx, any>;

  /**
   * WebSocket connection for receiving and sending messages.
   */
  connection: WsConnection;

  /**
   * Context for decoding and encoding messages.
   */
  ctx: Ctx;

  /**
   * Number of messages to keep in buffer before sending them out.
   * The buffer is flushed when the message reaches this limit or when the
   * buffering time has reached the time specified in `bufferTime` parameter.
   * Defaults to 10 messages.
   */
  bufferSize?: number;

  /**
   * Time in milliseconds for how long to buffer messages before sending them
   * out. Defaults to 1 milliseconds. Set it to zero to disable buffering.
   */
  bufferTime?: number;

  /**
   * Logger for the stream processor.
   */
  logger: ServerLogger;
}

/**
 * Processes incoming Reactive-RPC messages and manages in-flight calls. Used
 * for WebSocket servers to handle messages. Implements server-side
 * part of Reactive-RPC protocol. Can buffer outgoing messages to optimize
 * network usage.
 */
export class StreamProcessor<Ctx extends WsConnectionContext = WsConnectionContext> {
  protected readonly caller: Caller<Ctx, any>;
  protected readonly connection: WsConnection;
  protected readonly ctx: Ctx;
  private readonly activeStreamCalls: Map<number, Call<unknown, unknown>> = new Map();
  protected send: (message: msg.RpcServerMessage | msg.NotificationMessage) => void;
  protected logger: ServerLogger;

  constructor({caller, connection, ctx, bufferSize = 10, bufferTime = 1, logger}: StreamProcessorOptions<Ctx>) {
    this.caller = caller;
    this.connection = connection;
    this.ctx = ctx;
    this.logger = logger;
    const msgCodec = ctx.codec.msg;
    const reqCodec = ctx.codec.req;
    const resCodec = ctx.codec.res;
    const send = (messages: (msg.RpcServerMessage | msg.NotificationMessage)[]) => {
      try {
        const encoded = msgCodec.encode(resCodec, messages);
        connection.write(encoded);
      } catch (error) {
        logger.error('WS_SEND_', error, {messages});
        connection.close();
      }
    };

    if (bufferTime) {
      const buffer = new TimedQueue<msg.RpcServerMessage | msg.NotificationMessage>();
      buffer.itemLimit = bufferSize;
      buffer.timeLimit = bufferTime;
      buffer.onFlush = (messages) => send(messages as any);
      this.send = (message) => {
        buffer.push(message as any);
      };
    } else {
      this.send = (message) => send([message as any]);
    }

    connection.onmessage = (uint8: Uint8Array) => {
      let messages: msg.RpcClientMessage[];
      try {
        messages = msgCodec.readChunk(reqCodec, uint8) as msg.RpcClientMessage[];
      } catch (error) {
        logger.error('RX_RPC_DECODING', error, {codec: reqCodec.id, buf: Buffer.from(uint8).toString('base64')});
        connection.close();
        return;
      }
      try {
        this.onMessages(messages, ctx);
      } catch (error) {
        logger.error('RX_RPC_PROCESSING', error, messages!);
        connection.close();
        return;
      }
    };
    connection.onclose = () => {
      this.stop();
    };
  }

  /**
   * Processes a single incoming Reactive-RPC message.
   *
   * @param message A single Reactive-RPC message.
   * @param ctx Server context.
   */
  public onMessage(message: msg.RpcClientMessage, ctx: Ctx): void {
    if (message instanceof msg.RequestDataMessage) this.onRequestDataMessage(message, ctx);
    else if (message instanceof msg.RequestCompleteMessage) this.onRequestCompleteMessage(message, ctx);
    else if (message instanceof msg.RequestErrorMessage) this.onRequestErrorMessage(message, ctx);
    else if (message instanceof msg.NotificationMessage) this.onNotificationMessage(message, ctx);
    else if (message instanceof msg.ResponseUnsubscribeMessage) this.onUnsubscribeMessage(message);
  }

  /**
   * Receives a list of all incoming messages from the client to process.
   *
   * @param messages A list of received messages.
   * @param ctx Server context.
   */
  public onMessages(messages: msg.RpcClientMessage[], ctx: Ctx): void {
    const length = messages.length;
    for (let i = 0; i < length; i++) this.onMessage(messages[i], ctx);
  }

  public sendNotification(method: string, value: Value): void {
    const message = new msg.NotificationMessage(method, value instanceof Value ? value : unknown(value));
    this.send(message);
  }

  protected sendCompleteMessage(id: number, value: Value | unknown | undefined): void {
    const message = new msg.ResponseCompleteMessage(id, value instanceof Value ? value : unknown(value));
    this.send(message);
  }

  protected sendDataMessage(id: number, value: Value): void {
    const message = new msg.ResponseDataMessage(id, value instanceof Value ? value : unknown(value));
    this.send(message);
  }

  protected sendErrorMessage(id: number, value: Value): void {
    if (value instanceof RpcError) value = TypedRpcError.value(value);
    if (!(value instanceof Value)) value = unknown(value);
    const message = new msg.ResponseErrorMessage(id, value);
    this.send(message);
  }

  protected sendUnsubscribeMessage(id: number): void {
    const message = new msg.RequestUnsubscribeMessage(id);
    this.send(message);
  }

  protected execStaticCall(id: number, name: string, request: unknown, ctx: Ctx): void {
    this.caller
      .call(name, request as any, ctx)
      .then((value: any) => this.sendCompleteMessage(id, value))
      .catch((value: any) => this.sendErrorMessage(id, value));
  }

  protected onStreamError = (id: number, error: Value): void => {
    this.sendErrorMessage(id, error);
    this.activeStreamCalls.delete(id);
  };

  public stop(reason: RpcErrorCodes = RpcErrorCodes.STOP) {
    this.send = <any>(() => {});
    for (const call of this.activeStreamCalls.values()) {
      try {
        call.req$.error(TypedRpcError.valueFromCode(reason));
        call.stop$.next(null);
      } catch (error) {
        // tslint:disable-next-line no-console
        console.error('STOPPING_ERROR', error);
      }
    }
    this.activeStreamCalls.clear();
  }

  public disconnect() {
    this.stop(RpcErrorCodes.DISCONNECT);
  }

  private sendError(id: number, code: RpcErrorCodes): void {
    const data = TypedRpcError.valueFromCode(code);
    this.sendErrorMessage(id, data);
  }

  private createStreamCall(id: number, name: string, ctx: Ctx): Call<unknown, unknown> {
    const call = this.caller.createCall(name, ctx);
    this.activeStreamCalls.set(id, call);
    // call.res$.subscribe({
    //   next: (value: RpcValue) => this.sendDataMessage(id, value),
    //   error: (error: unknown) => this.onStreamError(id, error as RpcValue),
    //   complete: () => {
    //     this.activeStreamCalls.delete(id);
    //     this.sendCompleteMessage(id, undefined);
    //   },
    // });
    subscribeCompleteObserver<Value>(call.res$ as Observable<Value>, {
      next: (value: Value) => {
        this.sendDataMessage(id, value);
      },
      error: (error: unknown) => {
        this.onStreamError(id, error as Value)
      },
      complete: (value: Value | undefined) => {
        this.activeStreamCalls.delete(id);
        this.sendCompleteMessage(id, value);
      },
    });
    call.reqUnsubscribe$.subscribe(() => {
      if (this.activeStreamCalls.has(id)) this.sendUnsubscribeMessage(id);
    });
    return call;
  }

  public onRequestDataMessage(message: msg.RequestDataMessage, ctx: Ctx): void {
    const {id, method, value} = message;
    let call = this.activeStreamCalls.get(id);
    if (!call) {
      if (!method) {
        this.sendError(id, RpcErrorCodes.METHOD_INV);
        return;
      }
      const info = this.caller.info(method);
      if (!info) {
        this.sendError(id, RpcErrorCodes.METHOD_UNK);
        return;
      }
      if (info.rx) {
        call = this.createStreamCall(id, method, ctx);
      } else {
        this.execStaticCall(id, method, value ? value.data : undefined, ctx);
        return;
      }
    }
    if (call) {
      const data = value ? value.data : undefined;
      if (data !== undefined) {
        call.req$.next(data);
      }
    }
  }

  public onRequestCompleteMessage(message: msg.RequestCompleteMessage, ctx: Ctx): void {
    const {id, method, value} = message;
    const call = this.activeStreamCalls.get(id);
    if (call) {
      const {req$} = call;
      const data = value ? value.data : undefined;
      if (data !== undefined) req$.next(data);
      req$.complete();
      return;
    }
    if (!method) {
      // If existing call not found, and method is not specified, it was
      // a *RequestComplete* message sent to a previous call, which already
      // completed, so we just ignore it.
      return;
    }
    const caller = this.caller;
    const info = caller.info(method);
    if (!info) {
      this.sendError(id, RpcErrorCodes.METHOD_UNK);
      return;
    }
    const data = value ? value.data : undefined;
    this.execStaticCall(id, method, data, ctx);
  }

  public onRequestErrorMessage(message: msg.RequestErrorMessage, ctx: Ctx): void {
    const {id, method, value} = message;
    const call = this.activeStreamCalls.get(id);
    if (call) {
      call.req$.error(value.data);
      return;
    }
    if (!method) {
      this.sendError(id, RpcErrorCodes.METHOD_INV);
      return;
    }
    const info = this.caller.info(method);
    if (!info) {
      this.sendError(id, RpcErrorCodes.METHOD_UNK);
      return;
    }
    if (!info.rx) {
      void this.sendError(id, RpcErrorCodes.METHOD_UNK);
      return;
    }
    const streamCall = this.createStreamCall(id, method, ctx);
    if (!streamCall) return;
    streamCall.req$.error(value.data);
  }

  public onUnsubscribeMessage(message: msg.ResponseUnsubscribeMessage): void {
    const {id} = message;
    const call = this.activeStreamCalls.get(id);
    if (!call) return;
    this.activeStreamCalls.delete(id);
    call.req$.complete();
  }

  public onNotificationMessage(message: msg.NotificationMessage, ctx: Ctx): void {
    const {method, value} = message;
    if (!method || method.length > 128) throw RpcError.fromErrno(RpcErrorCodes.METHOD_INV);
    const request = value && typeof value === 'object' ? value?.data : undefined;
    this.caller.notify(method, request, ctx).catch(() => {});
  }
}
