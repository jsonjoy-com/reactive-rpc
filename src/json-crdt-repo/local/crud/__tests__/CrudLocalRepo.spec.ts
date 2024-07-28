import {Model, nodes, s} from 'json-joy/lib/json-crdt';
import {setup} from './setup';

describe('.sync()', () => {
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
});
