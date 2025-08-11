import {createTypedCaller} from './TypedCaller.fixtures';

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
