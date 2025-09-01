import type * as msg from '../messages';
import {firstValueFrom, type Observable, ReplaySubject, timer} from 'rxjs';
import {filter, first, share, switchMap, takeUntil} from 'rxjs/operators';
import {RxClient, RxClientOptions} from './RxClient';
import {PersistentChannel, type PersistentChannelParams} from '../channel/physical/PersistentChannel';
import type {RpcCodec} from '../codec/RpcCodec';
import type {RpcClient, RpcClientMethods} from './types';

export interface RpcPersistentClientParams {
  channel: PersistentChannelParams;
  codec: RpcCodec;
  client?: Omit<RxClientOptions, 'channel'>;

  /**
   * Number of milliseconds to periodically send keep-alive ".ping" notification
   * messages. If not specified, will default to 15,000 (15 seconds). If 0, will
   * not send ping messages.
   */
  ping?: number;

  /**
   * The notification method name that is used for ping keep-alive messages, if
   * not specified, defaults to ".ping".
   */
  pingMethod?: string;
}

/**
 * RPC client which automatically reconnects if disconnected.
 */
export class RpcPersistentClient<Methods extends RpcClientMethods<any> = RpcClientMethods> implements RpcClient<Methods> {
  public channel: PersistentChannel;
  public rpc?: RxClient<Methods>;
  public readonly rpc$ = new ReplaySubject<RxClient<Methods>>(1);

  constructor(params: RpcPersistentClientParams) {
    const ping = params.ping ?? 15000;
    const codec = params.codec;
    const textEncoder = new TextEncoder();
    this.channel = new PersistentChannel(params.channel);
    this.channel.open$.pipe(filter((open) => open)).subscribe(() => {
      const close$ = this.channel.open$.pipe(filter((open) => !open));
      const client = new RxClient<Methods>({
        ...params.client,
        channel,
      });

      this.channel.message$.pipe(takeUntil(close$)).subscribe((data) => {
        const encoded = typeof data === 'string' ? textEncoder.encode(data) : new Uint8Array(data);
        const messages = codec.decode(encoded, codec.res);
        client.onMessages((messages instanceof Array ? messages : [messages]) as msg.RpcServerMessage[]);
      });

      // Send ping notifications to keep the connection alive.
      if (ping) {
        timer(ping, ping)
          .pipe(takeUntil(close$))
          .subscribe(() => {
            client.notify(params.pingMethod || '.ping', undefined as any);
          });
      }

      if (this.rpc) this.rpc.disconnect();
      this.rpc = client;
      this.rpc$.next(client);
    });
  }

  public call$<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]> | Methods[K][0]): Observable<Methods[K][1]> {
    return this.rpc$.pipe(
      first(),
      switchMap((rpc) => rpc.call$(method, data as any)),
      share(),
    );
  }

  public async call<K extends keyof Methods>(method: K, request: Observable<Methods[K][0]>): Promise<Methods[K][1]> {
    return firstValueFrom(this.call$(method, request));
  }

  public notify<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]>): void {
    this.rpc$.subscribe((rpc) => rpc.notify(method, data));
  }

  public start() {
    this.channel.start();
  }

  public stop() {
    this.channel.stop();
    if (this.rpc) this.rpc.stop();
  }
}
