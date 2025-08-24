import {Observable, of} from 'rxjs';
import type {RpcCaller} from '../caller/RpcCaller';
import type {ProcedureReq, ProcedureRes, Procedures} from '../caller';
import type {ProceduresToClientMethods, RpcClient} from './types';

export class CallerClient<Ctx = unknown, P extends Procedures<any> = Procedures<Ctx>> implements RpcClient<ProceduresToClientMethods<P>> {
  constructor(protected readonly caller: RpcCaller<Ctx, P>, public ctx: Ctx) {}

  public call$<K extends keyof P>(method: K, data: Observable<ProcedureReq<P[K]>> | ProcedureReq<P[K]>): Observable<ProcedureRes<P[K]>> {
    return this.caller.call$(method, data instanceof Observable ? data : of(data), this.ctx);
  }

  public call<K extends keyof P>(method: K, request: ProcedureReq<P[K]>): Promise<ProcedureRes<P[K]>> {
    return this.caller.call(method, request, this.ctx);
  }

  public notify<K extends keyof P>(method: K, data: ProcedureReq<P[K]>): void {
    this.caller.notify(method, data, this.ctx);
  }
}
