import {NodeBuilder, s} from 'json-joy/lib/json-crdt';
import {setup as setup0} from './setup';
import {until} from 'thingies/lib/until';
import {EditSession} from '../EditSession';
import {EditSessionFactory} from '../EditSessionFactory';
import {BehaviorSubject} from 'rxjs';

type TwoSessionsSetup = (schema?: undefined | NodeBuilder) => Promise<[EditSession, EditSession, () => Promise<void>]>;

// TODO: check if these are actually remote sessions
const setupTwoRemoteSessions: TwoSessionsSetup = async (schema?: undefined | NodeBuilder) => {
  const kit = await setup0();
  const id = kit.blockId;
  const {session: session1} = kit.sessions.make({id, schema, session: 1});
  await until(async () => {
    try {
      await kit.getModelFromRemote(id.join('/'));
      return true;
    } catch {
      return false;
    }
  });
  const session2 = await kit.sessions.load({id, session: 2, remote: {}});
  const stop = async () => {
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  };
  return [session1, session2, stop];
};

const setupTwoLocalSessions: TwoSessionsSetup = async (schema?: undefined | NodeBuilder) => {
  const kit = await setup0({local: {connected$: new BehaviorSubject(false)}});
  const id = kit.blockId;
  const {session: session1} = kit.sessions.make({id, schema, session: 1});
  await until(async () => {
    try {
      await kit.local.get({id});
      return true;
    } catch {
      return false;
    }
  });
  const local2 = await kit.createLocal();
  const sessions2 = new EditSessionFactory({
    sid: local2.sid,
    repo: local2.local,
  });
  const session2 = await sessions2.load({id, session: 2});
  const stop = async () => {
    await session1.dispose();
    await session2.dispose();
    await local2.stop();
    await kit.stop();
  };
  return [session1, session2, stop];
};

const setupTwoSameTabSessions: TwoSessionsSetup = async (schema?: undefined | NodeBuilder) => {
  const kit = await setup0({local: {connected$: new BehaviorSubject(false)}});
  const id = kit.blockId;
  const {session: session1} = kit.sessions.make({id, schema, session: 1});
  await until(async () => {
    try {
      await kit.local.get({id});
      return true;
    } catch {
      return false;
    }
  });
  const session2 = await kit.sessions.load({id, session: 2});
  const stop = async () => {
    await session1.dispose();
    await session2.dispose();
    await kit.stop();
  };
  return [session1, session2, stop];
};

const runTwoSessionsTests = (setupTwoSessions: TwoSessionsSetup) => {
  test('can load block created by another session (no schema)', async () => {
    const [session1, session2, stop] = await setupTwoSessions();
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    await stop();
  });

  test('can load block created by another session (with schema)', async () => {
    const schema = s.obj({foo: s.str('bar')});
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });

  test('receives changes done in another session', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    session1.model.api.root({foo: 'bar'});
    await until(() => session2.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });

  test('receives changes done in another session (reverse)', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    session2.model.api.root({foo: 'bar'});
    await until(() => session1.model.view()?.foo === 'bar');
    expect(session1.model.view()).toEqual({foo: 'bar'});
    expect(session2.model.view()).toEqual({foo: 'bar'});
    await stop();
  });

  test('two sessions can do edits simultaneously (with schema)', async () => {
    const schema = s.obj({});
    const [session1, session2, stop] = await setupTwoSessions(schema);
    session1.model.api.obj([]).set({foo: 'bar'});
    session2.model.api.obj([]).set({baz: 'qux'});
    await until(() => session2.model.view()?.foo === 'bar');
    await until(() => session1.model.view()?.baz === 'qux');
    expect(session1.model.view()).toEqual({foo: 'bar', baz: 'qux'});
    expect(session2.model.view()).toEqual({foo: 'bar', baz: 'qux'});
    await stop();
  });

  test('two sessions can do edits simultaneously', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    session1.model.api.root({});
    await until(() => !!session2.model.view());
    await until(() => !!session1.model.view());
    session1.model.api.obj([]).set({foo: 'bar'});
    session2.model.api.obj([]).set({baz: 'qux'});
    await until(() => session2.model.view()?.foo === 'bar');
    await until(() => session1.model.view()?.baz === 'qux');
    expect(session1.model.view()).toEqual({foo: 'bar', baz: 'qux'});
    expect(session2.model.view()).toEqual({foo: 'bar', baz: 'qux'});
    await stop();
  });

  test('can synchronize two session doing multiple edits', async () => {
    const schema = undefined;
    const [session1, session2, stop] = await setupTwoSessions(schema);
    expect(session1.model.view()).toBe(undefined);
    expect(session2.model.view()).toBe(undefined);
    session1.model.api.root({foo: 'bar'});
    await until(() => session2.model.view()?.foo === 'bar');

    session1.model.api.obj([]).set({x: 'x'});
    session1.model.api.obj([]).set({y: 'y'});
    await until(() => session2.model.view()?.y === 'y');
    expect(session1.model.view()).toEqual({foo: 'bar', x: 'x', y: 'y'});
    expect(session2.model.view()).toEqual({foo: 'bar', x: 'x', y: 'y'});

    session1.model.api.obj([]).set({x: '1'});
    session2.model.api.obj([]).set({y: '2'});
    await until(() => session2.model.view()?.x === '1');
    await until(() => session1.model.view()?.y === '2');
    expect(session1.model.view()).toEqual({foo: 'bar', x: '1', y: '2'});
    expect(session2.model.view()).toEqual({foo: 'bar', x: '1', y: '2'});

    session2.model.api.obj([]).set({z: 'z'});
    await until(() => session1.model.view()?.z === 'z');
    expect(session1.model.view()).toEqual({foo: 'bar', x: '1', y: '2', z: 'z'});
    expect(session2.model.view()).toEqual({foo: 'bar', x: '1', y: '2', z: 'z'});

    await stop();
  });
};

describe('two remote sessions', () => {
  runTwoSessionsTests(setupTwoRemoteSessions);
});

describe('two local sessions', () => {
  runTwoSessionsTests(setupTwoLocalSessions);
});

describe('two same-tab sessions', () => {
  runTwoSessionsTests(setupTwoSameTabSessions);
});
