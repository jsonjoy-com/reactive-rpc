import * as Rx from 'rxjs';
import {catchError, skip} from 'rxjs/operators';
import {ApiRpcCaller} from '../ApiRpcCaller';
import {runApiTests} from '../../__tests__/runApiTests';
import {sampleApi} from '../../__tests__/sample-api';
import {of} from '../../../util/of';
import {StreamingRpcMethod} from '../../methods/StreamingRpcMethod';
import {TypedRpcError} from '../error/typed';

const setup = () => {
  const caller = new ApiRpcCaller<any, object>({
    api: sampleApi,
  });
  return {caller};
};

describe('static calls', () => {
  test('can execute "ping"', async () => {
    const {caller} = setup();
    const res = await caller.call('ping', undefined, {});
    expect(res.data).toBe('pong');
  });

  test('can execute "double"', async () => {
    const {caller} = setup();
    const res = (await caller.call('double', {num: 5}, {})) as any;
    expect(res.data.num).toBe(10);
  });

  test('wraps error into RpcError', async () => {
    const caller = new ApiRpcCaller<any>({
      api: {
        test: {
          isStreaming: false,
          call: async () => {
            // tslint:disable-next-line:no-string-throw
            throw 'lol';
          },
        },
      },
    });
    const [, error] = await of(caller.call('test', {}, {}));
    expect(error).toEqual(TypedRpcError.internalErrorValue(null));
  });
});

describe('notifications', () => {
  test('can execute a notification to set a value', async () => {
    const {caller} = setup();
    await caller.notification('notificationSetValue', {value: 123}, {});
    const val1 = await caller.call('getValue', undefined, {});
    expect((val1.data as any).value).toBe(123);
    await caller.notification('notificationSetValue', {value: 456}, {});
    const val2 = await caller.call('getValue', undefined, {});
    expect((val2.data as any).value).toBe(456);
  });
});

describe('streaming calls', () => {
  test('can execute "ping"', async () => {
    const {caller} = setup();
    const res = await Rx.firstValueFrom(caller.call$('ping', Rx.of(undefined), {}));
    expect(res.data).toBe('pong');
  });

  test('can execute "double"', async () => {
    const {caller} = setup();
    const res = (await Rx.firstValueFrom(caller.call$('double', Rx.of({num: 5}), {}))) as any;
    expect(res.data.num).toBe(10);
  });

  test('can execute "timer"', async () => {
    const {caller} = setup();
    const res = await Rx.firstValueFrom(caller.call$('util.timer', Rx.of(undefined), {}).pipe(skip(2)));
    expect(res.data).toBe(2);
  });

  test('wraps errors into internal RpcError values', async () => {
    const caller = new ApiRpcCaller<any>({
      api: {
        test: new StreamingRpcMethod({
          call$: () => {
            const subject = new Rx.Subject();
            subject.error('lol');
            return subject;
          },
        }),
      },
    });

    const [, error1] = await of(caller.call('test', {}, {}));
    expect(error1).toEqual(TypedRpcError.internalErrorValue(null));

    const [, error2] = await of(Rx.firstValueFrom(caller.call$('test', Rx.of(undefined), {})));
    expect(error2).toEqual(TypedRpcError.internalErrorValue(null));
  });
});

describe('smoke tests', () => {
  runApiTests(() => {
    const {caller} = setup();
    const call$ = (name: any, request: any) =>
      caller.call$(name, Rx.isObservable(request) ? request : Rx.of(request), {}).pipe(
        Rx.map((value) => value.data),
        catchError((error) => {
          throw error.data;
        }),
      );
    const client = {
      call$,
      call: (name: any, request: any) => Rx.firstValueFrom(call$(name, request)),
      stop: async () => {},
    };
    return {
      ...client,
      client,
    };
  });
});
