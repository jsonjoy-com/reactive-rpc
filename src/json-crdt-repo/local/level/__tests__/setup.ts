import {CrudLocalRepo, ServerCrudLocalHistoryOpts} from '../CrudLocalRepo';
import {memfs} from 'memfs';
import {NodeCrud} from 'fs-zoo/lib/node-to-crud';
import {Locks} from 'thingies/lib/Locks';
import {Model} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';

export const setup = async (
  opts: {
    remote?: ReturnType<typeof remoteSetup>;
    local?: Partial<ServerCrudLocalHistoryOpts>;
  } = {},
) => {
  const remote = opts.remote ?? remoteSetup();
  const {fs, vol} = memfs();
  const createLocal = (sid: number = 12345678) => {
    const crud = new NodeCrud({fs: fs.promises, dir: '/'});
    const locks = new Locks();
    const local = new CrudLocalRepo({
      crud,
      locks,
      remote: remote.remote,
      sid,
      connected$: new BehaviorSubject(true),
      ...opts.local,
    });
    return {sid, crud, locks, local};
  };
  const {sid, crud, locks, local} = createLocal();
  // local.sync.start();
  const log = Log.fromNewModel(Model.create(undefined, sid));
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const id = genId();
  const stop = () => {
    // local.sync.stop();
  };
  return {
    remote,
    fs,
    vol,
    crud,
    locks,
    createLocal,
    local,
    sid,
    log,
    genId,
    id,
    stop,
  };
};
