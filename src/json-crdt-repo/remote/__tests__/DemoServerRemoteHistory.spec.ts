import {Model} from 'json-joy/lib/json-crdt';
import {buildE2eClient} from '../../../common/testing/buildE2eClient';
import {createCaller} from '../../../__demos__/json-crdt-server/routes';
import {DemoServerRemoteHistory} from '../DemoServerRemoteHistory';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {Value} from 'json-joy/lib/json-type-value/Value';

const setup = () => {
  const {caller, router} = createCaller();
  const {client} = buildE2eClient(caller);
  const remote = new DemoServerRemoteHistory(client);

  return {
    router,
    caller,
    client,
    remote,
  };
};

let cnt = 0;
const genId = () => Math.random().toString(36).slice(2) + '-' + Date.now().toString(36) + '-' + cnt++;

describe('.create()', () => {
  test('can create a block with a simple patch', async () => {
    const {remote, caller} = await setup();
    const model = Model.withLogicalClock();
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const blob = patch.toBinary();
    const id = genId();
    await remote.create(id, [{blob}]);
    const {data} = await caller.call('block.get', {id}, {});
    const model2 = Model.fromBinary(data.block.snapshot.blob);
    expect(model2.view()).toEqual({foo: 'bar'});
  });

  test('can create with empty model', async () => {
    const {remote, caller} = await setup();
    const id = genId();
    await remote.create(id, []);
    const {data} = await caller.call('block.get', {id}, {});
    const model2 = Model.fromBinary(data.block.snapshot.blob);
    expect(model2.view()).toBe(undefined);
  });

  test('empty model uses global session ID', async () => {
    const {remote, caller} = await setup();
    const id = genId();
    await remote.create(id, []);
    const {data} = await caller.call('block.get', {id}, {});
    const model2 = Model.fromBinary(data.block.snapshot.blob);
    expect(model2.clock.sid).toBe(SESSION.GLOBAL);
  });
});

describe('.read()', () => {
  test('can read a block with a simple patch', async () => {
    const {remote} = await setup();
    const model = Model.withLogicalClock();
    model.api.root({score: 42});
    const patch = model.api.flush();
    const blob = patch.toBinary();
    const id = genId();
    await remote.create(id, [{blob}]);
    const read = await remote.read(id);
    expect(read).toMatchObject({
      block: {
        id,
        snapshot: {
          blob: expect.any(Uint8Array),
          cur: 0,
          ts: expect.any(Number),
        },
        tip: [],
      },
    });
    const model2 = Model.fromBinary(read.block.snapshot.blob);
    expect(model2.view()).toEqual({score: 42});
  });

  test('throws NOT_FOUND error on missing block', async () => {
    const {remote} = await setup();
    const id = genId();
    try {
      const read = await remote.read(id);
      throw new Error('not this error');
    } catch (error) {
      expect(error).toMatchObject({
        message: 'NOT_FOUND',
      });
    }
  });
});

describe('.delete()', () => {
  test('can delete an existing block', async () => {
    const {remote, caller} = await setup();
    const id = genId();
    await remote.create(id, []);
    const get1 = await caller.call('block.get', {id}, {});
    await remote.delete(id);
    try {
      const get2 = await caller.call('block.get', {id}, {});
      throw new Error('not this error');
    } catch (err) {
      expect((err as Value<any>).data.message).toBe('NOT_FOUND');
    }
  });
});
