import {s} from 'json-joy/lib/json-crdt';
import {JsonPatchStore} from 'json-joy/lib/json-crdt/json-patch';
import {setup} from './setup';
import {until} from 'thingies/lib/until';
import {EditSessionFactory} from '../EditSessionFactory';
import {tick} from 'thingies';

describe('JSON Patch interface', () => {
  test('can edit two sessions in the same tab', async () => {
    const kit = await setup();
    const schema = s.obj({foo: s.con('bar')});
    const session1 = kit.sessions.make({id: kit.blockId, schema, session: 1});
    const session2 = await kit.sessions.load({id: kit.blockId, make: {schema, session: 2}});
    const jp1 = new JsonPatchStore(session1.model);
    const jp2 = new JsonPatchStore(session2.model);
    const assertView = async (view: any) => {
      await until(() => {
        try {
          expect(jp1.get()).toEqual(view);
          expect(jp2.get()).toEqual(view);
          return true;
        } catch {
          return false;
        }
      });
      expect(jp1.get()).toEqual(view);
    };
    expect(jp1.get('/foo')).toBe('bar');
    expect(jp1.get()).toEqual({foo: 'bar'});
    await assertView({foo: 'bar'});
    jp2.update({op: 'add', path: '/tags', value: ['tag1', 'tag2']});
    await assertView({foo: 'bar', tags: ['tag1', 'tag2']});
    jp1.update({op: 'add', path: '/a', value: {b: 'c'}});
    await assertView({foo: 'bar', tags: ['tag1', 'tag2'], a: {b: 'c'}});
    jp1.update([
      {op: 'str_ins', path: '/a/b', pos: 1, str: 'd'},
      {op: 'add', path: '/a/x', value: 'y'},
    ]);
    jp2.update([
      {op: 'remove', path: ['foo']},
      {op: 'add', path: '/a/y', value: 'x'},
    ]);
    await assertView({tags: ['tag1', 'tag2'], a: {b: 'cd', x: 'y', y: 'x'}});
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  });

  test.only('can edit two sessions in different tabs', async () => {
    const kit = await setup();
    const schema = s.obj({foo: s.con('bar')});
    const session1 = kit.sessions.make({id: kit.blockId, schema, session: 1});
    const local2 = await kit.createLocal();
    const sessions2 = new EditSessionFactory({
      sid: local2.sid,
      repo: local2.local,
    });
    const session2 = await sessions2.load({id: kit.blockId, make: {schema, session: 2}});
    const jp1 = new JsonPatchStore(session1.model);
    const jp2 = new JsonPatchStore(session2.model);
    const assertView = async (view: any) => {
      await until(() => {
        try {
          expect(jp1.get()).toEqual(view);
          expect(jp2.get()).toEqual(view);
          return true;
        } catch {
          return false;
        }
      });
      expect(jp1.get()).toEqual(view);
    };
    await assertView({foo: 'bar'});
    jp2.update({op: 'add', path: '/tags', value: ['tag1', 'tag2']});
    await tick(123);
    // await assertView({foo: 'bar', tags: ['tag1', 'tag2']});
    // jp1.update({op: 'add', path: '/a', value: {b: 'c'}});
    // await assertView({foo: 'bar', tags: ['tag1', 'tag2'], a: {b: 'c'}});
    // jp1.update([
    //   {op: 'str_ins', path: '/a/b', pos: 1, str: 'd'},
    //   {op: 'add', path: '/a/x', value: 'y'},
    // ]);
    // jp2.update([
    //   {op: 'remove', path: ['foo']},
    //   {op: 'add', path: '/a/y', value: 'x'},
    // ]);
    // await assertView({tags: ['tag1', 'tag2'], a: {b: 'cd', x: 'y', y: 'x'}});
    await session1.dispose();
    await session2.dispose();
    await local2.stop();
    await kit.stop();
  });
});
