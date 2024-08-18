import {setup} from './setup';

test('can synchronously create an editing session', async () => {
  const kit = await setup();
  const session = kit.sessions.make(kit.blockId);
  expect(session.model.view()).toBe(undefined);
  session.dispose();
  await kit.stop();
});

test('can save a new session', async () => {
  const kit = await setup();
  const session = kit.sessions.make(kit.blockId);
  expect(session.model.view()).toBe(undefined);
  await session.sync();
  session.dispose();
  await kit.stop();
});

test('can save a session with edits', async () => {
  const kit = await setup();
  const session = kit.sessions.make(kit.blockId);
  expect(session.model.view()).toBe(undefined);
  await session.sync();
  session.model.api.root({foo: 'bar'});
  await session.sync();
  session.dispose();
  await kit.stop();
});

test('can load an existing block (created locally)', async () => {
  const kit = await setup();
  const session = kit.sessions.make(kit.blockId);
  expect(session.model.view()).toBe(undefined);
  session.model.api.root({foo: 'bar'});
  await session.sync();
  const session2 = await kit.sessions.load(kit.blockId);
  expect(session2.model.view()).toEqual({foo: 'bar'});
  session.dispose();
  await kit.stop();
});

test('can load an existing block (created remotely)', async () => {
  const kit = await setup();
  const session = kit.sessions.make(kit.blockId);
  expect(session.model.view()).toBe(undefined);
  session.model.api.root({foo: 'bar'});
  await session.sync();
  const session2 = await kit.sessions.load(kit.blockId);
  expect(session2.model.view()).toEqual({foo: 'bar'});
  session.dispose();
  await kit.stop();
});
