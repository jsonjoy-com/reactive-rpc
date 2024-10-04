import {s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {BehaviorSubject} from 'rxjs';
import {until} from 'thingies';
import type {LocalRepoRebaseEvent} from '../../local/types';
import {Testbed} from '../../__tests__/testbed';

describe('events', () => {
  test('emits "rebase" event on change', async () => {
    const kit = await setup({local: {connected$: new BehaviorSubject(false)}});
    const schema = s.obj({foo: s.con(1)});
    const {session: session1} = kit.sessions.make({id: kit.blockId, schema});
    await session1.sync();
    const events: LocalRepoRebaseEvent[] = [];
    const sub = kit.local.change$(kit.blockId).subscribe((event) => {
      if ((event as LocalRepoRebaseEvent).rebase) events.push(event as LocalRepoRebaseEvent);
    });
    const model2 = session1.model.clone();
    session1.model.api.obj([]).set({foo: 2});
    await until(() => events.length === 1);
    const get1 = await kit.local.get({id: kit.blockId});
    expect(get1.model.view()).toEqual({foo: 2});
    const event = events[0];
    expect(model2.view()).toEqual({foo: 1});
    for (const patch of event.rebase) {
      model2.applyPatch(patch);
    }
    expect(model2.view()).toEqual({foo: 2});
    sub.unsubscribe();
    await kit.stop();
  });

  test('can synchronize sessions using local .applyPatch()', async () => {
    const repo = Testbed.createRepo();
    const schema = s.obj({str: s.str('abc')});
    const {session: session1} = repo.sessions.make({id: repo.blockId, schema});
    const {session: session2} = repo.sessions.make({id: repo.blockId, schema});
    const clone = session1.model.clone();
    session1.model.api.str(['str']).ins(3, 'd');
    expect(session1.model.view()).toEqual({str: 'abcd'});
    clone.api.str(['str']).ins(3, ' - 2');
    expect(clone.view()).toEqual({str: 'abc - 2'});
    await session1.sync();
    const patch = clone.api.flush();
    session1.model.applyLocalPatch(patch);
    expect(session1.model.view()).toEqual({str: 'abc - 2d'});
    await session1.sync();
    await until(() => session2.model.view().str === 'abc - 2d');
    expect(session2.model.view()).toEqual({str: 'abc - 2d'});
    expect(session1.model.view()).toEqual({str: 'abc - 2d'});
    await session1.dispose();
    await session2.dispose();
    await repo.stopTab();
  });
});
