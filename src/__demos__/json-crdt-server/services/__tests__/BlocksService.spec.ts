import {until} from 'thingies';
import {Services, ServicesOpts} from '../Services';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {MemoryLevel} from 'memory-level';
import {LevelStore} from '../blocks/store/level/LevelStore';

const setup = async (opts?: ServicesOpts) => {
  const services = new Services(opts);
  const genId = () => 'id-' + Math.random().toString(36).slice(2) + '-' + Date.now();
  const id = genId();
  return {
    services,
    genId,
    id,
  }
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
      }
    });
  });
  
  test('can generate a long history', async () => {
    const kit = await setup();
    const model = Model.create();
    model.api.root({foo: 'bar'});
    await kit.services.blocks.create(kit.id, {patches: [{blob: model.api.flush().toBinary()}]});
    for (let i = 0; i < 100; i++) {
      model.api.obj([]).set({x: i});
      const patch = model.api.flush();
      await kit.services.blocks.edit(kit.id, {
        patches: [{blob: patch.toBinary()}],
      }, false);
    }
    const {batches, snapshot} = await kit.services.blocks.scan(kit.id, true, 0, 1000);
    expect(batches.length).toBe(101);
    expect(snapshot!.seq).toBe(-1);
    const model2 = Model.fromBinary(snapshot!.blob);
    for (const batch of batches)
      for (const patch of batch.patches)
        model2.applyPatch(Patch.fromBinary(patch.blob));
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
      await kit.services.blocks.edit(kit.id, {
        patches: [{blob: patch.toBinary()}],
      }, false);
    }
    await until(async () => (await kit.services.blocks.scan(kit.id, true, 0, 1000)).batches.length === 10);
    const {batches, snapshot} = await kit.services.blocks.scan(kit.id, true, 0, 1000);
    expect(batches.length).toBe(10);
    expect(snapshot!.seq).toBe(90);
    const model2 = Model.fromBinary(snapshot!.blob);
    for (const batch of batches)
      for (const patch of batch.patches)
        model2.applyPatch(Patch.fromBinary(patch.blob));
    expect(model2.view()).toEqual({foo: 'bar', x: 99});
  });  
};

describe('MemoryStore', () => {
  run(setup);
});

describe('LevelStore(memory-level)', () => {
  run(setupMemoryLevel);
});
