import {ServerCrudLocalHistory} from '../ServerCrudLocalHistory';
import {memfs} from 'memfs';
import {NodeCrud} from 'memfs/lib/node-to-crud';
import {toTreeSync} from 'memfs/lib/print';
import {Locks} from 'thingies/es2020/Locks';
import {Model} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';

const setup = async () => {
  const remote = remoteSetup();
  const {fs, vol} = memfs();
  const printFs = () => console.log(toTreeSync(fs));
  const sid = 123456788;
  const crud = new NodeCrud({fs: fs.promises, dir: '/'});
  const locks = new Locks();
  const local = new ServerCrudLocalHistory({
    crud,
    locks,
    remote: remote.remote,
    sid,
    connected$: new BehaviorSubject(true),
  });
  const log = Log.fromNewModel(Model.withLogicalClock(sid));
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const id = genId();
  return {
    remote,
    fs,
    vol,
    printFs,
    crud,
    locks,
    local,
    sid,
    log,
    genId,
    id,
  };
};

describe('.create()', () => {
  test('can create a new block', async () => {
    const kit = await setup();
    const res = await kit.local.create(['collection'], kit.log, kit.id);
    expect(res).toMatchObject({
      id: kit.id,
      remote: expect.any(Promise)
    });
  });

  test('stores the new block on remote', async () => {
    const kit = await setup();
    const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
    expect(kit.remote.services.blocks.stats().blocks).toBe(0);
    await res.remote;
    expect(kit.remote.services.blocks.stats().blocks).toBe(1);
  });
});
