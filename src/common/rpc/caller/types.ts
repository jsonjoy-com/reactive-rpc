import type {Observable} from 'rxjs';
import type {Procedure} from '../procedures';

export type Procedures<Ctx = unknown> = Record<string, Procedure<any, any, Ctx>>;
export type ProceduresCtx<P extends Procedures> = P extends Procedures<infer Ctx> ? Ctx : unknown;
export type ProcedureReq<P> = P extends Procedure<infer Req, any, any> ? Req : never;
export type ProcedureRes<P> = P extends Procedure<any, infer Res, any> ? Res : never;

/**
 * A *caller* is a server-side object which implements methods to call
 * Reactive-RPC {@link Procedures} (methods) on the server. The "server" is a
 * logical concept, it may be a remote server or a local one.
 */
export interface Caller<Ctx = unknown, P extends Procedures<any> = Procedures<Ctx>> {
  call<K extends keyof P>(name: K, request: ProcedureReq<P[K]>, ctx: Ctx): Promise<ProcedureRes<P[K]>>;
  call$<K extends keyof P>(name: K, request$: Observable<ProcedureReq<P[K]>> | ProcedureReq<P[K]>, ctx: Ctx): Observable<ProcedureRes<P[K]>>;
  notify<K extends keyof P>(method: K, data: ProcedureReq<P[K]>, ctx: Ctx): Promise<void>;
}
