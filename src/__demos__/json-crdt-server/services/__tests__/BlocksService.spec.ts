import {tick, until} from 'thingies';
import {Services, type ServicesOpts} from '../Services';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {MemoryLevel} from 'memory-level';
import {LevelStore} from '../blocks/store/level/LevelStore';

let cnt = 0;

const setup = async (opts?: ServicesOpts) => {
  const services = new Services(opts);
  const genId = () => 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now() + '-' + cnt++;
  const id = genId();
  return {
    services,
    genId,
    id,
  };
};

const setupMemoryLevel = async (opts?: Omit<ServicesOpts, 'store'>) => {
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  });
  const store = new LevelStore(<any>kv);
  return await setup({...opts, store});
};

type Setup = typeof setup;

const run = (setup: Setup) => {
  test('can create a block', async () => {
    const kit = await setup();
    const model = Model.create();
    model.api.root({foo: 'bar'});
    await kit.services.blocks.create(kit.id, {patches: [{blob: model.api.flush().toBinary()}]});
    const res = await kit.services.blocks.get(kit.id);
    expect(res).toMatchObject({
      block: {
        id: kit.id,
      },
    });
  });

  describe('history compaction', () => {
    test('can generate a long history', async () => {
      const kit = await setup();
      const model = Model.create();
      model.api.root({foo: 'bar'});
      await kit.services.blocks.create(kit.id, {patches: [{blob: model.api.flush().toBinary()}]});
      for (let i = 0; i < 100; i++) {
        model.api.obj([]).set({x: i});
        const patch = model.api.flush();
        await kit.services.blocks.edit(
          kit.id,
          {
            patches: [{blob: patch.toBinary()}],
          },
          false,
        );
      }
      const {batches, snapshot} = await kit.services.blocks.scan(kit.id, true, 0, 1000);
      expect(batches.length).toBe(101);
      expect(snapshot!.seq).toBe(-1);
      const model2 = Model.fromBinary(snapshot!.blob);
      for (const batch of batches) for (const patch of batch.patches) model2.applyPatch(Patch.fromBinary(patch.blob));
      expect(model2.view()).toEqual({foo: 'bar', x: 99});
    });

    test('can compact history', async () => {
      const kit = await setup({
        blocks: {
          historyPerBlock: 10,
          historyCompactionDecision: () => true,
        },
      });
      const model = Model.create();
      model.api.root({foo: 'bar'});
      await kit.services.blocks.create(kit.id, {patches: [{blob: model.api.flush().toBinary()}]});
      for (let i = 0; i < 100; i++) {
        model.api.obj([]).set({x: i});
        const patch = model.api.flush();
        await kit.services.blocks.edit(
          kit.id,
          {
            patches: [{blob: patch.toBinary()}],
          },
          false,
        );
      }
      await until(async () => (await kit.services.blocks.scan(kit.id, true, 0, 1000)).batches.length === 10);
      const {batches, snapshot} = await kit.services.blocks.scan(kit.id, true, 0, 1000);
      expect(batches.length).toBe(10);
      expect(snapshot!.seq).toBe(90);
      const model2 = Model.fromBinary(snapshot!.blob);
      for (const batch of batches) for (const patch of batch.patches) model2.applyPatch(Patch.fromBinary(patch.blob));
      expect(model2.view()).toEqual({foo: 'bar', x: 99});
    });
  });

  describe('GC - space reclaim', () => {
    test('deletes oldest blocks when GC is called', async () => {
      const blocksToDelete = {num: 0};
      const kit = await setup({
        blocks: {
          historyPerBlock: 10,
          historyCompactionDecision: () => true,
          spaceReclaimDecision: async () => blocksToDelete.num,
        },
      });
      const ids = [kit.genId(), kit.genId(), kit.genId(), kit.genId(), kit.genId(), kit.genId()];
      const create = async (id: string) => {
        const model = Model.create();
        model.api.root({foo: 'bar'});
        await kit.services.blocks.create(id, {patches: [{blob: model.api.flush().toBinary()}]});
      };
      const exists = async (id: string): Promise<boolean> => {
        try {
          await kit.services.blocks.get(id);
          return true;
        } catch {
          return false;
        }
      };
      await create(ids[0]);
      await tick(2);
      await create(ids[1]);
      await tick(2);
      await create(ids[2]);
      await tick(2);
      await create(ids[3]);
      expect(await exists(ids[0])).toBe(true);
      expect(await exists(ids[1])).toBe(true);
      expect(await exists(ids[2])).toBe(true);
      expect(await exists(ids[3])).toBe(true);
      await tick(2);
      blocksToDelete.num = 2;
      await create(ids[4]);
      await until(async () => (await exists(ids[0])) === false);
      await until(async () => (await exists(ids[1])) === false);
      expect(await exists(ids[0])).toBe(false);
      expect(await exists(ids[1])).toBe(false);
      expect(await exists(ids[2])).toBe(true);
      expect(await exists(ids[3])).toBe(true);
      expect(await exists(ids[4])).toBe(true);
      await tick(2);
      blocksToDelete.num = 1;
      await create(ids[5]);
      await until(async () => (await exists(ids[2])) === false);
      expect(await exists(ids[0])).toBe(false);
      expect(await exists(ids[1])).toBe(false);
      expect(await exists(ids[2])).toBe(false);
      expect(await exists(ids[3])).toBe(true);
      expect(await exists(ids[4])).toBe(true);
      expect(await exists(ids[5])).toBe(true);
    });
  });
};

describe('MemoryStore', () => {
  run(setup);
});

describe('LevelStore(memory-level)', () => {
  run(setupMemoryLevel);
});
