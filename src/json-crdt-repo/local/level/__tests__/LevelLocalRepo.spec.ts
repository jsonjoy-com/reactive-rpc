import {Model, s, NodeBuilder, Patch} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {tick} from 'thingies';

describe('.sync()', () => {
  describe('create', () => {
    test('can create a new block', async () => {
      const kit = await setup();
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patches = [model.api.flush()];
      await kit.local.sync({
        id: kit.blockId,
        batch: patches,
      });
      const {model: model2} = await kit.local.sync({id: kit.blockId});
      expect(model2?.view()).toEqual({foo: 'bar'});
    });

    const testCreateAndMerge = async (schema: undefined | NodeBuilder) => {
      const kit = await setup();
      const local2 = kit.createLocal();
      const model1 = Model.create(schema, kit.sid);
      const patches1: Patch[] = [];
      if (model1.api.builder.patch.ops.length) patches1.push(model1.api.flush());
      model1.api.root({foo: 'bar'});
      patches1.push(model1.api.flush());
      await kit.local.sync({
        id: kit.blockId,
        batch: patches1,
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
        batch: patches2,
      });
      const read2 = await kit.local.sync({id: kit.blockId});
      expect(read2.model?.view()).toEqual({foo: 'baz'});
    };

    test('can merge new block patches, with concurrently created same-ID block from another tab', async () => {
      await testCreateAndMerge(undefined);
    });

    test('can merge new block patches, with concurrently created same-ID block from another tab (with schema)', async () => {
      const schema = s.obj({});
      await testCreateAndMerge(schema);
    });

    test('test merge on create with multiple patches', async () => {
      const kit = await setup();
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
        batch: patches1,
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
        batch: patches2,
      });
      const read2 = await kit.local.sync({id: kit.blockId});
      expect(read2.model?.view()).toEqual({foo: 'baz', x: 1, y: 2});
    });

    // test.todo('test merge on create with remote Model already available');

    test.only('stores the new block on remote', async () => {
      const kit = await setup();
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patches = [model.api.flush()];
      await kit.local.sync({
        id: kit.blockId,
        batch: patches,
      });
      await tick(222);
      const blockId = kit.blockId.join('/');
      console.log('blockId', blockId);
      const res = await kit.remote.remote.read(blockId);
      console.log('....', res);
    });
  });
});
