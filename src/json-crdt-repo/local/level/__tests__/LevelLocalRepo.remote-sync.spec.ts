import {s} from 'json-joy/lib/json-crdt';
import {BehaviorSubject} from 'rxjs';
import {Testbed} from '../../../__tests__/testbed';
import {tick, until} from 'thingies';

describe('remote sync', () => {
  test('can synchronize after connection resumes', async () => {
    const connected$ = new BehaviorSubject<boolean>(true);
    const repo = Testbed.createRepo({connected$});
    const schema = s.obj({foo: s.str('bar')});
    const {session: session1} = repo.sessions.make({id: repo.blockId, schema});
    await until(async () => {
      try {
        await repo.getModelFromRemote(repo.blockId);
        return true;
      } catch {
        return false;
      }
    });
    const model1 = await repo.getModelFromRemote(repo.blockId);
    expect(model1.view()).toEqual({foo: 'bar'});
    connected$.next(false);
    session1.model.api.obj([]).set({
      foo: 'baz',
      x: 'y',
    });
    const {session: session2} = await repo.sessions.make({id: repo.blockId, schema});
    await until(() => session2.model.view()?.foo === 'baz');
    await tick(123);
    const model2 = await repo.getModelFromRemote(repo.blockId);
    expect(model2.view()).toEqual({foo: 'bar'});
    connected$.next(true);
    await until(async () => {
      const model = await repo.getModelFromRemote(repo.blockId);
      return model.view()?.foo === 'baz';
    });
    const model3 = await repo.getModelFromRemote(repo.blockId);
    expect(model3.view()).toEqual({foo: 'baz', x: 'y'});
    await session1.dispose();
    await session2.dispose();
    await repo.stopTab();
  }, 10_000);

  test('synchronizes both blocks after user opens a connected browser tab', async () => {
    const connected$ = new BehaviorSubject<boolean>(true);
    const repo = Testbed.createRepo({connected$});
    const schema = s.obj({foo: s.str('bar')});
    const id1 = repo.blockId;
    const {session: session1} = repo.sessions.make({id: id1, schema});
    await until(async () => {
      try {
        await repo.getModelFromRemote(id1);
        return true;
      } catch {
        return false;
      }
    });
    const model1 = await repo.getModelFromRemote(id1);
    expect(model1.view()).toEqual({foo: 'bar'});
    connected$.next(false);
    const id2 = [...repo.col, repo.tab.browser.global.genId()];
    const {session: session3} = repo.sessions.make({id: id2, schema: s.obj({a: s.str('b')})});
    session1.model.api.obj([]).set({
      foo: 'baz',
      x: 'y',
    });
    const {session: session2} = await repo.sessions.make({id: id1, schema});
    await until(() => session2.model.view()?.foo === 'baz');
    await tick(123);
    const model2 = await repo.getModelFromRemote(id1);
    expect(model2.view()).toEqual({foo: 'bar'});
    const repo2 = repo.tab.browser.createTab().createRepo(); // new tab
    await until(async () => {
      const model = await repo2.getModelFromRemote(id1);
      return model.view()?.foo === 'baz';
    });
    const model3 = await repo.getModelFromRemote(id1);
    expect(model3.view()).toEqual({foo: 'baz', x: 'y'});
    await until(async () => {
      try {
        await repo.getModelFromRemote(id2);
        return true;
      } catch {
        return false;
      }
    });
    const model4 = await repo2.getModelFromRemote(id2);
    expect(model4.view()).toEqual({a: 'b'});
    const session4 = await repo2.sessions.load({id: id2, remote: {}});
    expect(session4.model.view()).toEqual({a: 'b'});
    await session1.dispose();
    await session2.dispose();
    await session3.dispose();
    await session4.dispose();
    await repo.stopTab();
    await repo2.stopTab();
  }, 10_000);
});
