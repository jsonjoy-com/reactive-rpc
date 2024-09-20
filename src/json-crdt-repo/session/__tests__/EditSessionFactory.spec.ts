import {Model, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {of, tick, until} from 'thingies';
import {BlockId, LocalRepo} from '../../local/types';

const readLocal = async (local: LocalRepo, id: BlockId) => {
  const {model} = await local.get({id});
  return {model};
};

const untilExists = async (local: LocalRepo, id: BlockId) => {
  await until(async () => {
    try {
      await readLocal(local, id);
      return true;
    } catch {
      return false;
    }
  });
};

describe('.make()', () => {
  describe('no schema', () => {
    test('can synchronously create an editing session', async () => {
      const kit = await setup();
      const {session} = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await session.dispose();
      await kit.stop();
    });

    test('persists the block asynchronously, by default', async () => {
      const kit = await setup();
      kit.local.stop();
      const {session} = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await untilExists(kit.local, kit.blockId);
      const read = await readLocal(kit.local, kit.blockId);
      expect(read.model.view()).toBe(undefined);
      await session.dispose();
      await kit.stop();
    });

    test.todo('create from existing log');

    test('can save a new session', async () => {
      const kit = await setup();
      const {session} = kit.sessions.make({id: kit.blockId});
      expect(session.model.view()).toBe(undefined);
      await session.sync();
      await untilExists(kit.local, kit.blockId);
      const {model} = await readLocal(kit.local, kit.blockId);
      expect(model.view()).toBe(undefined);
      await session.dispose();
      await kit.stop();
    });

    test('can save a session with edits', async () => {
      const kit = await setup();
      const {session} = kit.sessions.make({id: kit.blockId});
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
        const get = await local2.local.get({id});
        expect(get.model.view()).toEqual({foo: 'bar'});

        // Synchronously make a session in current tab.
        const {session} = await kit.sessions.make({id});
        expect(session.model.view()).toBe(undefined);
        await until(() => session.model?.view()?.foo === 'bar');
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
        const {session} = await kit.sessions.make({id});
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
      await kit.remote.client.call('block.get', {id: id.join('/')});

      // Synchronously make a session.
      const {session} = await kit.sessions.make({id});
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
      const {session} = kit.sessions.make({id: kit.blockId, schema});
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
  test('throws if the block does not exist in the local repo', async () => {
    const kit = await setup();
    const [, error] = await of(kit.sessions.load({id: kit.blockId}));
    expect((error as any)!.message).toBe('NOT_FOUND');
    await kit.stop();
  });

  test('can "make" a new block, if it does not exist', async () => {
    const kit = await setup();
    const session = await kit.sessions.load({id: kit.blockId, make: {}});
    expect(session.model.view()).toBe(undefined);
    await session.dispose();
    await kit.stop();
  });

  test('can "make" a new block with schema, if it does not exist', async () => {
    const kit = await setup();
    const schema = s.obj({xyz: s.con(123)});
    const session = await kit.sessions.load({id: kit.blockId, make: {schema}});
    expect(session.model.view()).toEqual({xyz: 123});
    await session.dispose();
    await kit.stop();
  });

  test('can load block which exists locally', async () => {
    const kit = await setup();
    const {session} = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    session.model.api.root({foo: 'bar'});
    await session.sync();
    const session2 = await kit.sessions.load({id: kit.blockId});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test('can update block, which exists locally', async () => {
    const kit = await setup();
    const {session} = kit.sessions.make({id: kit.blockId});
    expect(session.model.view()).toBe(undefined);
    session.model.api.root({foo: 'bar'});
    await session.sync();
    const session2 = await kit.sessions.load({id: kit.blockId});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    session2.model.api.obj([]).set({x: 1});
    expect(session2.model.view()).toEqual({foo: 'bar', x: 1});
    const session3 = await kit.sessions.load({id: kit.blockId});
    await session2.sync();
    await until(() => session3.model.view()?.x === 1);
    expect(session3.model.view()).toEqual({foo: 'bar', x: 1});
    await session.dispose();
    await session2.dispose();
    await session3.dispose();
    await kit.stop();
  });

  test('throws when loading block, which exists on remote, but missing in local repo', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const [, error] = await of(kit.sessions.load({id}));
    expect((error as any)!.message).toBe('NOT_FOUND');
    await kit.stop();
  });

  test('can load block which exists remotely', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const session = await kit.sessions.load({id, remote: {}});
    expect(session.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await kit.stop();
  });

  test('can specify timeout when loading from remote, and throw if it is exceeded', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const [, error] = await of(kit.sessions.load({id, remote: {timeout: 1}}));
    expect(error).toEqual(new Error('TIMEOUT'));
    await kit.stop();
  });

  test('can specify timeout when loading from remote, and not throw if it is not exceeded', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const session = await kit.sessions.load({id, remote: {timeout: 1111}});
    expect(session.model.view()).toEqual({foo: 'bar'});
    await session.dispose();
    await kit.stop();
  });

  test('can specify timeout when loading from remote, but does not throw if "make" is specified', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const schema = s.obj({xyz: s.con(123)});
    const session = await kit.sessions.load({id, remote: {timeout: 1}, make: {schema}});
    expect(session.model.view()).toEqual({xyz: 123});
    await session.dispose();
    await kit.stop();
  });

  test('can force throw if block exists on remote', async () => {
    const kit = await setup();
    // Create on remote.
    const model = Model.create(undefined, kit.sid);
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const id = kit.blockId;
    await kit.remote.client.call('block.new', {id: id.join('/'), batch: {patches: [{blob: patch.toBinary()}]}});
    const model2 = await kit.getModelFromRemote(kit.blockId.join('/'));
    expect(model2.view()).toEqual({foo: 'bar'});
    // Load session with the same ID.
    const schema = s.obj({xyz: s.con(123)});
    const [, error] = await of(kit.sessions.load({id, remote: {throwIf: 'exists'}, make: {schema}}));
    expect((error as any)!.message).toBe('EXISTS');
    await kit.stop();
  });

  test('can force throw if block does not exist on remote', async () => {
    const kit = await setup();
    const id = kit.blockId;
    // Load session with the same ID.
    const schema = s.obj({xyz: s.con(123)});
    const [, error] = await of(kit.sessions.load({id, remote: {throwIf: 'missing'}, make: {schema}}));
    expect((error as any)!.message).toBe('NOT_FOUND');
    await kit.stop();
  });
});
