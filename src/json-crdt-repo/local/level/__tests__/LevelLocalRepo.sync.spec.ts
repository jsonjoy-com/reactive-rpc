import {Model, s, NodeBuilder, Patch} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {tick, until} from 'thingies';
import {BehaviorSubject} from 'rxjs';
import {LocalRepoEvent, LocalRepoMergeEvent} from '../../types';

describe('.sync()', () => {
  describe('new session', () => {
    describe('create empty', () => {
      test('can create a new empty block, stores in local repo', async () => {
        const kit = await setup();
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('can create a new empty block, stores on remote', async () => {
        const kit = await setup();
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        await until(async () => {
          try {
            await kit.getModelFromRemote();
            return true;
          } catch {
            return false;
          }
        });
        const model = await kit.getModelFromRemote();
        expect(model.view()).toEqual(undefined);
        await kit.stop();
      });

      test('when block already exists, created by the same process', async () => {
        const kit = await setup();
        await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model!.view()).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('when block already exists, created by another process', async () => {
        const kit = await setup();
        const local2 = await kit.createLocal();
        const res1 = await local2.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res2.model!.view()).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
        await local2.stop();
        await kit.stop();
      });
    });

    describe('create with patch upsert', () => {
      test('can create a new block', async () => {
        const kit = await setup();
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patches = [model.api.flush()];
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({foo: 'bar'});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('can create with schema', async () => {
        const kit = await setup();
        const schema = s.obj({schema: s.con(true), id: s.con('asdf')});
        const model = Model.create(schema, kit.sid);
        const patches = [model.api.flush()];
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        expect(model.clock.time > 1).toBe(true);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({schema: true, id: 'asdf'});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('can create a new block, with multiple patches', async () => {
        const kit = await setup();
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patches = [model.api.flush()];
        model.api.obj([]).set({x: 1});
        patches.push(model.api.flush());
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({foo: 'bar', x: 1});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('when an empty block with the same ID exists', async () => {
        const kit = await setup();
        await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        const model2 = Model.create(undefined, kit.sid);
        model2.api.root({foo: 'bar'});
        const patches2 = [model2.api.flush()];
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(res2.model).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({foo: 'bar'});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });

      test('when a block with the same schema and ID exists', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const model1 = Model.create(schema, kit.sid);
        const patches = [model1.api.flush()];
        expect(model1.view()).toEqual({a: 'b'});
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(model2.clock.time).toBe(model1.clock.time);
        expect(model2.clock.sid).toBe(model1.clock.sid);
        expect(res2.model!).toBe(undefined);
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({a: 'b'});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });
    });

    describe('create and resolve local conflicts', () => {
      test('create block with schema, when empty block exists', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const local2 = await kit.createLocal();
        const res1 = await local2.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(res2.model!).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        const get2 = await kit.local.get({id: kit.blockId});
        expect(get2.model.view()).toEqual({a: 'b'});
        expect(get2.model.clock.sid).toBe(kit.sid);
        await local2.stop();
        await kit.stop();
      });

      test('create with schema, when block exists and is already advanced, returns reset model', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const local2 = await kit.createLocal();
        const model1 = Model.create(schema, kit.sid);
        const patches = [model1.api.flush()];
        model1.api.obj([]).set({x: 1});
        patches.push(model1.api.flush());
        expect(model1.view()).toEqual({a: 'b', x: 1});
        const res1 = await local2.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(model2.clock.time < model1.clock.time).toBe(true);
        expect(model2.clock.sid).toBe(model1.clock.sid);
        expect(res2.model).toBe(undefined);
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({a: 'b', x: 1});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await local2.stop();
        await kit.stop();
      });

      test('create with schema and patches, when block exists and is already advanced, returns reset model', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const local2 = await kit.createLocal();
        const model1 = Model.create(schema, kit.sid);
        const patches = [model1.api.flush()];
        model1.api.obj([]).set({x: 1});
        patches.push(model1.api.flush());
        expect(model1.view()).toEqual({a: 'b', x: 1});
        const res1 = await local2.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        model2.api.obj([]).set({y: 2});
        patches2.push(model2.api.flush());
        model2.api.obj([]).set({z: 3});
        patches2.push(model2.api.flush());
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(model2.view()).toEqual({a: 'b', y: 2, z: 3});
        expect(model2.clock.time > model1.clock.time).toBe(true);
        expect(model2.clock.sid).toBe(model1.clock.sid);
        expect(res2.model!.view()).toEqual({a: 'b', x: 1, y: 2, z: 3});
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({a: 'b', x: 1, y: 2, z: 3});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await local2.stop();
        await kit.stop();
      });

      test('create with schema and patches, when block exists only with schema, does not reset', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const model1 = Model.create(schema, kit.sid);
        const patches = [model1.api.flush()];
        expect(model1.view()).toEqual({a: 'b'});
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual(-1);
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        model2.api.obj([]).set({y: 2});
        patches2.push(model2.api.flush());
        model2.api.obj([]).set({z: 3});
        patches2.push(model2.api.flush());
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(model2.view()).toEqual({a: 'b', y: 2, z: 3});
        expect(model2.clock.time > model1.clock.time).toBe(true);
        expect(model2.clock.sid).toBe(model1.clock.sid);
        expect(res2.model).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({a: 'b', y: 2, z: 3});
        expect(get1.model.clock.sid).toBe(kit.sid);
        await kit.stop();
      });
    });

    describe('remote block already exists', () => {
      test('create block with schema, when empty remote block exists', async () => {
        const kit = await setup();
        await kit.remote.client.call('block.new', {
          id: kit.blockId.join('/'),
        });
        const model1 = await kit.getModelFromRemote();
        expect(model1.view()).toBe(undefined);
        const schema = s.obj({a: s.str('b')});
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(res2.model!).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        await res2.remote;
        const model3 = await kit.getModelFromRemote();
        expect(model3.view()).toEqual({a: 'b'});
        await kit.stop();
      });

      test('create block with schema, when remote block with schema exists', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const model0 = Model.create(schema, kit.sid);
        const patches0 = [model0.api.flush()];
        await kit.remote.client.call('block.new', {
          id: kit.blockId.join('/'),
          batch: {
            patches: patches0.map(p => ({blob: p.toBinary()})),
          },
        });
        const model1 = await kit.getModelFromRemote();
        expect(model1.view()).toEqual({a: 'b'});
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        expect(res2.model!).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        await res2.remote;
        const model3 = await kit.getModelFromRemote();
        expect(model3.view()).toEqual({a: 'b'});
        await kit.stop();
      });

      test('create block with schema, when remote exists and has advanced', async () => {
        const kit = await setup();
        const schema = s.obj({a: s.str('b')});
        const model0 = Model.create(schema, kit.sid);
        const patches0 = [model0.api.flush()];
        model0.api.obj([]).set({x: 1});
        patches0.push(model0.api.flush());
        await kit.remote.client.call('block.new', {
          id: kit.blockId.join('/'),
          batch: {
            patches: patches0.map(p => ({blob: p.toBinary()})),
          },
        });
        expect(model0.view()).toEqual({a: 'b', x: 1});
        const model1 = await kit.getModelFromRemote();
        expect(model1.view()).toEqual({a: 'b', x: 1});
        const model2 = Model.create(schema, kit.sid);
        const patches2 = [model2.api.flush()];
        expect(model2.view()).toEqual({a: 'b'});
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        let events: LocalRepoEvent[] = [];
        const subscription = kit.local.change$(kit.blockId).subscribe(e => {
          events.push(e);
        });
        expect(res2.model!).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual(-1);
        await res2.remote;
        const model3 = await kit.getModelFromRemote();
        expect(model3.view()).toEqual({a: 'b', x: 1});
        expect(events.length).toBe(1);
        const event = events[0] as LocalRepoMergeEvent;
        expect(event.merge.length > 0).toBe(true);
        expect(model2.view()).toEqual({a: 'b'});
        model2.applyBatch(event.merge);
        expect(model2.view()).toEqual({a: 'b', x: 1});
        subscription.unsubscribe();
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual({a: 'b', x: 1});
        await kit.stop();
      });
    });

    describe('various', () => {
      test('can create a new block', async () => {
        const kit = await setup();
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patches = [model.api.flush()];
        await kit.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        const {model: model2} = await kit.local.sync({id: kit.blockId});
        expect(model2?.view()).toEqual({foo: 'bar'});
        await kit.stop();
      });

      const testCreateAndMerge = async (schema: undefined | NodeBuilder) => {
        const kit = await setup({
          local: {
            connected$: new BehaviorSubject(false),
          },
        });
        const local2 = kit.createLocal();
        const model1 = Model.create(schema, kit.sid);
        const patches1: Patch[] = [];
        if (model1.api.builder.patch.ops.length) patches1.push(model1.api.flush());
        model1.api.root({foo: 'bar'});
        patches1.push(model1.api.flush());
        await kit.local.sync({
          id: kit.blockId,
          patches: patches1,
        });
        const read1 = await kit.local.sync({id: kit.blockId});
        expect(read1.model?.view()).toEqual({foo: 'bar'});
        const model2 = Model.create(schema, kit.sid);
        const patches2: Patch[] = [];
        if (model2.api.builder.patch.ops.length) patches2.push(model2.api.flush());
        model2.api.root({foo: 'baz'});
        patches2.push(model2.api.flush());
        await local2.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        const read2 = await kit.local.sync({id: kit.blockId});
        expect(read2.model?.view()).toEqual({foo: 'baz'});
        await local2.stop();
        await kit.stop();
      };

      test('can merge new block patches, with concurrently created same-ID block from another tab', async () => {
        await testCreateAndMerge(undefined);
      });

      test('can merge new block patches, with concurrently created same-ID block from another tab (with schema)', async () => {
        const schema = s.obj({});
        await testCreateAndMerge(schema);
      });

      test('test merge on create with multiple patches', async () => {
        const kit = await setup({local: {
          connected$: new BehaviorSubject(false),
        }});
        const schema = s.obj({});
        const model = Model.create(schema, kit.sid);
        model.api.autoFlush();
        const log1 = Log.fromNewModel(model);
        log1.end.api.autoFlush();
        log1.end.api.obj([]).set({
          foo: 'bar',
        });
        await tick(1);
        log1.end.api.obj([]).set({
          x: 1,
        });
        await tick(1);
        const patches1 = [...log1.patches.entries()].map(e => e.v);
        await kit.local.sync({
          id: kit.blockId,
          patches: patches1,
        });
        const read1 = await kit.local.sync({id: kit.blockId});
        expect(read1.model?.view()).toEqual({foo: 'bar', x: 1});
        const model2 = Model.create(schema, kit.sid);
        model2.api.autoFlush();
        const log2 = Log.fromNewModel(model2);
        log2.end.api.autoFlush();
        log2.end.api.obj([]).set({
          foo: 'baz',
        });
        await tick(1);
        log2.end.api.obj([]).set({
          y: 2,
        });
        await tick(1);
        const patches2 = [...log2.patches.entries()].map(e => e.v);
        await kit.local.sync({
          id: kit.blockId,
          patches: patches2,
        });
        const read2 = await kit.local.sync({id: kit.blockId});
        expect(read2.model?.view()).toEqual({foo: 'baz', x: 1, y: 2});
        await kit.stop();
      });

      test('stores the new block on remote', async () => {
        const kit = await setup();
        const model = Model.create(undefined, kit.sid);
        model.api.root({foo: 'bar'});
        const patches = [model.api.flush()];
        const sync = await kit.local.sync({
          id: kit.blockId,
          patches: patches,
        });
        await sync.remote;
        const blockId = kit.blockId.join('/');
        const res = await kit.remote.remote.read(blockId);
        const model2 = Model.load(res.block.snapshot.blob);
        expect(model2.view()).toEqual({foo: 'bar'});
        await kit.stop();
      });
    });
  });
  
  describe('update', () => {
    test('can write updates', async () => {
      const kit = await setup();
      const sync1 = await kit.local.sync({
        id: kit.blockId,
        patches: [],
      });
      expect(sync1.model).toBe(undefined);
      expect(sync1.cursor).toEqual(-1);
      const get1 = await kit.local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual(undefined);
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patches1 = [model.api.flush()];
      const sync2 = await kit.local.sync({
        id: kit.blockId,
        patches: patches1,
        cursor: sync1.cursor,
      });
      expect(sync2.model).toBe(undefined);
      expect(sync2.remote).toEqual(expect.any(Promise));
      const get2 = await kit.local.get({id: kit.blockId});
      expect(get2.model.view()).toEqual({foo: 'bar'});
      model.api.obj([]).set({x: 1});
      const patches2 = [model.api.flush()];
      const sync3 = await kit.local.sync({
        id: kit.blockId,
        patches: patches2,
        cursor: sync2.cursor,
      });
      expect(sync3.remote).toEqual(expect.any(Promise));
      const get3 = await kit.local.get({id: kit.blockId});
      expect(get3.model.view()).toEqual({foo: 'bar', x: 1});
      await kit.stop();
    });

    test('can write multiple patches per update', async () => {
      const kit = await setup();
      const sync1 = await kit.local.sync({
        id: kit.blockId,
        patches: [],
      });
      expect(sync1.model).toBe(undefined);
      expect(sync1.cursor).toEqual(-1);
      const get1 = await kit.local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual(undefined);
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patches1 = [model.api.flush()];
      model.api.str(['foo']).del(2, 1);
      patches1.push(model.api.flush());
      model.api.str(['foo']).ins(2, 'z');
      patches1.push(model.api.flush());
      const sync2 = await kit.local.sync({
        id: kit.blockId,
        patches: patches1,
        cursor: sync1.cursor,
      });
      expect(sync2.remote).toEqual(expect.any(Promise));
      const get2 = await kit.local.get({id: kit.blockId});
      expect(get2.model.view()).toEqual({foo: 'baz'});
      model.api.obj([]).set({x: 1});
      const patches2 = [model.api.flush()];
      model.api.obj([]).set({y: 2});
      patches2.push(model.api.flush());
      model.api.obj([]).set({z: 3});
      patches2.push(model.api.flush());
      model.api.obj([]).set({y: 4});
      patches2.push(model.api.flush());
      const sync3 = await kit.local.sync({
        id: kit.blockId,
        patches: patches2,
        cursor: sync2.cursor,
      });
      expect(sync3.remote).toEqual(expect.any(Promise));
      const get3 = await kit.local.get({id: kit.blockId});
      expect(get3.model.view()).toEqual({foo: 'baz', x: 1, y: 4, z: 3});
      await kit.stop();
    });

    test('can push an update when local already advanced', async () => {
      const kit = await setup();

      // Create in another tab
      const local2 = await kit.createLocal();
      const model1 = Model.create(undefined, kit.sid);
      model1.api.root([1, 2, 3]);
      const patches1 = [model1.api.flush()];
      const sync1 = await local2.local.sync({
        id: kit.blockId,
        patches: patches1,
      });

      // Load block in the first tab
      const sync2 = await kit.local.sync({
        id: kit.blockId,
      });
      const model2 = sync2.model!;
      expect(model2.view()).toEqual([1, 2, 3]);
      expect(sync1.remote).toEqual(expect.any(Promise));

      // Update models concurrently in both tabs
      model1.api.arr([]).del(0, 1);
      model2.api.arr([]).ins(3, [4]);
      expect(model1.view()).toEqual([2, 3]);
      expect(model2.view()).toEqual([1, 2, 3, 4]);

      // Save changes of the other tab
      const sync3 = await local2.local.sync({
        id: kit.blockId,
        patches: [model1.api.flush()],
        cursor: sync1.cursor,
      });
      const get1 = await kit.local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual([2, 3]);

      // Save changes of the first tab
      const sync4 = await kit.local.sync({
        id: kit.blockId,
        cursor: sync2.cursor,
        patches: [model2.api.flush()],
      });
      expect(sync4.model?.view()).toEqual([2, 3, 4]);

      await local2.stop();
      await kit.stop();
    });

    test('can push an update when local already advanced by multiple patches', async () => {
      const kit = await setup();

      // Create in another tab
      const local2 = await kit.createLocal();
      const model1 = Model.create(undefined, kit.sid);
      model1.api.root([1, 2, 3]);
      const patches1 = [model1.api.flush()];
      const sync1 = await local2.local.sync({
        id: kit.blockId,
        patches: patches1,
      });

      // Load block in the first tab
      const sync2 = await kit.local.sync({
        id: kit.blockId,
      });
      const model2 = sync2.model!;
      expect(model2.view()).toEqual([1, 2, 3]);
      expect(sync1.remote).toEqual(expect.any(Promise));

      // Update models concurrently in both tabs
      model1.api.arr([]).del(0, 1);
      model2.api.arr([]).ins(3, [4]);
      expect(model1.view()).toEqual([2, 3]);
      expect(model2.view()).toEqual([1, 2, 3, 4]);

      // Save changes of the other tab
      const sync3 = await local2.local.sync({
        id: kit.blockId,
        patches: [model1.api.flush()],
        cursor: sync1.cursor,
      });
      const get1 = await kit.local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual([2, 3]);

      // Add more changes to the other tab
      model1.api.arr([]).del(0, 1);
      model1.api.arr([]).ins(1, [5]);
      const sync4 = await local2.local.sync({
        id: kit.blockId,
        patches: [model1.api.flush()],
        cursor: sync3.cursor,
      });

      // Save changes of the first tab
      const sync5 = await kit.local.sync({
        id: kit.blockId,
        cursor: sync2.cursor,
        patches: [model2.api.flush()],
      });
      expect(sync5.model?.view()).toEqual([3, 4, 5]);

      await local2.stop();
      await kit.stop();
    });

    test('can push an update when remote already advanced', async () => {
      const kit = await setup();
      await kit.remote.client.call('block.new', {
        id: kit.blockId.join('/'),
      });
      const model1 = await kit.getModelFromRemote();
      model1.api.root({foo: 'bar'});
      expect(model1.view()).toEqual({foo: 'bar'}); 
      const res = await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model1.api.flush()!.toBinary(),
          }],
        }
      });
      const model2 = (await kit.getModelFromRemote()).fork();
      expect(model2.view()).toEqual({foo: 'bar'});
      await kit.local.pull(kit.blockId);
      const get1 = await kit.local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual({foo: 'bar'});
      model1.api.obj([]).set({x: 1});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model1.api.flush()!.toBinary(),
          }],
        }
      });
      const model3 = await kit.getModelFromRemote();
      expect(model3.view()).toEqual({foo: 'bar', x: 1});
      model2.api.obj([]).set({y: 2});
      await kit.local.sync({
        id: kit.blockId,
        patches: [model2.api.flush()],
      });
      await until(async () => {
        const get = await kit.local.get({id: kit.blockId});
        return get.model.view().x === 1 && get.model.view().y === 2;
      });
      const get2 = await kit.local.get({id: kit.blockId});
      expect(get2.model.view()).toEqual({foo: 'bar', x: 1, y: 2});
      await kit.stop();
    });

    test.todo('can push an update when remote already advanced by multiple patches');
    test.todo('can push an update when local and remote have already advanced by different patches');
    
    describe('can push empty patch to re-sync with local', () => {
      test.todo('no changes if in-sync');
      test.todo('receives patches to catch up with local');
    });
  });
  
  describe('read', () => {
    test('can read own block (same tab)', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      await kit.local.sync({
        id: kit.blockId,
        patches: patches,
      });
      const {model: model2} = await kit.local.sync({id: kit.blockId});
      expect(model2?.view()).toEqual({foo: 'bar'});
      await kit.stop();
    });

    test('can read block created by another tab', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      await kit.local.sync({
        id: kit.blockId,
        patches: patches,
      });
      const local2 = await kit.createLocal();
      const {model: model2} = await local2.local.sync({id: kit.blockId});
      expect(model2?.view()).toEqual({foo: 'bar'});
      await local2.stop();
      await kit.stop();
    });

    // TODO: Use .load() method instead of .sync() method
    // test('can read block from remote', async () => {
    //   const kit = await setup();
    //   const schema = s.obj({foo: s.str('bar')});
    //   const model = Model.create(schema, kit.sid);
    //   await kit.remote.client.call('block.new', {
    //     id: kit.blockId.join('/'),
    //     batch: {
    //       patches: [{
    //         blob: model.api.flush()!.toBinary(),
    //       }],
    //     }
    //   });
    //   const {model: model2} = await kit.local.sync({id: kit.blockId});
    //   expect(model2?.view()).toEqual({foo: 'bar'});
    //   await kit.stop();
    // });

    test.todo('can read block from remote, but create one locally in the meantime');
  });
});
