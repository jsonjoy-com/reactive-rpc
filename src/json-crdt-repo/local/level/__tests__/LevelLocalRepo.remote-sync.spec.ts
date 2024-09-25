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
});
