import * as Rx from 'rxjs';
import {Value} from '@jsonjoy.com/json-type/lib/value/Value';
import {RpcError} from './error/RpcError';
import {RpcCaller, type RpcCallerOptions} from './RpcCaller';
import {printTree} from 'tree-dump/lib/printTree';
import {Procedure} from './procedures';
import {ObjValue} from '@jsonjoy.com/json-type';
import {t, Schema, KeyType, Type} from '@jsonjoy.com/json-type';
import {ValidatorCodegen} from '@jsonjoy.com/json-type/lib/codegen/validator/ValidatorCodegen';
import {type AbsType, FnRxType, FnType} from '@jsonjoy.com/json-type/lib/type/classes';
import type {UnObjType, UnObjValue} from '@jsonjoy.com/json-type/lib/value/ObjValue';
import type {Caller, ProcedureReq, ProcedureRes, Procedures} from './types';
import type {Printable} from 'tree-dump';

type ObjectFieldToTuple<F> = F extends KeyType<infer K, infer V> ? [K, V] : never;
type ToObject<T> = T extends [string, unknown][] ? {[K in T[number]as K[0]]: K[1]} : never;
type ObjectFieldsToMap<F> = ToObject<{[K in keyof F]: ObjectFieldToTuple<F[K]>}>;
type ObjectValueToTypeMap<V> = ObjectFieldsToMap<UnObjType<UnObjValue<V>>>;

export type ObjectValueToRpcCallerProcedures<V extends ObjValue<any>, Ctx = unknown> = {
  [K in keyof ObjectValueToTypeMap<V>]:
  ObjectValueToTypeMap<V>[K] extends FnType<infer Req, infer Res>
  ? Procedure<t.infer<Req>, Value<Res>, Ctx> : never}

export type ObjectValueToProcedures<V extends ObjValue<any>, Ctx = unknown> = {
  [K in keyof ObjectValueToRpcCallerProcedures<V, Ctx>]:
  ObjectValueToRpcCallerProcedures<V, Ctx>[K] extends Procedure<infer Req, Value<infer Res>, infer Ctx>
  ? Procedure<Req, Value<Res extends Type ? Res : never>, Ctx> : never}

export interface ObjectValueCallerOptions<V extends ObjValue<any>, Ctx = unknown>
  extends Omit<RpcCallerOptions<ObjectValueToRpcCallerProcedures<V, Ctx>>, 'procedures'> {
  router: V;
}

const fnValueToProcedure = <V extends Value<any>>(fn: V) => {
  const validator = ValidatorCodegen.get({type: fn.type.req, errors: 'object'});
  const requestSchema = (fn.type.req as AbsType<Schema>).getSchema();
  const isRequestVoid = requestSchema.kind === 'con' && requestSchema.value === undefined;
  const validate = isRequestVoid
    ? () => { }
    : (req: unknown) => {
      const error: any = validator(req);
      if (error) {
        const message = error.message + (Array.isArray(error?.path) ? ' Path: /' + error.path.join('/') : '');
        throw RpcError.validation(message, error);
      }
    };
  const procedure =
    fn.type instanceof FnRxType
      ? Procedure.rx(fn.data as any, validate)
      : fn.type instanceof FnType
        ? Procedure.unary(fn.data as any, validate)
        : Procedure.unary(async () => fn.data as any, validate);
  return procedure;
};

const objectValueToProcedures = <V extends ObjValue<any>, Ctx = unknown>(router: V) => {
  const procedures: Procedures = {};
  const data = router.data as Record<string, unknown>;
  for (const key in data) {
    const field = router.get(key);
    procedures[key] = fnValueToProcedure(field);
  }
  return procedures as ObjectValueToRpcCallerProcedures<V, Ctx>;
};

/**
 * Converts a JSON Type ObjectValue (an object type with value methods) into
 * a Reactive-RPC caller which can be used to call methods defined in the
 * ObjectValue. Wraps all respones and errors into JSON Type {@link Value}
 * objects.
 */
export class TypedCaller<Ctx, V extends ObjValue<any>, P extends ObjectValueToProcedures<V, Ctx> = ObjectValueToProcedures<V, Ctx>> implements Caller<Ctx, P>, Printable {
  public readonly router: V;
  public readonly rpc: RpcCaller;

  constructor({router, ...rest}: ObjectValueCallerOptions<V, Ctx>) {
    this.router = router;
    if (!router.type.system) throw new Error('NO_MODULE');
    const procedures = objectValueToProcedures(router);
    this.rpc = new RpcCaller({...rest, procedures});
  }

  protected getResType<K extends keyof P>(name: K) {
    if (typeof name !== 'string') throw RpcError.internal('Method name must be a string.');
    const method = this.router.get(name);
    if (!method) throw RpcError.badRequest(`Method ${String(name)} not found.`);
    if (method instanceof FnType) return method.res;
    if (method instanceof FnRxType) return method.res;
    return method.type.res;
  }

  /** -------------------------------------------------------- {@link Caller} */

  public async call<K extends keyof P>(name: K, request: ProcedureReq<P[K]>, ctx: Ctx): Promise<ProcedureRes<P[K]>> {
    const type = this.getResType(name as any);
    const data = await this.rpc.call(name as any, request, ctx);
    const value = new Value(type as any, data);
    return value as ProcedureRes<P[K]>;
  }

  public call$<K extends keyof P>(name: K, request$: Rx.Observable<ProcedureReq<P[K]>>, ctx: Ctx): Rx.Observable<ProcedureRes<P[K]>> {
    return Rx.of(this.getResType(name as any) as Type).pipe(
      Rx.switchMap((type) => this.rpc.call$(name as any, request$, ctx).pipe(
        Rx.map(data => new Value(type, data)))
      )
    ) as any;
  }

  public notify<K extends keyof P>(name: K, request: ProcedureReq<P[K]>, ctx: Ctx): Promise<void> {
    this.getResType(name as any);
    return this.rpc.notify(name as any, request, ctx);
  }

  /** ----------------------------------------------------- {@link Printable} */

  public toString(tab = ''): string {
    return (
      `${this.constructor.name}` +
      printTree(tab, [(tab) => this.router.toString(tab), (tab) => this.router.system.toString(tab)])
    );
  }
}
