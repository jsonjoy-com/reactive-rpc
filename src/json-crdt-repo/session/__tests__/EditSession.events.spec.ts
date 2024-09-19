import {s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {BehaviorSubject} from 'rxjs';
import {until} from 'thingies';
import {LocalRepoRebaseEvent} from '../../local/types';

describe('events', () => {
  test('emits "rebase" event on change', async () => {
    const kit = await setup({local: {connected$: new BehaviorSubject(false)}});
    const schema = s.obj({foo: s.con(1)});
    const session1 = kit.sessions.make({id: kit.blockId, schema});
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
    await kit.stop();
  });
});
