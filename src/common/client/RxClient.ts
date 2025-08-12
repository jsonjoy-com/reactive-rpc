import {firstValueFrom, isObservable, Observable, type Observer, Subject} from 'rxjs';
import {subscribeCompleteObserver} from '../util/subscribeCompleteObserver';
import {TimedQueue} from '../util/TimedQueue';
import {CompactMessageType} from '../codec/compact/constants';
import type * as compact from '../codec/compact';
import type {RpcClient, RpcClientMethods} from './types';

/**
 * An in-flight RPC call record.
 */
class Call {
  constructor(
    /* In-between observable for request stream. */
    public readonly req$: Subject<unknown>,
    /* In-between observable for response stream. */
    public readonly res$: Subject<unknown>,
    /** Whether response stream was finalized by server. */
    public resFinalized: boolean,
  ) {}
}

/**
 * Configuration parameters for {@link RxClient}.
 */
export interface RxClientOptions {
  /**
   * Method to be called by client when it wants to send messages to the server.
   * This is usually connected to your WebSocket "send" method.
   */
  send: (messages: compact.CompactClientMessage[]) => void;

  /**
   * Number of messages to keep in buffer before sending them to the server.
   * The buffer is flushed when the message reaches this limit or when the
   * buffering time has reached the time specified in `bufferTime` parameter.
   * Defaults to 100 messages.
   */
  bufferSize?: number;

  /**
   * Time in milliseconds for how long to buffer messages before sending them
   * to the server. Defaults to 10 milliseconds.
   */
  bufferTime?: number;

  onNotification?: (method: string, data: unknown) => void;
}

/**
 * Implements client-side part of Reactive-RPC protocol.
 *
 * ## Usage
 *
 * Connect RPC client to WebSocket:
 *
 * ```ts
 * const client = new RpcClient({
 *   send: (messages) => ws.send(serialize(messages)),
 * });
 * ws.on('message', (event) => {
 *   client.onMessages(deserialize(event.data));
 * });
 * ```
 *
 * Send notifications to the server:
 *
 * ```ts
 * client.notify(method, payload);
 * ```
 *
 * Execute RPC methods with streaming support:
 *
 * ```ts
 * client.call(method, data$).subscribe((value) => {
 *   // ...
 * });
 * ```
 */
export class RxClient<Methods extends RpcClientMethods<any> = RpcClientMethods> implements RpcClient<Methods> {
  private id = 1;
  public readonly buffer: TimedQueue<compact.CompactClientMessage>;

  /**
   * In-flight RPC calls.
   */
  private readonly calls = new Map<number, Call>();

  private _notif: (method: string, data: unknown) => void;

  constructor({send, bufferSize = 100, bufferTime = 10, onNotification = () => {}}: RxClientOptions) {
    this.buffer = new TimedQueue();
    this.buffer.itemLimit = bufferSize;
    this.buffer.timeLimit = bufferTime;
    this.buffer.onFlush = send;
    this._notif = onNotification;
  }

  /**
   * Returns the number of active in-flight calls. Useful for reporting and
   * testing for memory leaks in unit tests.
   *
   * @returns Number of in-flight RPC calls.
   */
  public getInflightCallCount(): number {
    return this.calls.size;
  }

  /**
   * Processes a batch of messages received from the server.
   *
   * @param messages List of messages from server.
   */
  public onMessages(messages: compact.CompactServerMessage[]): void {
    const length = messages.length;
    for (let i = 0; i < length; i++) this.onMessage(messages[i]);
  }

  /**
   * Processes a message received from the server.
   *
   * @param messages A message from the server.
   */
  public onMessage(message: compact.CompactServerMessage): void {
    const type = message[0];
    if (type === CompactMessageType.ResponseComplete) this.onResponseComplete(message);
    else if (type === CompactMessageType.ResponseData) this.onResponseData(message);
    else if (type === CompactMessageType.ResponseError) this.onResponseError(message);
    else if (type === CompactMessageType.RequestUnsubscribe) this.onRequestUnsubscribe(message);
    else if (type === CompactMessageType.Notification) this._notif(message[1], message[2]);
    else console.warn('Unknown message type', type, message);
  }

  public onResponseComplete([, id, data]: compact.CompactResponseCompleteMessage): void {
    const call = this.calls.get(id);
    if (!call) return;
    call.resFinalized = true;
    if (data !== void 0) call.res$.next(data);
    call.res$.complete();
  }

  public onResponseData([, id, data]: compact.CompactResponseDataMessage): void {
    const call = this.calls.get(id);
    if (!call) return;
    call.res$.next(data);
  }

  public onResponseError([, id, data]: compact.CompactResponseErrorMessage): void {
    const call = this.calls.get(id);
    if (!call) return;
    call.resFinalized = true;
    call.res$.error(data);
  }

  public onRequestUnsubscribe([, id]: compact.CompactRequestUnsubscribeMessage): void {
    const call = this.calls.get(id);
    if (!call) return;
    call.req$.complete();
  }

  /**
   * Execute remote RPC method. We use in-between `req$` and `res$` observables.
   *
   * ```
   * +--------+      +--------+
   * |  data  |  ->  |  req$  |  ->  Server messages
   * +--------+      +--------+
   *
   *                      +--------+      +-------------------+
   * Server messages  ->  |  res$  |  ->  |  user observable  |
   *                      +--------+      +-------------------+
   * ```
   *
   * @param method RPC method name.
   * @param data RPC method static payload or stream of data.
   */
  public call$<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]> | Methods[K][0]): Observable<Methods[K][1]> {
    const id = this.id++;
    if (this.id >= 0xffff) this.id = 1;
    if (this.calls.has(id)) return this.call$(method, data as any);
    const req$ = new Subject<unknown>();
    const res$ = new Subject<unknown>();
    let finalizedStreams = 0;
    const cleanup = () => {
      finalizedStreams++;
      if (finalizedStreams === 2) this.calls.delete(id);
    };
    res$.subscribe({error: cleanup, complete: cleanup});
    const entry = new Call(req$, res$, false);
    this.calls.set(id, entry);
    if (isObservable(data)) {
      let firstMessageSent = false;
      subscribeCompleteObserver<unknown>(req$, {
        next: (value) => {
          const messageMethod = firstMessageSent ? '' : method;
          firstMessageSent = true;
          const message: compact.CompactRequestDataMessage = [CompactMessageType.RequestData, id, messageMethod as string, value];
          this.buffer.push(message);
        },
        error: (error) => {
          cleanup();
          const messageMethod = firstMessageSent ? '' : method;
          // TODO: Should normalize error to RpcError or POJO...
          const message: compact.CompactRequestErrorMessage = [CompactMessageType.RequestError, id, messageMethod as string, error];
          this.buffer.push(message);
        },
        complete: (value) => {
          cleanup();
          const messageMethod = firstMessageSent ? '' : method;
          const message: compact.CompactRequestCompleteMessage = [CompactMessageType.RequestComplete, id, messageMethod as string, value];
          this.buffer.push(message);
        },
      });
      data.subscribe(req$);
    } else {
      const message: compact.CompactRequestCompleteMessage = [CompactMessageType.RequestComplete, id, method as string, data];
      this.buffer.push(message);
      req$.complete();
      cleanup();
    }
    return new Observable<unknown>((observer: Observer<unknown>) => {
      res$.subscribe(observer);
      return () => {
        if (!entry.resFinalized) {
          const message: compact.CompactResponseUnsubscribeMessage = [CompactMessageType.ResponseUnsubscribe, id];
          this.buffer.push(message);
        }
        res$.complete();
      };
    });
  }

  public async call<K extends keyof Methods>(method: K, request: Observable<Methods[K][0]>): Promise<Methods[K][1]> {
    return await firstValueFrom(this.call$(method, request));
  }

  /**
   * Send a one-way notification message without expecting any response.
   *
   * @param method Remote method name.
   * @param data Static payload data.
   */
  public notify<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]>): void {
    const message: compact.CompactNotificationMessage = [CompactMessageType.Notification, method as string, data];
    this.buffer.push(message);
  }

  /**
   * Stop all in-flight RPC calls and disable buffer. This operation is not
   * reversible, you cannot use the RPC client after this call.
   */
  public stop(reason = 'STOP'): void {
    this.buffer.onFlush = () => {};
    for (const call of this.calls.values()) {
      call.req$.error(new Error(reason));
      call.req$.error(new Error(reason));
    }
    this.calls.clear();
  }

  public disconnect() {
    this.stop('DISCONNECT');
  }
}
