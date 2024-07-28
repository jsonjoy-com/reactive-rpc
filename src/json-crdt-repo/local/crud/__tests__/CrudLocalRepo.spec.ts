import {Model, nodes, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';

describe('.sync()', () => {
  describe('create', () => {
    test('can create a new block', async () => {
      const kit = await setup();
      const model = Model.create(undefined, kit.sid);
      model.api.root({foo: 'bar'});
      const patches = [model.api.flush()];
      await kit.local.sync({
        col: ['collection'],
        id: kit.id,
        batch: patches,
      });
      expect(kit.vol.toJSON()).toMatchObject({
        [`/blocks/collection/${kit.id}/meta.seq.cbor`]: expect.any(String),
      });
    });

    test('can merge new block patches, with concurrently created same-ID block from another tab', async () => {
      const kit = await setup();
      const local2 = kit.createLocal();
      const model1 = Model.create(undefined, kit.sid);
      model1.api.root({foo: 'bar'});
      const patches1 = [model1.api.flush()];
      await kit.local.sync({
        col: ['collection'],
        id: kit.id,
        batch: patches1,
      });
      expect(kit.vol.toJSON()).toMatchObject({
        [`/blocks/collection/${kit.id}/meta.seq.cbor`]: expect.any(String),
      });
      const model2 = Model.create(undefined, kit.sid);
      model2.api.root({foo: 'baz'});
      const patches2 = [model2.api.flush()];
      await local2.local.sync({
        col: ['collection'],
        id: kit.id,
        batch: patches2,
      });
    });

    // TODO: correctly marges schema patches
  });
});
