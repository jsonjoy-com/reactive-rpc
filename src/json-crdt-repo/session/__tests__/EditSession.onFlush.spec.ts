import {s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {until} from 'thingies/lib/until';
import {tick} from 'thingies';

describe('onFlush', () => {
  test('removes patches from log on sync', async () => {
    const kit = await setup();
    const schema = s.obj({id: s.con('asdf')});
    const session1 = kit.sessions.make({id: kit.blockId, schema, session: 1});
    const session2 = kit.sessions.make({id: kit.blockId, schema, session: 2});
    session1.model.api.obj([]).set({a: 'a'});
    session1.model.api.obj([]).set({b: 'b'});
    await tick(5);
    session1.model.api.obj([]).set({a: '2'});
    session1.model.api.obj([]).set({b: '2', c: '2'});
    await tick(5);
    session1.model.api.obj([]).set({a: '3', b: '3', c: '3'});
    await until(() => {
      try {
        expect(session2.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
        return true;
      } catch {
        return false;
      }
    });
    expect(session1.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
    expect(session2.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test('synchronizes three editing sessions', async () => {
    const kit = await setup();
    const schema = undefined;
    const session1 = kit.sessions.make({id: kit.blockId, session: 1, schema});
    const session2 = kit.sessions.make({id: kit.blockId, session: 2, schema});
    const session3 = kit.sessions.make({id: kit.blockId, session: 3, schema});
    const assertView = async (view: any) => {
      await until(() => {
        try {
          expect(session1.model.view()).toEqual(view);
          expect(session2.model.view()).toEqual(view);
          expect(session3.model.view()).toEqual(view);
          return true;
        } catch {
          return false;
        }
      });
      expect(session1.model.view()).toEqual(view);
    };
    await assertView(undefined);
    session1.model.api.root({});
    await assertView({});
    session2.model.api.obj([]).set({b: 'b'});
    await tick(3);
    session2.model.api.obj([]).set({c: 'c'});
    session2.model.api.obj([]).set({d: 'd'});
    await assertView({b: 'b', c: 'c', d: 'd'});
    session1.model.api.obj([]).set({a: 'a'});
    await assertView({a: 'a', b: 'b', c: 'c', d: 'd'});
    session3.model.api.obj([]).set({e: 'e'});
    session2.model.api.obj([]).set({b: 'bb'});
    session2.model.api.obj([]).set({c: 'cc'});
    session1.model.api.obj([]).set({x: 'x'});
    await assertView({a: 'a', b: 'bb', c: 'cc', d: 'd', e: 'e', x: 'x'});
    await session1.dispose();
    await session2.dispose();
    await session3.dispose();
    await kit.stop();
  });
});
