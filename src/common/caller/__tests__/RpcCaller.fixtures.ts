import {timer, from, Observable, of} from 'rxjs';
import {map, switchMap, take} from 'rxjs/operators';
import {RpcError} from 'rpc-error';
import {Procedure} from '../../procedures';
import {RpcCaller} from '../RpcCaller';

export interface SampleCtx {
  ip?: string;
}

export const procedures = {
  ping: Procedure.new<void, 'pong', SampleCtx>('pong'),

  getIp: Procedure.new<void, {ip: string}, SampleCtx>((inp, ctx: SampleCtx) => {
    return {ip: ctx.ip ?? ''};
  }),

  delay: Procedure.unary(async ({timeout = 10}: {timeout?: number} = {}) => {
    await new Promise((r) => setTimeout(r, timeout));
    return {
      done: true,
      timeout,
    };
  }),

  notificationSetValue: Procedure.new(({value}: {value: number}) => {
    valueHolder.value = value;
  }),

  notificationSetValueFromCtx: Procedure.new(function (inp, ctx: SampleCtx) {
    valueHolder.value = ctx?.ip?.length ?? 0;
  }),

  getValue: Procedure.new(() => ({value: valueHolder.value})),

  delayStreaming: Procedure.rx<{timeout?: number}, {done: true; timeout: number}>((req$) =>
    req$.pipe(
      take(1),
      switchMap(({timeout = 10}: {timeout?: number} = {}) =>
        from(
          new Promise<number>((r) => {
            setTimeout(() => {
              r(timeout);
            }, timeout);
          }),
        ),
      ),
      map((timeout: number) => ({
        done: true,
        timeout,
      })),
    ),
  ),

  double: Procedure.unary(async ({num}: {num: number}) => {
    if (typeof num !== 'number') throw RpcError.validation('Payload .num field missing.');
    return {num: num * 2};
  }),

  error: Procedure.unary(async () => {
    throw new RpcError('this promise can throw', '', 0, '', undefined, undefined);
  }),

  'auth.users.get': Procedure.unary(async ({id}: {id: string}) => {
    return {
      id,
      name: 'Mario Dragi',
      tags: ['news', 'cola', 'bcaa'],
    };
  }),

  streamError: Procedure.rx(() =>
    from(
      (async () => {
        throw RpcError.internal(null, 'Stream always errors');
      })(),
    ),
  ),

  utilTimer: Procedure.rx(() => timer(10, 10)),

  'util.info': Procedure.rx(() =>
    from([
      {
        commit: 'AAAAAAAAAAAAAAAAAAA',
        sha1: 'BBBBBBBBBBBBBBBBBBB',
      },
    ]),
  ),

  'util.timer': Procedure.rx(() => timer(10, 10)),

  count: Procedure.rx<{count: number}, number>((request$) =>
    request$.pipe(
      switchMap(
        ({count}: {count: number}) =>
          new Observable<number>((observer) => {
            let cnt = 0;
            const timerId = setInterval(() => {
              observer.next(cnt++);
              if (cnt >= count) {
                observer.complete();
                clearInterval(timerId);
              }
            }, 10);
            return () => {
              clearInterval(timerId);
            };
          }),
      ),
    ),
  ),

  doubleStringWithValidation: Procedure.unary(async ({foo}: {foo: string}) => {
    if (typeof foo !== 'string') throw RpcError.validation('"foo" property missing.');
    return {bar: foo + foo};
  }),

  doubleStringWithValidation2: Procedure.rx<{foo: string}, {bar: string}>((req$) =>
    req$.pipe(
      map(({foo}: {foo: string}) => {
        if (typeof foo !== 'string') throw RpcError.validation('"foo" property missing.');
        return {bar: foo + foo};
      }),
    ),
  ),

  passthroughStream: Procedure.rx((req$) => req$),

  emitOnceSync: Procedure.rx((request$, ctx) => {
    return request$.pipe(
      take(1),
      switchMap(async (request) => {
        return JSON.stringify({request, ctx});
      }),
    );
  }),

  emitThreeSync: Procedure.rx((request$) => {
    return request$.pipe(
      take(1),
      switchMap(() => from([1, 2, 3])),
    );
  }),

  promiseDelay: Procedure.unary(async () => {
    await new Promise((r) => setTimeout(r, 5));
    return {};
  }),

  streamDelay: Procedure.rx(() => {
    return of({}).pipe(
      switchMap(async () => {
        await new Promise((r) => setTimeout(r, 5));
        return {};
      }),
    );
  }),
};

// Helper for value state
const valueHolder = {value: 0};

export const createRpcCaller = () =>
  new RpcCaller<SampleCtx | void, typeof procedures>({
    procedures,
  });
