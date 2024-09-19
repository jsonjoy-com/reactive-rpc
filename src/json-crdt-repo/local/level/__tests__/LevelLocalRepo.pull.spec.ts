import {Model, Patch, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';
import {firstValueFrom, ReplaySubject} from 'rxjs';
import {LocalRepo, LocalRepoMergeEvent, LocalRepoResetEvent} from '../../types';

const get = async (kit: Awaited<ReturnType<typeof setup>>, id = kit.blockId): Promise<Model> => {
  const {block} = await kit.remote.client.call('block.get', {id: id.join('/')});
  const model = Model.load(block.snapshot.blob);
  for (const batch of block.tip)
    for (const patch of batch.patches)
      model.applyPatch(Patch.fromBinary(patch.blob));
  return model;
};

describe('.pull()', () => {
  describe('new block', () => {
    test('can read a new block', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      await kit.remote.client.call('block.new', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: patches[0].toBinary(),
          }],
        }
      });
      await kit.local.pull(kit.blockId);
      const get = await kit.local.get({id: kit.blockId});
      expect(get.model.view()).toEqual({foo: 'bar'});
      await kit.stop();
    });

    test('emits "reset" event', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      await kit.remote.client.call('block.new', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: patches[0].toBinary(),
          }],
        }
      });
      const events$ = new ReplaySubject<LocalRepoResetEvent>(1);
      let cnt = 0;
      kit.local.change$(kit.blockId).subscribe((event) => {
        if (!(event as LocalRepoResetEvent).reset) return;
        events$.next(event as LocalRepoResetEvent);
        cnt++;
      });
      await kit.local.pull(kit.blockId);
      const event = await firstValueFrom(events$);
      expect(cnt).toBe(1);
      expect(event.reset.view()).toEqual({foo: 'bar'});
      await kit.stop();
    });
  });

  describe('existing block', () => {
    test('running .pull() is idempotent', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      const local: LocalRepo = kit.local;
      const res = await local.sync({id: kit.blockId, patches});
      await res.remote;
      const model2 = await get(kit);
      expect(model2.view()).toEqual({foo: 'bar'});
      model2.api.obj([]).set({foo: 'baz'});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      model2.api.obj([]).set({x: 1});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      const get1 = await local.get({id: kit.blockId});
      expect(get1.model.view()).toEqual({foo: 'bar'});
      let cnt = 0;
      kit.local.change$(kit.blockId).subscribe((event) => {
        if (!(event as LocalRepoMergeEvent).merge) return;
        cnt++;
      });
      await kit.local.pull(kit.blockId);
      const get2 = await local.get({id: kit.blockId});
      expect(get2.model.view()).toEqual({foo: 'baz', x: 1});
      await kit.local.pull(kit.blockId);
      await kit.local.pull(kit.blockId);
      const get3 = await local.get({id: kit.blockId});
      expect(get3.model.view()).toEqual({foo: 'baz', x: 1});
      await kit.stop();
    });

    test('handles case when another thread synchronized the block ahead of time', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      const local: LocalRepo = kit.local;
      const res = await local.sync({id: kit.blockId, patches});
      await res.remote;
      const local2 = await kit.createLocal();
      const read1 = await local2.local.sync({id: kit.blockId});
      expect(read1.model!.view()).toEqual({foo: 'bar'});
      const model2 = await get(kit);
      expect(model2.view()).toEqual({foo: 'bar'});
      model2.api.obj([]).set({foo: 'baz'});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      model2.api.obj([]).set({x: 1});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      try {
        const promise1 = local.pull(kit.blockId);
        const promise2 = local.pull(kit.blockId);
        await promise1;
        await promise2;
      } catch (error) {
        expect(error).toEqual(new Error('CONFLICT'));
      }
      const read2 = await local2.local.sync({id: kit.blockId});
      expect(read2.model!.view()).toEqual({foo: 'baz', x: 1});
      const read3 = await local.sync({id: kit.blockId});
      expect(read3.model!.view()).toEqual({foo: 'baz', x: 1});
      await local2.stop();
      await kit.stop();
    });

    test('handles case when another thread synchronized the block ahead of time - 2', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      const local: LocalRepo = kit.local;
      const res = await local.sync({id: kit.blockId, patches});
      await res.remote;
      const local2 = await kit.createLocal();
      const read1 = await local2.local.sync({id: kit.blockId});
      expect(read1.model!.view()).toEqual({foo: 'bar'});
      const model2 = await get(kit);
      expect(model2.view()).toEqual({foo: 'bar'});
      model2.api.obj([]).set({foo: 'baz'});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      model2.api.obj([]).set({x: 1});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      try {
        const promise2 = local.pull(kit.blockId);
        const promise1 = local.pull(kit.blockId);
        await promise2;
        await promise1;
      } catch (error) {
        expect(error).toEqual(new Error('CONFLICT'));
      }
      const read2 = await local2.local.sync({id: kit.blockId});
      expect(read2.model!.view()).toEqual({foo: 'baz', x: 1});
      const read3 = await local.sync({id: kit.blockId});
      expect(read3.model!.view()).toEqual({foo: 'baz', x: 1});
      await local2.stop();
      await kit.stop();
    });

    test('catches up using "merge" strategy', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      const local: LocalRepo = kit.local;
      const res = await local.sync({id: kit.blockId, patches});
      await res.remote;
      const model2 = await get(kit);
      expect(model2.view()).toEqual({foo: 'bar'});
      model2.api.obj([]).set({foo: 'baz'});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      model2.api.obj([]).set({x: 1});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      const model3 = await get(kit);
      expect(model3.view()).toEqual({foo: 'baz', x: 1});
      const events$ = new ReplaySubject<LocalRepoMergeEvent>(1);
      let cnt = 0;
      kit.local.change$(kit.blockId).subscribe((event) => {
        if (!(event as LocalRepoMergeEvent).merge) return;
        events$.next(event as LocalRepoMergeEvent);
        cnt++;
      });
      await kit.local.pull(kit.blockId);
      const event = await firstValueFrom(events$);
      expect(cnt).toBe(1);
      expect(model.view()).toEqual({foo: 'bar'});
      for (const patch of event.merge) model.applyPatch(patch);
      expect(model.view()).toEqual({foo: 'baz', x: 1});
      const read = await kit.local.get({id: kit.blockId});
      expect(read.model.view()).toEqual({foo: 'baz', x: 1});
      await kit.stop();
    });

    test('catches up using "reset" strategy', async () => {
      const kit = await setup();
      const schema = s.obj({foo: s.str('bar')});
      const model = Model.create(schema, kit.sid);
      const patches = [model.api.flush()];
      const local: LocalRepo = kit.local;
      const res = await local.sync({id: kit.blockId, patches});
      await res.remote;
      const model2 = await get(kit);
      expect(model2.view()).toEqual({foo: 'bar'});
      model2.api.obj([]).set({foo: 'baz'});
      await kit.remote.client.call('block.upd', {
        id: kit.blockId.join('/'),
        batch: {
          patches: [{
            blob: model2.api.flush().toBinary(),
          }],
        },
      });
      const setX = async (x: number) => {
        model2.api.obj([]).set({x});
        await kit.remote.client.call('block.upd', {
          id: kit.blockId.join('/'),
          batch: {
            patches: [{
              blob: model2.api.flush().toBinary(),
            }],
          },
        });
      };
      for (let i = 1; i <= 123; i++) await setX(i);
      const model3 = await get(kit);
      expect(model3.view()).toEqual({foo: 'baz', x: 123});
      const events$ = new ReplaySubject<LocalRepoResetEvent>(1);
      let cnt = 0;
      kit.local.change$(kit.blockId).subscribe((event) => {
        if (!(event as LocalRepoResetEvent).reset) return;
        events$.next(event as LocalRepoResetEvent);
        cnt++;
      });
      await kit.local.pull(kit.blockId);
      const event = await firstValueFrom(events$);
      expect(cnt).toBe(1);
      expect(model.view()).toEqual({foo: 'bar'});
      model.reset(<Model<any>>event.reset);
      expect(model.view()).toEqual({foo: 'baz', x: 123});
      const read = await kit.local.get({id: kit.blockId});
      expect(read.model.view()).toEqual({foo: 'baz', x: 123});
      await kit.stop();
    });
  });
});
