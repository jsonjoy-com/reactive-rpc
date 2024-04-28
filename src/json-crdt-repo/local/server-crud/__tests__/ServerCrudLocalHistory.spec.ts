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
  const model = Model.withLogicalClock(sid);
  const log = Log.fromNewModel(model);
  return {
    remote,
    fs,
    vol,
    printFs,
    crud,
    locks,
    local,
    sid,
    model,
    log,
  };
};

describe('.create()', () => {
  test('...', async () => {
    const {local, log, printFs} = await setup();
    log.end.api.root({foo: 'bar'});
    log.end.api.flush();
    console.log(log + '');
    const res = await local.create(['collection'], log, 'test');
    await res.remote;
    console.log(res);
    printFs();
  });
});
