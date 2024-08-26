import {Model} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {tick} from 'thingies';

test('can synchronously create an editing session', async () => {
  const kit = await setup();
  kit.local.stop();
  const session = kit.sessions.make({id: kit.blockId});
  expect(session.model.view()).toBe(undefined);
  await session.dispose();
  await kit.stop();
});

test('can save a new session', async () => {
  const kit = await setup();
  const session = kit.sessions.make({id: kit.blockId});
  expect(session.model.view()).toBe(undefined);
  await session.sync();
  session.dispose();
  await kit.stop();
});

test('can save a session with edits', async () => {
  const kit = await setup();
  const session = kit.sessions.make({id: kit.blockId});
  expect(session.model.view()).toBe(undefined);
  await session.sync();
  session.model.api.root({foo: 'bar'});
  await session.sync();
  session.dispose();
  await kit.stop();
});

test('can load an existing block (created locally)', async () => {
  const kit = await setup();
  const session = kit.sessions.make({id: kit.blockId});
  expect(session.model.view()).toBe(undefined);
  session.model.api.root({foo: 'bar'});
  await session.sync();
  const session2 = await kit.sessions.load({id: kit.blockId});
  expect(session2.model.view()).toEqual({foo: 'bar'});
  session.dispose();
  await kit.stop();
});

test('can load an existing block (created remotely)', async () => {
  const kit = await setup();
  const model = Model.create(undefined, kit.sid);
  model.api.root({foo: 'bar'});
  const patch = model.api.flush();
  await kit.remote.remote.create(kit.blockId.join('/'), {patches: [{blob: patch.toBinary()}]});
  const session = await kit.sessions.load({id: kit.blockId});
  expect(session.model.view()).toEqual({foo: 'bar'});
  session.dispose();
  await kit.stop();
});

test('can create concurrently already existing block on remote', async () => {
  const kit = await setup();
  const model = Model.create(undefined, kit.sid);
  model.api.root({foo: 'bar'});
  const patch = model.api.flush();
  await kit.remote.remote.create(kit.blockId.join('/'), {patches: [{blob: patch.toBinary()}]});
  const session = await kit.sessions.make({id: kit.blockId});
  await tick(1232);
  expect(session.model.view()).toEqual({foo: 'bar'});
  session.dispose();
  await kit.stop();
});
