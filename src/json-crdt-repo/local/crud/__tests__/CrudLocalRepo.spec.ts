import {Model, nodes, s} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';
import {tick, until} from 'thingies';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
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

    console.log(model + '');
    console.log(kit.vol.toJSON());
    console.log(kit.vol.toTree());
  });
});
