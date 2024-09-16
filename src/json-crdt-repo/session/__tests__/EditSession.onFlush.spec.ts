import {s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {until} from 'thingies/lib/until';
import {tick} from 'thingies';

describe('onFlush', () => {
  test('removes patches from log on sync', async () => {
    const kit = await setup();
    const schema = s.obj({id: s.con('asdf')});
    const session = kit.sessions.make({id: kit.blockId, schema, session: 1});
    const session2 = kit.sessions.make({id: kit.blockId, schema, session: 2});
    session.model.api.obj([]).set({a: 'a'});
    session.model.api.obj([]).set({b: 'b'});
    await tick(5);
    session.model.api.obj([]).set({a: '2'});
    session.model.api.obj([]).set({b: '2', c: '2'});
    await tick(5);
    session.model.api.obj([]).set({a: '3', b: '3', c: '3'});
    await until(() => {
      try {
        expect(session2.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
        return true;
      } catch {
        return false;
      }
    });
    expect(session.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
    expect(session2.model.view()).toEqual({ id: 'asdf', a: '3', b: '3', c: '3' });
    await session.dispose();
    await session2.dispose();
    await kit.stop();
  });
});
