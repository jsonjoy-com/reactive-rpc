import {Model, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {tick, until} from 'thingies';

describe('.make()', () => {
  test('can synchronously create an editing session', async () => {
    const kit = await setup();
    kit.local.stop();
    const session = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    await session.dispose();
    await kit.stop();
  });

  test('can save a new session', async () => {
    const kit = await setup();
    const session = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    await session.sync();
    await session.dispose();
    await kit.stop();
  });

  test('can save a session with edits', async () => {
    const kit = await setup();
    const session = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    await session.sync();
    session.model.api.root({foo: 'bar'});
    await session.sync();
    await session.dispose();
    await kit.stop();
  });

  test('can create with ID already existing in local', async () => {
    const kit = await setup();
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const local2 = await kit.createLocal();
    const id = kit.blockId;
    await local2.local.sync({id, patches: [patch]});
    const session = await kit.sessions.make({id});
    await until(() => session.model.view()?.foo === 'bar');
    expect(session.model.view()).toEqual({foo: 'bar'});
    await local2.stop();
    await session.dispose();
    await kit.stop();
  });

  test('can create with ID already existing in remote', async () => {
    const kit = await setup();
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const session = await kit.sessions.make({id});
    await until(() => session.model.view()?.foo === 'bar');
    expect(session.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await kit.stop();
  });

  describe('with schema', () => {
    test('can save/sync a session with schema', async () => {
      const kit = await setup();
      const schema = s.obj({xyz: s.con(123)});
      const session = kit.sessions.make({id: kit.blockId, schema});
      expect(session.model.view()).toEqual({xyz: 123});
      await session.sync();
      const {model} = await kit.local.sync({id: kit.blockId});
      expect(model!.view()).toEqual({xyz: 123});
      await session.dispose();
      await kit.stop();
    });
  });
});

describe('.load()', () => {
  test('can load an existing block (created locally)', async () => {
    const kit = await setup();
    const session = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    session.model.api.root({foo: 'bar'});
    await session.sync();
    const session2 = await kit.sessions.load({id: kit.blockId});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await kit.stop();
  });

  test('can load an existing block (created remotely)', async () => {
    const kit = await setup();
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    await kit.remote.remote.create(kit.blockId.join('/'), {patches: [{blob: patch.toBinary()}]});
    const session = await kit.sessions.load({id: kit.blockId});
    expect(session.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await kit.stop();
  });
});
