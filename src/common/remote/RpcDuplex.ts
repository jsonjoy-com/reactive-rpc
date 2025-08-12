import type {Observable} from 'rxjs';
import * as msg from '../messages';
import type {StreamingRpcClient} from './client/StreamingRpcClient';
import type {RpcMessageStreamProcessor} from './RpcMessageStreamProcessor';
import type {RpcClient, RpcClientMethods} from './client';

export interface RpcDuplexParams<Ctx = unknown, Methods extends RpcClientMethods<any> = RpcClientMethods> {
  client: StreamingRpcClient<Methods>;
  server: RpcMessageStreamProcessor<Ctx>;
}

export class RpcDuplex<Ctx = unknown, Methods extends RpcClientMethods<any> = RpcClientMethods> implements RpcClient<Methods> {
  public readonly client: StreamingRpcClient<Methods>;
  public readonly server: RpcMessageStreamProcessor<Ctx>;

  public constructor(params: RpcDuplexParams<Ctx, Methods>) {
    this.client = params.client;
    this.server = params.server;
  }

  public onMessages(messages: msg.ReactiveRpcMessage[], ctx: Ctx): void {
    const length = messages.length;
    for (let i = 0; i < length; i++) this.onMessage(messages[i], ctx);
  }

  public onMessage(message: msg.ReactiveRpcMessage, ctx: Ctx): void {
    if (message instanceof msg.RequestDataMessage) this.server.onRequestDataMessage(message, ctx);
    else if (message instanceof msg.RequestCompleteMessage) this.server.onRequestCompleteMessage(message, ctx);
    else if (message instanceof msg.RequestErrorMessage) this.server.onRequestErrorMessage(message, ctx);
    else if (message instanceof msg.ResponseUnsubscribeMessage) this.server.onUnsubscribeMessage(message);
    else if (message instanceof msg.NotificationMessage) this.server.onNotificationMessage(message, ctx);
    else if (message instanceof msg.ResponseCompleteMessage) this.client.onResponseComplete(message);
    else if (message instanceof msg.ResponseDataMessage) this.client.onResponseData(message);
    else if (message instanceof msg.ResponseErrorMessage) this.client.onResponseError(message);
    else if (message instanceof msg.RequestUnsubscribeMessage) this.client.onRequestUnsubscribe(message);
  }

  public call$<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]> | Methods[K][0]): Observable<Methods[K][1]> {
    return this.client.call$(method, data as any);
  }

  public async call<K extends keyof Methods>(method: K, request: Observable<Methods[K][0]>): Promise<Methods[K][1]> {
    return this.client.call(method, request);
  }

  public notify<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]>): void {
    this.client.notify(method, data);
  }

  public stop() {
    this.client.stop();
    this.server.stop();
  }

  public disconnect() {
    this.client.disconnect();
    this.server.disconnect();
  }
}
