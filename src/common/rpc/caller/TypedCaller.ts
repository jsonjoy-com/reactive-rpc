import * as Rx from 'rxjs';
import {RpcError} from './error/RpcError';
import {RpcCaller, type RpcCallerOptions} from './RpcCaller';
import {printTree} from 'tree-dump/lib/printTree';
import {Procedure} from './procedures';
import {type AbsType, FnRxType, FnType} from '@jsonjoy.com/json-type/lib/type/classes';
import {Value} from '@jsonjoy.com/json-type/lib/value/Value';
import type {ObjValue} from '@jsonjoy.com/json-type';
import type {UnObjType, UnObjValue} from '@jsonjoy.com/json-type/lib/value/ObjValue';
import type {Caller, ProcedureReq, ProcedureRes, Procedures} from './types';
import type {t, Schema, KeyType, Type} from '@jsonjoy.com/json-type';
import type {Printable} from 'tree-dump';

// const Example = ObjectValue.create().
//   prop('ping', t.Function(t.any, t.Const(<const>'pong')), async () => 'pong');
// type A = ObjectValueToRpcCallerProcedures<typeof Example>;
// type B = ObjectValueToProcedures<typeof Example>;

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
  ? Procedure<Req, t.infer<Res extends Type ? Res : never>, Ctx> : never}

export interface ObjectValueCallerOptions<V extends ObjValue<any>, Ctx = unknown>
  extends Omit<RpcCallerOptions<ObjectValueToRpcCallerProcedures<V, Ctx>>, 'procedures'> {
  router: V;
}

const fnValueToProcedure = <V extends Value<any>>(fn: V) => {
  const validator = fn.type.req.validator('object');
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
export class TypedCaller<Ctx, V extends ObjValue<any>> implements Caller<Ctx, ObjectValueToProcedures<V, Ctx>>, Printable {
  public readonly router: V;
  public readonly rpc: RpcCaller;

  constructor({router, ...rest}: ObjectValueCallerOptions<V, Ctx>) {
    this.router = router;
    if (!router.type.system) throw new Error('NO_SYSTEM');
    this.rpc = new RpcCaller({
      ...rest,
      procedures: objectValueToProcedures(router),
    });
  }

  protected getResType<K extends keyof ObjectValueToProcedures<V, Ctx>>(name: K): ProcedureRes<ObjectValueToProcedures<V, Ctx>[K]> {
    if (typeof name !== 'string') throw RpcError.internal('Method name must be a string.');
    const method = this.router.get(name);
    if (!method) throw RpcError.badRequest(`Method ${String(name)} not found.`);
    if (method instanceof FnType) return method.res;
    if (method instanceof FnRxType) return method.res;
    return method as any;
  }

  /** -------------------------------------------------------- {@link Caller} */

  public async call<K extends keyof ObjectValueToProcedures<V, Ctx>>(name: K, request: ProcedureReq<ObjectValueToProcedures<V, Ctx>[K]>, ctx: Ctx) {
    const type = this.getResType(name) as Type;
    console.log('t', type + '');
    const data = await this.rpc.call(name as any, request, ctx);
    const value = new Value(type, data);
    return value as any;
  }

  public call$<K extends keyof ObjectValueToProcedures<V, Ctx>>(name: K, request$: Rx.Observable<ProcedureReq<ObjectValueToProcedures<V, Ctx>[K]>>, ctx: Ctx) {
    return Rx.of(this.getResType(name) as Type).pipe(
      Rx.switchMap((type) => this.rpc.call$(name as any, request$, ctx).pipe(
        Rx.map(data => new Value(type, data)))
      )
    ) as any;
  }

  public notify<K extends keyof ObjectValueToProcedures<V, Ctx>>(name: K, request: ProcedureReq<ObjectValueToProcedures<V, Ctx>[K]>, ctx: Ctx): Promise<void> {
    return this.rpc.call(name as any, request, ctx);
  }

  /** ----------------------------------------------------- {@link Printable} */

  public toString(tab = ''): string {
    return (
      `${this.constructor.name}` +
      printTree(tab, [(tab) => this.router.toString(tab), (tab) => this.router.system.toString(tab)])
    );
  }
}
