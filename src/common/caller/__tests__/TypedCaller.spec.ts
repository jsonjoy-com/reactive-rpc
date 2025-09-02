import * as Rx from 'rxjs';
import {createTypedCaller} from './TypedCaller.fixtures';
import {RpcError} from 'rpc-error';

describe('.call()', () => {
  test('can execute simple call with "str" response', async () => {
    const caller = createTypedCaller();
    const res = await caller.call('ping', void 0, {});
    expect(res.data).toBe('pong');
  });

  test('can execute simple call with "obj" response', async () => {
    const caller = createTypedCaller();
    const res = await caller.call('getIp', void 0, {ip: '1.2.3.4'});
    expect(res.data.ip).toBe('1.2.3.4');
  });

  test('can execute "double"', async () => {
    const caller = createTypedCaller();
    const res = (await caller.call('double', {num: 5})) as any;
    expect(res.data.num).toBe(10);
  });

  test('can specify a context', async () => {
    const caller = createTypedCaller();
    const res = await caller.call('getIp', void 0, {ip: '1.2.3.4'});
    expect(res.data.ip).toBe('1.2.3.4');
  });

  test('wraps error into RpcError', async () => {
    const caller = createTypedCaller();
    try {
      await caller.call('error', {}, {});
      throw new Error('should not reach here');
    } catch (error) {
      expect(error).toEqual(new RpcError('this promise can throw', '', 0, '', undefined, undefined));
    }
  });
});

describe('.notify()', () => {
  test('can execute a notification to set a value', async () => {
    const caller = createTypedCaller();
    await caller.notify('notificationSetValue', {value: 123}, {});
    const val1 = await caller.call('getValue', undefined, {});
    expect((val1 as any).data.value).toBe(123);
    await caller.notify('notificationSetValue', {value: 456}, {});
    const val2 = await caller.call('getValue', undefined, {});
    expect((val2 as any).data.value).toBe(456);
  });

  test('can specify a context', async () => {
    const caller = createTypedCaller();
    await caller.call('notificationSetValueFromCtx', void 0, {ip: '1.2.3.4'});
    const len = await caller.call('getValue', undefined, {});
    expect(len.data.value).toBe('1.2.3.4'.length);
  });
});

describe('.call$()', () => {
  test('can execute "ping"', async () => {
    const caller = createTypedCaller();
    const res = await Rx.firstValueFrom(caller.call$('ping', Rx.of(undefined), {}));
    expect(res.data).toBe('pong');
  });

  test('can execute "double"', async () => {
    const caller = createTypedCaller();
    const res = (await Rx.firstValueFrom(caller.call$('double', Rx.of({num: 5}), {}))) as any;
    expect(res.data.num).toBe(10);
  });

  test('can specify a context', async () => {
    const caller = createTypedCaller();
    const res = await Rx.firstValueFrom(caller.call$('getIp', Rx.of(void 0), {ip: '1.1.1.1'}));
    expect(res.data.ip).toBe('1.1.1.1');
  });

  test('wraps error into RpcError', async () => {
    const caller = createTypedCaller();
    try {
      await Rx.firstValueFrom(caller.call$('error', Rx.of({}), {}));
      throw new Error('should not reach here');
    } catch (error) {
      expect(error).toEqual(new RpcError('this promise can throw', '', 0, '', undefined, undefined));
    }
  });
});
