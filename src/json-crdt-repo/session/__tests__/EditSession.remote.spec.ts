import {NodeBuilder, s} from 'json-joy/lib/json-crdt';
import {setup as setup0} from './setup';
import {until} from 'thingies/lib/until';

const setupTwoSessions = async (schema?: undefined | NodeBuilder) => {
  const kit = await setup0();
  const id = kit.blockId;
  const session1 = kit.sessions.make({id, schema});
  await until(async () => {
    try {
      await kit.getModelFromRemote(id.join('/'));
      return true;
    } catch {
      return false;
    }
  });
  const session2 = await kit.sessions.load({id, remote: {}});
  const stop = async () => {
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  };
  return [session1, session2, stop] as const;
};

describe('sync through remote server', () => {
  test('can load block which exists remotely (no schema)', async () => {
    const [session1, session2, stop] = await setupTwoSessions();
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    await stop();
  });

  test('can load block which exists remotely (with schema)', async () => {
    const schema = s.obj({foo: s.str('bar')});
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });

  test('receives a changes done remotely', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    session1.model.api.root({foo: 'bar'});
    await until(() => session2.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });

  test('receives a changes done remotely (reverse)', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    session2.model.api.root({foo: 'bar'});
    await until(() => session1.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });
});
