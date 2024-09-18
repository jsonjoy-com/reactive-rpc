import {s} from 'json-joy/lib/json-crdt';
import {setup as setup0} from './setup';
import {until} from 'thingies/lib/until';
import {tick} from 'thingies';

const setup = async () => {
  const kit = await setup0();
};

describe('sync through remote server', () => {
  test('can load block which exists remotely (no schema)', async () => {
    const kit = await setup0();
    const id = kit.blockId;
    const schema = undefined;
    const session1 = kit.sessions.make({id, schema});
    await until(async () => {
      try {
        const model = await kit.getModelFromRemote(id.join('/'));
        expect(model.view()).toEqual(undefined);
        return true;
      } catch {
        return false;
      }
    });
    const session2 = await kit.sessions.load({id, remote: {}});
    expect(session2.model.view()).toBe(undefined);
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test('can load block which exists remotely (with schema)', async () => {
    const kit = await setup0();
    const id = kit.blockId;
    const schema = s.obj({foo: s.str('bar')});
    const session1 = kit.sessions.make({id, schema});
    await until(async () => {
      try {
        const model = await kit.getModelFromRemote(id.join('/'));
        expect(model.view()).toEqual({foo: 'bar'});
        return true;
      } catch {
        return false;
      }
    });
    const session2 = await kit.sessions.load({id, remote: {}});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test('receives a changes done remotely', async () => {
    const kit = await setup0();
    const id = kit.blockId;
    const schema = undefined;
    const session1 = kit.sessions.make({id, schema});
    await until(async () => {
      try {
        const model = await kit.getModelFromRemote(id.join('/'));
        expect(model.view()).toEqual(undefined);
        return true;
      } catch {
        return false;
      }
    });
    const session2 = await kit.sessions.load({id, remote: {}});
    expect(session2.model.view()).toBe(undefined);
    session1.model.api.root({foo: 'bar'});
    await until(() => session2.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test('receives a changes done remotely (reverse)', async () => {
    const kit = await setup0();
    const id = kit.blockId;
    const schema = undefined;
    const session1 = kit.sessions.make({id, schema});
    await until(async () => {
      try {
        const model = await kit.getModelFromRemote(id.join('/'));
        expect(model.view()).toEqual(undefined);
        return true;
      } catch {
        return false;
      }
    });
    const session2 = await kit.sessions.load({id, remote: {}});
    expect(session2.model.view()).toBe(undefined);
    session2.model.api.root({foo: 'bar'});
    await until(() => session1.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });
});
