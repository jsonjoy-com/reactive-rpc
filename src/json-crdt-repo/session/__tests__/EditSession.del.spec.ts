import {s} from 'json-joy/lib/json-crdt';
import {until} from 'thingies/lib/until';
import {of} from 'thingies';
import {BehaviorSubject} from 'rxjs';
import {Testbed} from '../../__tests__/testbed';

describe('.del()', () => {
  test('can delete a local session', async () => {
    const repo = Testbed.createRepo({connected$: new BehaviorSubject(false)});
    const schema = s.obj({id: s.con('asdf')});
    const {session} = repo.sessions.make({id: repo.blockId, schema});
    await session.sync();
    expect(session.model.view()).toEqual({id: 'asdf'});
    const get1 = await repo.repo.get({id: repo.blockId});
    expect(get1.model.view()).toEqual({id: 'asdf'});
    await session.del();
    const [, error] = await of(repo.repo.get({id: repo.blockId}));
    expect((error as any).message).toBe('NOT_FOUND');
    expect(session.model.view()).toBe(undefined);
    await session.dispose();
    await repo.stopTab();
  });

  test('nulls another session in the same tab', async () => {
    const repo = Testbed.createRepo({connected$: new BehaviorSubject(false)});
    const schema = s.obj({id: s.con('asdf')});
    const {session} = repo.sessions.make({id: repo.blockId, schema});
    await session.sync();
    const session2 = await repo.sessions.load({id: repo.blockId});
    expect(session.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session.del();
    await until(() => session.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session.dispose();
    await session2.dispose();
    await repo.stopTab();
  });

  test('nulls another session in the same tab (reverse)', async () => {
    const repo = Testbed.createRepo({connected$: new BehaviorSubject(false)});
    const schema = s.obj({id: s.con('asdf')});
    const {session} = repo.sessions.make({id: repo.blockId, schema});
    await session.sync();
    const session2 = await repo.sessions.load({id: repo.blockId});
    expect(session.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session2.del();
    await until(() => session.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session.dispose();
    await session2.dispose();
    await repo.stopTab();
  });

  test('nulls another session in another tab', async () => {
    const testbed = Testbed.create();
    const browser = testbed.createBrowser();
    const tab1 = browser.createTab();
    const tab2 = browser.createTab();
    const repo1 = tab1.createRepo({connected$: new BehaviorSubject(false)});
    const repo2 = tab2.createRepo({connected$: new BehaviorSubject(false)});
    const schema = s.obj({id: s.con('asdf')});
    const {session} = repo1.sessions.make({id: repo1.blockId, schema});
    await session.sync();
    const session2 = await repo2.sessions.load({id: repo2.blockId});
    expect(session.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session.del();
    await until(() => session.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session.dispose();
    await session2.dispose();
    await repo1.stopTab();
    await repo2.stopTab();
  });

  test('nulls another session in another tab (reverse)', async () => {
    const testbed = Testbed.create();
    const browser = testbed.createBrowser();
    const tab1 = browser.createTab();
    const tab2 = browser.createTab();
    const repo1 = tab1.createRepo({connected$: new BehaviorSubject(false)});
    const repo2 = tab2.createRepo({connected$: new BehaviorSubject(false)});
    const schema = s.obj({id: s.con('asdf')});
    const {session} = repo1.sessions.make({id: repo1.blockId, schema});
    await session.sync();
    const session2 = await repo2.sessions.load({id: repo2.blockId});
    expect(session.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session2.del();
    await until(() => session.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session.dispose();
    await session2.dispose();
    await repo1.stopTab();
    await repo2.stopTab();
  });

  test('nulls another session over a remote server', async () => {
    const testbed = Testbed.create();
    const repo1 = testbed.createBrowser().createTab().createRepo();
    const repo2 = testbed.createBrowser().createTab().createRepo();
    const id = repo1.blockId;
    const schema = s.obj({id: s.con('asdf')});
    const {session: session1} = repo1.sessions.make({id, schema});
    await session1.sync();
    const session2 = await repo2.sessions.load({id, remote: {}});
    expect(session1.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session1.del();
    await until(() => session1.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session1.dispose();
    await session2.dispose();
    await repo1.stopTab();
    await repo2.stopTab();
  });

  test('nulls another session over a remote server (reverse)', async () => {
    const testbed = Testbed.create();
    const repo1 = testbed.createBrowser().createTab().createRepo();
    const repo2 = testbed.createBrowser().createTab().createRepo();
    const id = repo1.blockId;
    const schema = s.obj({id: s.con('asdf')});
    const {session: session1} = repo1.sessions.make({id, schema});
    await session1.sync();
    const session2 = await repo2.sessions.load({id, remote: {}});
    expect(session1.model.view()).toEqual({id: 'asdf'});
    expect(session2.model.view()).toEqual({id: 'asdf'});
    await session2.del();
    await until(() => session1.model.view() === undefined);
    await until(() => session2.model.view() === undefined);
    await session1.dispose();
    await session2.dispose();
    await repo1.stopTab();
    await repo2.stopTab();
  });
});
