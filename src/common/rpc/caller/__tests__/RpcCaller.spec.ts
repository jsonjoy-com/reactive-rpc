import * as Rx from 'rxjs';
import {createRpcCaller} from '../../__tests__/fixtures';
import {RpcCaller} from '../RpcCaller';
import {Procedure} from '../procedures';
import {of} from 'thingies';
import {RpcError} from 'rpc-error';

const setup = () => {
  const caller = createRpcCaller();
  return {caller};
};

describe('.call()', () => {
  test('can execute "ping"', async () => {
    const {caller} = setup();
    const res = await caller.call('ping', undefined, {});
    expect(res).toBe('pong');
  });

  test('can execute "double"', async () => {
    const {caller} = setup();
    const res = (await caller.call('double', {num: 5}, {})) as any;
    expect(res.num).toBe(10);
  });

  test('wraps error into RpcError', async () => {
    const caller = new RpcCaller<any>({
      procedures: {
        test: Procedure.unary(async () => {
          // tslint:disable-next-line:no-string-throw
          throw 'lol';
        }),
      },
    });
    const [, error] = await of(caller.call('test', {}, {}));
    expect(error).toEqual(RpcError.internal('lol'));
  });
});

describe('.notify()', () => {
  test('can execute a notification to set a value', async () => {
    const {caller} = setup();
    await caller.notify('notificationSetValue', {value: 123}, {});
    const val1 = await caller.call('getValue', undefined, {});
    expect((val1 as any).value).toBe(123);
    await caller.notify('notificationSetValue', {value: 456}, {});
    const val2 = await caller.call('getValue', undefined, {});
    expect((val2 as any).value).toBe(456);
  });
});

describe('.call$()', () => {
  test('can execute "ping"', async () => {
    const {caller} = setup();
    const res = await Rx.firstValueFrom(caller.call$('ping', Rx.of(undefined), {}));
    expect(res).toBe('pong');
  });

  test('can execute "double"', async () => {
    const {caller} = setup();
    const res = (await Rx.firstValueFrom(caller.call$('double', Rx.of({num: 5}), {}))) as any;
    expect(res.num).toBe(10);
  });

  test('can execute "timer"', async () => {
    const {caller} = setup();
    const res = await Rx.firstValueFrom(caller.call$('util.timer', Rx.of(undefined), {}).pipe(Rx.skip(2)));
    expect(res).toBe(2);
  });

  test('wraps errors into internal RpcError values', async () => {
    const caller = new RpcCaller({
      procedures: {
        test: Procedure.streaming(() => {
          const subject = new Rx.Subject();
          subject.error('lol');
          return subject;
        }),
      },
    });
    const [, error1] = await of(caller.call('test', {}, {}));
    expect(error1).toEqual(RpcError.internal('lol'));
    const [, error2] = await of(Rx.firstValueFrom(caller.call$('test', Rx.of(undefined), {})));
    expect(error2).toEqual(RpcError.internal('lol'));
  });
});
