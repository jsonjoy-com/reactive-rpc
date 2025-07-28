import type {Observable} from 'rxjs';

export type RpcClientCall<Req = unknown, Res = unknown> = [req: Req, res: Res];
export type RpcClientNote<Req = unknown> = [req: Req];
export type RpcClientMethods<T = unknown> = Record<string, RpcClientCall<T, T>>;
export type RpcClientNotifications<T = unknown> = Record<string, RpcClientNote<T>>;

export interface RpcClient<Methods extends RpcClientMethods<any> = RpcClientMethods, Notifications extends RpcClientNotifications<any> = RpcClientNotifications> {
  /**
   * Execute a streaming RPC method.
   *
   * @param method RPC method name.
   * @param data RPC method static payload or stream of data.
   */
  call$<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]> | Methods[K][0]): Observable<Methods[K][1]>;

  /**
   * Execute a one-way RPC method.
   *
   * @param method RPC method name.
   * @param request RPC method static payload.
   */
  call<K extends keyof Methods>(method: K, request: Observable<Methods[K][0]>): Promise<Methods[K][1]>;

  /**
   * Send a one-way notification message without expecting any response.
   *
   * @param method Remote method name.
   * @param data Static payload data.
   */
  notify<K extends keyof Notifications>(method: K, data: Observable<Notifications[K][0]>): void;

  // start(): void;
  // stop(): void;
}
