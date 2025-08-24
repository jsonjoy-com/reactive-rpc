import {firstValueFrom, of, Subject} from 'rxjs';
import {RxClient} from '../RxClient';
import {
  NotificationMessage,
  RequestCompleteMessage,
  RequestDataMessage,
  RequestErrorMessage,
  RequestUnsubscribeMessage,
  ResponseCompleteMessage,
  ResponseDataMessage,
  ResponseErrorMessage,
  ResponseUnsubscribeMessage,
  RpcClientMessage,
  RpcServerMessage,
} from '../../messages';
import {LogicalChannel} from '../../channel/logical/types';
import {BufferedLogicalChannel} from '../../channel/logical/BufferedLogicalChannel';
import {unknown} from '@jsonjoy.com/json-type';
import {utf8} from '@jsonjoy.com/buffers/lib/strings';
import {until} from 'thingies';

const setup = () => {
  const send = jest.fn().mockImplementation(async () => {});
  const channel: LogicalChannel<RpcServerMessage[], RpcClientMessage[]> = {
    err$: new Subject<unknown>(),
    msg$: new Subject<RpcServerMessage[]>(),
    send: send,
  };
  const client = new RxClient({channel});
  return {send, channel, client};
};

const setupBuffered = () => {
  const send = jest.fn();
  const channel: LogicalChannel<RpcServerMessage[], RpcClientMessage[]> = {
    err$: new Subject<unknown>(),
    msg$: new Subject<RpcServerMessage[]>(),
    send,
  };
  const bufferedChannel = new BufferedLogicalChannel({channel, bufferTime: 1});
  const client = new RxClient({channel: bufferedChannel});
  return {send, channel, client};
};

test('can create client', async () => {
  const {client} = setup();
  await client.stop();
});

test('does not send any messages on initialization', async () => {
  const {send, client} = setup();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  await client.stop();
});

test('sends notification message on .notify() call', async () => {
  const {send, client} = setup();
  client.notify('foo', utf8`bar`);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const value = unknown(utf8`bar`);
  expect(send).toHaveBeenCalledWith([new NotificationMessage('foo', value)]);
  await client.stop();
});

test('sends notification with no payload', async () => {
  const {send, client} = setup();
  client.notify('foo', undefined);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const value = unknown(undefined);
  expect(send).toHaveBeenCalledWith([new NotificationMessage('foo', value)]);
  await client.stop();
});

test('returns Observable on new execution', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  expect(typeof result.subscribe).toBe('function');
  await client.stop();
});

test('observable does not emit before it receives messages from server', async () => {
  const {client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const sub = jest.fn();
  result.subscribe(sub);
  await new Promise((r) => setTimeout(r, 2));
  expect(sub).toHaveBeenCalledTimes(0);
  await client.stop();
});

test('sends Request Complete Message to the server', async () => {
  const {send, client} = setup();
  client.call$('test', Buffer.from("{foo: 'bar'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const value = unknown(Buffer.from("{foo: 'bar'}"));
  expect(send).toHaveBeenCalledWith([new RequestCompleteMessage(1, 'test', value)]);
  await client.stop();
});

test('sends Response Un-subscribe Message to the server on unsubscribe', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const sub = jest.fn();
  const subscription = result.subscribe(sub);
  await new Promise((r) => setTimeout(r, 2));
  subscription.unsubscribe();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledWith([new ResponseUnsubscribeMessage(1)]);
  await client.stop();
});

test('server can immediately complete the subscription', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 2));
  const completeMsg = new ResponseCompleteMessage(1, undefined);
  client.onMessages([completeMsg]);
  await new Promise((r) => setTimeout(r, 2));
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
  await client.stop();
});

test('server can immediately complete the subscription with payload', async () => {
  const {client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 20));
  const value = unknown(Buffer.from("{x: 'y'}"));
  const completeMsg = new ResponseCompleteMessage(1, value);
  client.onMessages([completeMsg]);
  expect(next).toHaveBeenCalledTimes(1);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(Buffer.from("{x: 'y'}"));
  await client.stop();
});

test('server can send multiple values before completing', async () => {
  const {client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 20));
  const value1 = unknown(Buffer.from("{x: 'y'}"));
  client.onMessages([new ResponseDataMessage(1, value1)]);
  await new Promise((r) => setTimeout(r, 20));
  const value2 = unknown(Buffer.from("{z: 'a'}"));
  client.onMessages([new ResponseDataMessage(1, value2)]);
  await new Promise((r) => setTimeout(r, 20));
  const value3 = unknown(Buffer.from("{b: 'c'}"));
  client.onMessages([new ResponseCompleteMessage(1, value3)]);
  await new Promise((r) => setTimeout(r, 20));
  expect(next).toHaveBeenCalledTimes(3);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledWith(Buffer.from("{x: 'y'}"));
  expect(next).toHaveBeenCalledWith(Buffer.from("{z: 'a'}"));
  expect(next).toHaveBeenCalledWith(Buffer.from("{b: 'c'}"));
  await client.stop();
});

test('values are not emitted after observable is unsubscribed', async () => {
  const {client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  const subscription = result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 20));
  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from([1])))]);
  await new Promise((r) => setTimeout(r, 20));
  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from([2])))]);
  await new Promise((r) => setTimeout(r, 20));
  subscription.unsubscribe();
  client.onMessages([new ResponseCompleteMessage(1, unknown(Buffer.from([3])))]);
  await new Promise((r) => setTimeout(r, 20));
  expect(next).toHaveBeenCalledTimes(2);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(next).toHaveBeenCalledWith(Buffer.from([1]));
  expect(next).toHaveBeenCalledWith(Buffer.from([2]));
  await client.stop();
});

test('can subscribe to multiple methods', async () => {
  const {send, client} = setup();

  const result1 = client.call$('foo', Buffer.from([1] as any));
  const next1 = jest.fn();
  const error1 = jest.fn();
  const complete1 = jest.fn();
  result1.subscribe({next: next1, error: error1, complete: complete1});

  await new Promise((r) => setTimeout(r, 2));

  const result2 = client.call$('bar', Buffer.from([2] as any));
  const next2 = jest.fn();
  const error2 = jest.fn();
  const complete2 = jest.fn();
  result2.subscribe({next: next2, error: error2, complete: complete2});

  await new Promise((r) => setTimeout(r, 2));

  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledWith([new RequestCompleteMessage(1, 'foo', unknown(Buffer.from([1])))]);
  expect(send).toHaveBeenCalledWith([new RequestCompleteMessage(2, 'bar', unknown(Buffer.from([2])))]);

  client.onMessages([new ResponseDataMessage(2, unknown(Buffer.from('gg')))]);
  await new Promise((r) => setTimeout(r, 20));

  expect(next1).toHaveBeenCalledTimes(0);
  expect(next2).toHaveBeenCalledWith(Buffer.from('gg'));

  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from('lala')))]);
  await new Promise((r) => setTimeout(r, 20));

  expect(next1).toHaveBeenCalledWith(Buffer.from('lala'));
  expect(next1).toHaveBeenCalledTimes(1);
  expect(next2).toHaveBeenCalledTimes(1);

  client.onMessages([new ResponseCompleteMessage(1, unknown(Buffer.from('1')))]);
  client.onMessages([new ResponseCompleteMessage(2, undefined as any)]);

  expect(next1).toHaveBeenCalledWith(Buffer.from('1'));
  expect(next1).toHaveBeenCalledTimes(2);
  expect(next2).toHaveBeenCalledTimes(1);

  expect(error1).toHaveBeenCalledTimes(0);
  expect(complete1).toHaveBeenCalledTimes(1);
  expect(error2).toHaveBeenCalledTimes(0);
  expect(complete2).toHaveBeenCalledTimes(1);

  await client.stop();
});

test('can respond with error', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 20));
  client.onMessages([new ResponseErrorMessage(1, unknown(Buffer.from([1])))]);
  await new Promise((r) => setTimeout(r, 20));
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(1);
  expect(complete).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledWith(Buffer.from([1]));
  await client.stop();
});

test('response can complete without sending any data', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 4));
  client.onMessages([new ResponseCompleteMessage(1, undefined as any)]);
  await new Promise((r) => setTimeout(r, 3));
  expect(next).toHaveBeenCalledTimes(0);
  expect(error).toHaveBeenCalledTimes(0);
  expect(complete).toHaveBeenCalledTimes(1);
  await client.stop();
});

test('does not send unsubscribe when complete has been received', async () => {
  const {send, client} = setup();
  const result = client.call$('test', Buffer.from("{foo: 'bar'}"));
  const next = jest.fn();
  const error = jest.fn();
  const complete = jest.fn();
  result.subscribe({next, error, complete});
  await new Promise((r) => setTimeout(r, 20));
  expect(send).toHaveBeenCalledTimes(1);
  expect(next).toHaveBeenCalledTimes(0);
  client.onMessages([new ResponseCompleteMessage(1, unknown(Buffer.from([1])))]);
  await new Promise((r) => setTimeout(r, 20));
  expect(next).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledTimes(1);
  await client.stop();
});

test('does not send unsubscribe when complete has been received - 2', async () => {
  const {send, client} = setup();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  const observable = client.call$('test', Buffer.from("{foo: 'bar'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const promise = firstValueFrom(observable);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const value = unknown(Buffer.from([25]));
  client.onMessages([new ResponseCompleteMessage(1, value)]);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const result = await promise;
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  expect(result).toEqual(Buffer.from([25]));
  await client.stop();
});

test('does not send unsubscribe when error has been received', async () => {
  const {send, client} = setup();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  const observable = client.call$('test', Buffer.from("{foo: 'bar'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const promise = firstValueFrom(observable);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const value = unknown(Buffer.from([25]));
  client.onMessages([new ResponseErrorMessage(1, value)]);
  expect(send).toHaveBeenCalledTimes(1);
  let error: any;
  try {
    await promise;
  } catch (err) {
    error = err;
  }
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  expect(error).toEqual(Buffer.from([25]));
  await client.stop();
});

test('after .stop() completes subscriptions', async () => {
  const {send, client} = setup();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  const observable = client.call$('test', Buffer.from('{}'));
  const data = jest.fn();
  observable.subscribe(data);
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  expect(data).toHaveBeenCalledTimes(0);
  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from([1])))]);
  expect(data).toHaveBeenCalledTimes(1);
  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from([2])))]);
  expect(data).toHaveBeenCalledTimes(2);
  client.stop();
  client.onMessages([new ResponseDataMessage(1, unknown(Buffer.from([3])))]);
  expect(data).toHaveBeenCalledTimes(2);
  await client.stop();
});

test('combines multiple messages in a batch', async () => {
  const {send, client} = setupBuffered();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  client.call$('test', Buffer.from('{}'));
  client.call$('test2', Buffer.from("{foo: 'bar'}"));
  client.notify('test3', Buffer.from("{gg: 'bet'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  const messages = send.mock.calls[0][0];
  expect(messages[0]).toBeInstanceOf(RequestCompleteMessage);
  expect((messages[0] as any).id).toBe(1);
  expect((messages[0] as any).method).toBe('test');
  expect(messages[1]).toBeInstanceOf(RequestCompleteMessage);
  expect((messages[1] as any).id).toBe(2);
  expect((messages[1] as any).method).toBe('test2');
  expect(messages[2]).toBeInstanceOf(NotificationMessage);
  expect((messages[2] as any).method).toBe('test3');
  await client.stop();
});

test('can receive and process a batch from server', async () => {
  const {send, client} = setupBuffered();
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(0);
  const observable1 = client.call$('test', Buffer.from('{}'));
  const observable2 = client.call$('test2', Buffer.from("{foo: 'bar'}"));
  const data1 = jest.fn();
  const data2 = jest.fn();
  const error1 = jest.fn();
  const error2 = jest.fn();
  const complete1 = jest.fn();
  const complete2 = jest.fn();
  observable1.subscribe({next: data1, error: error1, complete: complete1});
  observable2.subscribe({next: data2, error: error2, complete: complete2});
  client.notify('test3', Buffer.from("{gg: 'bet'}"));
  await new Promise((r) => setTimeout(r, 2));
  expect(send).toHaveBeenCalledTimes(1);
  expect(data1).toHaveBeenCalledTimes(0);
  expect(data2).toHaveBeenCalledTimes(0);
  const value1 = unknown(Buffer.from("{foo: 'bar'}"));
  const value2 = unknown(Buffer.from("{foo: 'baz'}"));
  client.onMessages([new ResponseCompleteMessage(1, value1), new ResponseCompleteMessage(2, value2)]);
  await new Promise((r) => setTimeout(r, 2));
  expect(data1).toHaveBeenCalledTimes(1);
  expect(data2).toHaveBeenCalledTimes(1);
  expect(Buffer.from(data1.mock.calls[0][0]).toString()).toBe("{foo: 'bar'}");
  expect(Buffer.from(data2.mock.calls[0][0]).toString()).toBe("{foo: 'baz'}");
  expect(error1).toHaveBeenCalledTimes(0);
  expect(error2).toHaveBeenCalledTimes(0);
  expect(complete1).toHaveBeenCalledTimes(1);
  expect(complete2).toHaveBeenCalledTimes(1);
  await client.stop();
});

test('subscribing twice to call$ does not execute request twice', async () => {
  const {send, client} = setup();
  const observable = client.call$('test', {} as any);
  observable.subscribe(() => {});
  observable.subscribe(() => {});
  await new Promise((r) => setTimeout(r, 1));
  expect(send).toHaveBeenCalledTimes(1);
  await client.stop();
});

describe('streaming request', () => {
  test('request payload can be streamed', async () => {
    const {send, client} = setup();
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    await new Promise((r) => setTimeout(r, 1));
    expect(send).toHaveBeenCalledTimes(0);
    const value1 = unknown('1');
    data$.next('1');
    await until(() => send.mock.calls.length === 1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([new RequestDataMessage(1, 'a.b', value1)]);
    data$.next('1.1');
    await until(() => send.mock.calls.length === 2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith([new RequestDataMessage(1, '', unknown('1.1'))]);
    data$.next('1.1.1');
    data$.complete();
    await until(() => send.mock.calls.length === 3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenCalledWith([new RequestDataMessage(1, '', unknown('1.1.1'))]);
    await client.stop();
  });

  test('request payload error is sent to server', async () => {
    const {send, client} = setup();
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    await new Promise((r) => setTimeout(r, 1));
    expect(send).toHaveBeenCalledTimes(0);
    data$.next('1');
    await until(() => send.mock.calls.length === 1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0][0]).toBeInstanceOf(RequestDataMessage);
    expect(send).toHaveBeenCalledWith([new RequestDataMessage(1, 'a.b', unknown('1'))]);
    data$.error('1.1');
    await until(() => send.mock.calls.length === 2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0][0]).toBeInstanceOf(RequestErrorMessage);
    expect(send).toHaveBeenCalledWith([new RequestErrorMessage(1, '', unknown('1.1'))]);
    data$.next('1.1.1');
    expect(send).toHaveBeenCalledTimes(2);
    await client.stop();
  });

  test('request payload complete is sent to server', async () => {
    const {send, client} = setup();
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    await new Promise((r) => setTimeout(r, 1));
    expect(send).toHaveBeenCalledTimes(0);
    data$.next('1');
    await until(() => send.mock.calls.length === 1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0][0]).toBeInstanceOf(RequestDataMessage);
    expect(send).toHaveBeenCalledWith([new RequestDataMessage(1, 'a.b', unknown('1'))]);
    data$.complete();
    await until(() => send.mock.calls.length === 2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0][0]).toBeInstanceOf(RequestCompleteMessage);
    expect(send).toHaveBeenCalledWith([new RequestCompleteMessage(1, '', unknown(undefined))]);
    data$.next('1.1.1');
    expect(send).toHaveBeenCalledTimes(2);
    await client.stop();
  });

  test('can send error as the first request stream message', async () => {
    const {send, client} = setup();
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    await new Promise((r) => setTimeout(r, 1));
    expect(send).toHaveBeenCalledTimes(0);
    data$.error({foo: 'bar'});
    await until(() => send.mock.calls.length === 1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0][0]).toBeInstanceOf(RequestErrorMessage);
    expect(send).toHaveBeenCalledWith([new RequestErrorMessage(1, 'a.b', unknown({foo: 'bar'}))]);
    data$.complete();
    data$.next('1.1.1');
    await new Promise((r) => setTimeout(r, 4));
    expect(send).toHaveBeenCalledTimes(1);
    await client.stop();
  });

  test('can send complete as the first request stream message', async () => {
    const {send, client} = setup();
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    await new Promise((r) => setTimeout(r, 1));
    expect(send).toHaveBeenCalledTimes(0);
    data$.complete();
    await new Promise((r) => setTimeout(r, 4));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0][0]).toBeInstanceOf(RequestCompleteMessage);
    expect(send).toHaveBeenCalledWith([new RequestCompleteMessage(1, 'a.b', unknown(undefined))]);
    data$.complete();
    data$.error(123);
    data$.next('1.1.1');
    await new Promise((r) => setTimeout(r, 4));
    expect(send).toHaveBeenCalledTimes(1);
    await client.stop();
  });
});

describe('memory leaks', () => {
  test('removes calls when request and response complete', async () => {
    const {send, client} = setup();
    expect(client.getInflightCallCount()).toBe(0);
    const data$ = new Subject();
    await new Promise((r) => setTimeout(r, 2));
    expect(send).toHaveBeenCalledTimes(0);
    const next = jest.fn();
    const error = jest.fn();
    const complete = jest.fn();
    client.call$('a.b' as any, data$ as any).subscribe({next, error, complete});
    expect(client.getInflightCallCount()).toBe(1);
    data$.complete();
    expect(next).toHaveBeenCalledTimes(0);
    expect(complete).toHaveBeenCalledTimes(0);
    expect(client.getInflightCallCount()).toBe(1);
    client.onMessages([new ResponseCompleteMessage(1, unknown('gaga'))]);
    await new Promise((r) => setTimeout(r, 4));
    expect(next).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(client.getInflightCallCount()).toBe(0);
    await client.stop();
  });
});
