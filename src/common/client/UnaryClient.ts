import {TimedQueue} from '../util/TimedQueue';
import {Defer} from '../../util/Defer';
import {Observable, of, switchMap} from 'rxjs';
import {CompactMessageType} from '../codec/compact/constants';
import type * as compact from '../codec/compact';
import type {RpcClient, RpcClientMethods} from './types';

/**
 * Configuration parameters for {@link UnaryClient}.
 */
export interface UnaryClientOptions {
  /**
   * Method to be called by client when it wants to send messages to the server.
   * This is usually connected to your WebSocket "send" method.
   */
  send?: (messages: compact.CompactClientMessage[]) => Promise<compact.CompactServerMessage[]>;

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
}

/**
 * Implements an *unary* RPC client, a client which can send a single request
 * and receive a single response for each call. However, it does support
 * batching of messages, so multiple requests can be sent at once and
 * received in a single response.
 *
 * (This means `.call$()` is supported, it sends and receives a single message.)
 */
export class UnaryClient<Methods extends RpcClientMethods<any> = RpcClientMethods> implements RpcClient<Methods> {
  private id = 1;
  public readonly buffer: TimedQueue<compact.CompactClientMessage>;
  public onsend: ((messages: compact.CompactClientMessage[]) => Promise<compact.CompactServerMessage[]>) = async () => {
    throw new Error('onsend not implemented');
  };

  /**
   * In-flight RPC calls.
   */
  private readonly calls = new Map<number, Defer<unknown>>();

  constructor({send, bufferSize = 100, bufferTime = 10}: UnaryClientOptions) {
    if (send) this.onsend = send;
    this.buffer = new TimedQueue();
    this.buffer.itemLimit = bufferSize;
    this.buffer.timeLimit = bufferTime;
    this.buffer.onFlush = (messages: compact.CompactClientMessage[]) => {
      this.onsend(messages)
        .then((responses: compact.CompactServerMessage[]) => {
          for (const response of responses) {
            const type = response[0];
            const id = response[1] as number;
            const calls = this.calls;
            const future = calls.get(id);
            calls.delete(id);
            if (!future) continue;
            if (type === CompactMessageType.ResponseComplete) future.resolve(response[2]);
            else if (type === CompactMessageType.ResponseError) future.reject(response[2]);
          }
        })
        .catch((error) => {
          for (const message of messages) {
            const type = message[0];
            if (type === CompactMessageType.RequestComplete) {
              const id = message[1];
              const calls = this.calls;
              const future = calls.get(id);
              calls.delete(id);
              if (!future) continue;
              future.reject(error);
            }
          }
        })
        .finally(() => {
          for (const message of messages)
            if (message[0] === CompactMessageType.RequestComplete) this.calls.delete(message[1]);
        });
    };
  }

  public call$<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]> | Methods[K][0]): Observable<Methods[K][1]> {
    return (data instanceof Observable ? data : of(data)).pipe(switchMap((data) => this.call(method, data)));
  }

  public async call<K extends keyof Methods>(method: K, request: Methods[K][0]): Promise<Methods[K][1]> {
    const id = this.id++;
    if (this.id >= 0xffff) this.id = 1;
    const message: compact.CompactRequestCompleteMessage = [CompactMessageType.RequestComplete, id, method as string, request];
    const future = new Defer<unknown>();
    this.calls.set(id, future);
    this.buffer.push(message);
    return await future.promise;
  }

  /**
   * Send a one-way notification message without expecting any response.
   *
   * @param method Remote method name.
   * @param data Static payload data.
   */
  public notify<K extends keyof Methods>(method: K, data: Methods[K][0]): void {
    const msg: compact.CompactNotificationMessage = [CompactMessageType.Notification, method as string, data];
    this.buffer.push(msg);
  }

  public stop() {}
}
