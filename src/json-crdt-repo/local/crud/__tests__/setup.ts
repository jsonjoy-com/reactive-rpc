import {ServerCrudLocalHistory, ServerCrudLocalHistoryOpts} from '../ServerCrudLocalHistory';
import {memfs} from 'memfs';
import {NodeCrud} from 'memfs/lib/node-to-crud';
import {toTreeSync} from 'memfs/lib/print';
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
  const createLocal = (sid: number = 12345678) => {
    const {fs, vol} = memfs();
    const printFs = () => {
      // tslint:disable-next-line no-console
      console.log(toTreeSync(fs));
    };
    const crud = new NodeCrud({fs: fs.promises, dir: '/'});
    const locks = new Locks();
    const local = new ServerCrudLocalHistory({
      crud,
      locks,
      remote: remote.remote,
      sid,
      connected$: new BehaviorSubject(true),
      ...opts.local,
    });
    return {fs, vol, printFs, sid, crud, locks, local};
  };
  const {fs, vol, printFs, sid, crud, locks, local} = createLocal();
  local.sync.start();
  const log = Log.fromNewModel(Model.create(undefined, sid));
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const id = genId();
  const stop = () => {
    local.sync.stop();
  };
  return {
    remote,
    fs,
    vol,
    printFs,
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
