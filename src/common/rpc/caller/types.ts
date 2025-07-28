import type {Observable, Observer, Subject} from 'rxjs';
import type {IStaticRpcMethod, IStreamingRpcMethod} from '../methods/types';
import type {RpcValue} from '../../messages/Value';

export type RpcApiMap<Ctx = unknown> = {
  [name: string]: IStaticRpcMethod<Ctx, any, any> | IStreamingRpcMethod<Ctx, any, any>;
};

/**
 * Represents an in-flight call.
 */
export interface Call<Req = unknown, Res = unknown> {
  req$: Observer<Req>;
  reqUnsubscribe$: Observable<null>;
  stop$: Subject<null>;
  res$: Observable<RpcValue<Res>>;
}

export type CallerCall<Req = unknown, Res = unknown> = [req: Req, res: Res];
export type CallerMethods<T = unknown> = Record<string, CallerCall<T, T>>;

export interface Caller<Ctx = unknown, Methods extends CallerMethods<any> = CallerMethods> {
  call<K extends keyof Methods>(name: K, request: Observable<Methods[K][0]>, ctx: Ctx): Promise<Methods[K][1]>;
  call$<K extends keyof Methods>(name: K, request$: Observable<Methods[K][0]> | Methods[K][0], ctx: Ctx): Observable<Methods[K][1]>;
  notify<K extends keyof Methods>(method: K, data: Observable<Methods[K][0]>, ctx: Ctx): void;
}
