import {s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {tick, until} from 'thingies';

describe('sync', () => {
  test('removes patches from log on sync', async () => {
    const kit = await setup();
    const schema = s.obj({id: s.con('asdf')});
    const session = kit.sessions.make({id: kit.blockId, schema});
    expect(session.model.view()).toEqual({id: 'asdf'});
    expect(session.log.patches.size()).toBe(1);
    await session.sync();
    expect(session.log.patches.size()).toBe(0);
    session.model.api.obj([]).set({s1: 's1'});
    session.model.api.flush();
    expect(session.log.patches.size()).toBe(1);
    session.model.api.obj([]).set({s2: 's2'});
    session.model.api.flush();
    expect(session.log.patches.size()).toBe(2);
    await session.sync();
    expect(session.log.patches.size()).toBe(0);
    await session.dispose();
    await kit.stop();
  });

  test('can edit two sessions in parallel', async () => {
    const kit = await setup();
    const schema = s.obj({id: s.con('asdf')});
    const session1 = kit.sessions.make({id: kit.blockId, schema});
    const session2 = kit.sessions.make({id: kit.blockId, schema});
    await session1.sync();
    await session2.sync();
    session1.model.api.obj([]).set({s1: 's1'});
    session2.model.api.obj([]).set({s2: 's2'});
    expect(session1.model.view()).toMatchObject({id: 'asdf', s1: 's1'});
    expect(session2.model.view()).toMatchObject({id: 'asdf', s2: 's2'});
    await session1.sync();
    await session2.sync();
    await until(() => session1.model.view().s2 === 's2');
    await until(() => session2.model.view().s1 === 's1');
    expect(session1.model.view()).toEqual({id: 'asdf', s1: 's1', s2: 's2'});
    expect(session2.model.view()).toEqual({id: 'asdf', s2: 's2', s1: 's1'});
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });
});
