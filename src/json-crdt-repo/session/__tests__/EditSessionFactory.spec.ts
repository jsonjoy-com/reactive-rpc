import {Model, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {tick, until} from 'thingies';
import {BlockId, LocalRepo} from '../../local/types';

const readLocal = async (local: LocalRepo, id: BlockId) => {
  const {model} = await local.get({id});
  return {model};
};

describe('.make()', () => {
  describe('no schema', () => {
    test('can synchronously create an editing session', async () => {
      const kit = await setup();
      kit.local.stop();
      const session = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await session.dispose();
      await kit.stop();
    });

    test.only('can save a new session', async () => {
      const kit = await setup();
      const session = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await session.sync();
      // const {model} = await readLocal(kit.local, kit.blockId);
      // expect(model.view()).toBe(undefined);
      // await session.dispose();
      // await kit.stop();
    });

    test('can save a session with edits', async () => {
      const kit = await setup();
      const session = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await session.sync();
      session.model.api.root({foo: 'bar'});
      await session.sync();
      const {model} = await readLocal(kit.local, kit.blockId);
      expect(model.view()).toEqual({foo: 'bar'});
      await session.dispose();
      await kit.stop();
    });

    describe('local exists concurrently', () => {
      test('can create, and sync up with local', async () => {
        const kit = await setup();

        // Crate in another tab.
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patch = model.api.flush();
        const local2 = await kit.createLocal();
        const id = kit.blockId;
        await local2.local.sync({id, patches: [patch]});

        // Synchronously make a session in current tab.
        const session = await kit.sessions.make({id});
        expect(session.model.view()).toBe(undefined);
        await until(() => session.model.view()?.foo === 'bar');
        expect(session.model.view()).toEqual({foo: 'bar'});

        await local2.stop();
        await session.dispose();
        await kit.stop();
      });

      test('overwrites local changes', async () => {
        const kit = await setup();

        // Crate in another tab.
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patch = model.api.flush();
        const local2 = await kit.createLocal();
        const id = kit.blockId;
        await local2.local.sync({id, patches: [patch]});

        // Synchronously make a session in current tab.
        const session = await kit.sessions.make({id});
        expect(session.model.view()).toBe(undefined);
        session.model.api.root({a: 'b'});
        expect(session.model.view()).toEqual({a: 'b'});
        await session.sync();
        await tick(150);
        expect(session.model.view()).toEqual({a: 'b'});

        const get = await local2.local.get({id});
        expect(get.model.view()).toEqual({a: 'b'});

        await local2.stop();
        await session.dispose();
        await kit.stop();
      });
    });

    test('can create with ID already existing in remote', async () => {
      const kit = await setup();

      // Create on remote.
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patch = model.api.flush();
      const id = kit.blockId;
      await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});

      // Synchronously make a session.
      const session = await kit.sessions.make({id});
      expect(session.model.view()).toBe(undefined);
      await until(() => session.model.view()?.foo === 'bar');
      expect(session.model.view()).toEqual({foo: 'bar'});
      await session.dispose();
      await kit.stop();
    });
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
  test.skip('can create a new block', async () => {
  });

  test.skip('can load block which exists locally', async () => {
  });

  test.skip('can load block which exists remotely', async () => {
  });

  test.skip('can load block which exists remotely with timeout', async () => {
  });

  test('can load block which exists locally', async () => {
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
