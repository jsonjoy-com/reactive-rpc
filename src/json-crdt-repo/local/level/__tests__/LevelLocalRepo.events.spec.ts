import {Model, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {BehaviorSubject} from 'rxjs';
import {until} from 'thingies';
import type {LocalRepoRebaseEvent} from '../../types';

describe('events', () => {
  test('can emit to another tab', async () => {
    const kit = await setup({local: {connected$: new BehaviorSubject(false)}});
    const local2 = await kit.createLocal();
    const bus1 = kit.pubsub;
    const bus2 = local2.pubsub;
    const msgs: any[] = [];
    bus1.bus$.subscribe((msg) => {
      msgs.push(msg);
    });
    bus2.bus$.subscribe((msg) => {
      msgs.push(msg);
    });
    (bus1 as any).pub({foo: 'bar', bin: new Uint8Array([1, 2, 3])});
    await until(() => msgs.length === 2);
    expect(msgs).toEqual([
      {foo: 'bar', bin: new Uint8Array([1, 2, 3])},
      {foo: 'bar', bin: new Uint8Array([1, 2, 3])},
    ]);
    await bus1.end();
    await bus2.end();
  });

  test('emits "rebase" event (in same tab)', async () => {
    const kit = await setup({local: {connected$: new BehaviorSubject(false)}});
    const model = Model.create(s.obj({foo: s.con(1)}), kit.sid);
    const patch = model.api.flush();
    const res1 = await kit.local.sync({
      id: kit.blockId,
      patches: [patch],
    });
    const events: LocalRepoRebaseEvent[] = [];
    const sub = kit.local.change$(kit.blockId).subscribe((event) => {
      if ((event as LocalRepoRebaseEvent).rebase) events.push(event as LocalRepoRebaseEvent);
    });
    const model2 = model.clone();
    model.api.obj([]).set({foo: 2});
    const patch2 = model.api.flush();
    await kit.local.sync({
      id: kit.blockId,
      patches: [patch2],
      cursor: res1.cursor,
    });
    const get1 = await kit.local.get({id: kit.blockId});
    expect(get1.model.view()).toEqual({foo: 2});
    await until(() => events.length === 1);
    const event = events[0];
    expect(model2.view()).toEqual({foo: 1});
    for (const patch of event.rebase) {
      model2.applyPatch(patch);
    }
    expect(model2.view()).toEqual({foo: 2});
    sub.unsubscribe();
    await kit.stop();
  });

  test('emits "rebase" event (across tabs)', async () => {
    const kit = await setup({local: {connected$: new BehaviorSubject(false)}});
    const local2 = await kit.createLocal();
    const model = Model.create(s.obj({foo: s.con(1)}), kit.sid);
    const patch = model.api.flush();
    const res1 = await kit.local.sync({
      id: kit.blockId,
      patches: [patch],
    });
    const events: LocalRepoRebaseEvent[] = [];
    const sub = local2.local.change$(kit.blockId).subscribe((event) => {
      if ((event as LocalRepoRebaseEvent).rebase) events.push(event as LocalRepoRebaseEvent);
    });
    const model2 = model.clone();
    model.api.obj([]).set({foo: 2});
    const patch2 = model.api.flush();
    await kit.local.sync({
      id: kit.blockId,
      patches: [patch2],
      cursor: res1.cursor,
    });
    const get1 = await kit.local.get({id: kit.blockId});
    expect(get1.model.view()).toEqual({foo: 2});
    await until(() => events.length === 1);
    const event = events[0];
    expect(model2.view()).toEqual({foo: 1});
    for (const patch of event.rebase) {
      model2.applyPatch(patch);
    }
    expect(model2.view()).toEqual({foo: 2});
    sub.unsubscribe();
    await kit.stop();
  });
});
