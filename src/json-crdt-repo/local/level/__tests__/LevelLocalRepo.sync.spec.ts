import {Model, s, NodeBuilder, Patch} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {tick} from 'thingies';
import {BehaviorSubject} from 'rxjs';

describe('.sync()', () => {
  describe('new session', () => {
    describe('create empty', () => {
      test('can create a new empty block', async () => {
        const kit = await setup();
        const res1 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res1.model).toBe(undefined);
        expect(res1.remote).toEqual(expect.any(Promise));
        expect(res1.cursor).toEqual([0, -1]);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
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
        expect(res1.cursor).toEqual([0, -1]);
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
        expect(res1.cursor).toEqual([0, -1]);
        const res2 = await kit.local.sync({
          id: kit.blockId,
          patches: [],
        });
        expect(res2.model!.view()).toBe(undefined);
        expect(res2.remote).toEqual(expect.any(Promise));
        expect(res2.cursor).toEqual([0, -1]);
        const get1 = await kit.local.get({id: kit.blockId});
        expect(get1.model.view()).toEqual(undefined);
        expect(get1.model.clock.sid).toBe(kit.sid);
        await local2.stop();
        await kit.stop();
      });
    });

    // describe('create', () => {
    //   test('can create a new block', async () => {
    //     const kit = await setup();
    //     const model = Model.create(undefined, kit.sid);
    //     model.api.root({foo: 'bar'});
    //     const patches = [model.api.flush()];
    //     await kit.local.sync({
    //       id: kit.blockId,
    //       patches: patches,
    //     });
    //     const {model: model2} = await kit.local.sync({id: kit.blockId});
    //     expect(model2?.view()).toEqual({foo: 'bar'});
    //   });

    //   const testCreateAndMerge = async (schema: undefined | NodeBuilder) => {
    //     const kit = await setup({
    //       local: {
    //         connected$: new BehaviorSubject(false),
    //       },
    //     });
    //     const local2 = kit.createLocal();
    //     const model1 = Model.create(schema, kit.sid);
    //     const patches1: Patch[] = [];
    //     if (model1.api.builder.patch.ops.length) patches1.push(model1.api.flush());
    //     model1.api.root({foo: 'bar'});
    //     patches1.push(model1.api.flush());
    //     await kit.local.sync({
    //       id: kit.blockId,
    //       patches: patches1,
    //     });
    //     const read1 = await kit.local.sync({id: kit.blockId});
    //     expect(read1.model?.view()).toEqual({foo: 'bar'});
    //     const model2 = Model.create(schema, kit.sid);
    //     const patches2: Patch[] = [];
    //     if (model2.api.builder.patch.ops.length) patches2.push(model2.api.flush());
    //     model2.api.root({foo: 'baz'});
    //     patches2.push(model2.api.flush());
    //     await local2.local.sync({
    //       id: kit.blockId,
    //       patches: patches2,
    //     });
    //     const read2 = await kit.local.sync({id: kit.blockId});
    //     expect(read2.model?.view()).toEqual({foo: 'baz'});
    //   };

    //   test('can merge new block patches, with concurrently created same-ID block from another tab', async () => {
    //     await testCreateAndMerge(undefined);
    //   });

    //   test('can merge new block patches, with concurrently created same-ID block from another tab (with schema)', async () => {
    //     const schema = s.obj({});
    //     await testCreateAndMerge(schema);
    //   });

    //   test('test merge on create with multiple patches', async () => {
    //     const kit = await setup({local: {
    //       connected$: new BehaviorSubject(false),
    //     }});
    //     const schema = s.obj({});
    //     const model = Model.create(schema, kit.sid);
    //     model.api.autoFlush();
    //     const log1 = Log.fromNewModel(model);
    //     log1.end.api.autoFlush();
    //     log1.end.api.obj([]).set({
    //       foo: 'bar',
    //     });
    //     await tick(1);
    //     log1.end.api.obj([]).set({
    //       x: 1,
    //     });
    //     await tick(1);
    //     const patches1 = [...log1.patches.entries()].map(e => e.v);
    //     await kit.local.sync({
    //       id: kit.blockId,
    //       patches: patches1,
    //     });
    //     const read1 = await kit.local.sync({id: kit.blockId});
    //     expect(read1.model?.view()).toEqual({foo: 'bar', x: 1});
    //     const model2 = Model.create(schema, kit.sid);
    //     model2.api.autoFlush();
    //     const log2 = Log.fromNewModel(model2);
    //     log2.end.api.autoFlush();
    //     log2.end.api.obj([]).set({
    //       foo: 'baz',
    //     });
    //     await tick(1);
    //     log2.end.api.obj([]).set({
    //       y: 2,
    //     });
    //     await tick(1);
    //     const patches2 = [...log2.patches.entries()].map(e => e.v);
    //     await kit.local.sync({
    //       id: kit.blockId,
    //       patches: patches2,
    //     });
    //     const read2 = await kit.local.sync({id: kit.blockId});
    //     expect(read2.model?.view()).toEqual({foo: 'baz', x: 1, y: 2});
    //   });

    //   test.todo('test merge on create with remote Model already available');

    //   test('stores the new block on remote', async () => {
    //     const kit = await setup();
    //     const model = Model.create(undefined, kit.sid);
    //     model.api.root({foo: 'bar'});
    //     const patches = [model.api.flush()];
    //     const sync = await kit.local.sync({
    //       id: kit.blockId,
    //       patches: patches,
    //     });
    //     await sync.remote;
    //     const blockId = kit.blockId.join('/');
    //     const res = await kit.remote.remote.read(blockId);
    //     const model2 = Model.load(res.block.snapshot.blob);
    //     expect(model2.view()).toEqual({foo: 'bar'});
    //   });
    // });
  });
  
  // describe('update', () => {
  //   test.todo('test merge on create with remote Model already available');
  // });
  
  // describe('read', () => {
  //   test('can read own block (same tab)', async () => {
  //     const kit = await setup();
  //     const schema = s.obj({foo: s.str('bar')});
  //     const model = Model.create(schema, kit.sid);
  //     const patches = [model.api.flush()];
  //     await kit.local.sync({
  //       id: kit.blockId,
  //       patches: patches,
  //     });
  //     const {model: model2} = await kit.local.sync({id: kit.blockId});
  //     expect(model2?.view()).toEqual({foo: 'bar'});
  //   });

  //   test('can read block created by another tab', async () => {
  //     const kit = await setup();
  //     const schema = s.obj({foo: s.str('bar')});
  //     const model = Model.create(schema, kit.sid);
  //     const patches = [model.api.flush()];
  //     await kit.local.sync({
  //       id: kit.blockId,
  //       patches: patches,
  //     });
  //     const local2 = await kit.createLocal();
  //     const {model: model2} = await local2.local.sync({id: kit.blockId});
  //     expect(model2?.view()).toEqual({foo: 'bar'});
  //   });

  //   test('can read block from remote', async () => {
  //     const kit = await setup();
  //     const schema = s.obj({foo: s.str('bar')});
  //     const model = Model.create(schema, kit.sid);
  //     await kit.remote.client.call('block.new', {
  //       id: kit.blockId.join('/'),
  //       batch: {
  //         patches: [{
  //           blob: model.api.flush()!.toBinary(),
  //         }],
  //       }
  //     });
  //     // const {model: model2, pull} = await kit.local.sync({id: kit.blockId});
  //     // console.log(pull);
  //     // expect(model2?.view()).toEqual({foo: 'bar'});
  //   });

  //   test.todo('can read block from remote, but create one locally in the meantime');
  // });
});
