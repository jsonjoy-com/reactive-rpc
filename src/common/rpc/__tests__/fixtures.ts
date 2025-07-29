import {timer, from, Observable} from 'rxjs';
import {map, switchMap, take} from 'rxjs/operators';
import {RpcError} from '../caller';
import {Procedure} from '../caller/procedures';
import {RpcCaller} from '../caller/RpcCaller';

export const procedures = {
  ping: Procedure.new(() => 'pong'),

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

  getValue: Procedure.new(() => ({value: valueHolder.value})),

  delayStreaming: Procedure.streaming<{timeout?: number}, {done: true; timeout: number}>((req$) =>
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
    )
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

  streamError: Procedure.streaming(() =>
    from(
      (async () => {
        throw RpcError.internal(null, 'Stream always errors');
      })(),
    )
  ),

  utilTimer: Procedure.streaming(() => timer(10, 10)),

  'util.info': Procedure.streaming(() =>
    from([
      {
        commit: 'AAAAAAAAAAAAAAAAAAA',
        sha1: 'BBBBBBBBBBBBBBBBBBB',
      },
    ])
  ),

  'util.timer': Procedure.streaming(() => timer(10, 10)),

  count: Procedure.streaming<{count: number}, number>((request$) =>
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
    )
  ),

  doubleStringWithValidation: Procedure.unary(async ({foo}: {foo: string}) => {
    if (typeof foo !== 'string') throw RpcError.validation('"foo" property missing.');
    return {bar: foo + foo};
  }),

  doubleStringWithValidation2: Procedure.streaming<{foo: string}, {bar: string}>((req$) =>
    req$.pipe(
      map(({foo}: {foo: string}) => {
        if (typeof foo !== 'string') throw RpcError.validation('"foo" property missing.');
        return {bar: foo + foo};
      })
    )
  ),

  passthroughStream: Procedure.streaming((req$) => req$),
};

// Helper for value state
const valueHolder = { value: 0 };

export const createRpcCaller = () => new RpcCaller<typeof procedures>({
  procedures,
});
