import {LevelLocalRepo, LevelLocalRepoOpts} from '../LevelLocalRepo';
import {Locks} from 'thingies/lib/Locks';
import {Model} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';
import {MemoryLevel} from 'memory-level';
import {BinStrLevel} from '../types';

export const setup = async (
  opts: {
    remote?: ReturnType<typeof remoteSetup>;
    local?: Partial<LevelLocalRepoOpts>;
  } = {},
) => {
  const remote = opts.remote ?? remoteSetup();
  const locks = new Locks();
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  }) as unknown as BinStrLevel;
  const createLocal = (sid: number = 12345678) => {
    const local = new LevelLocalRepo({
      kv,
      locks,
      sid,
      connected$: new BehaviorSubject(true),
      sync: {
        rpc: remote.remote,
      },
    });
    return {sid, local};
  };
  const {sid, local} = createLocal();
  local.start();
  const log = Log.fromNewModel(Model.create(undefined, sid));
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const id = genId();
  const col = ['collection', 'sub-collection']
  const stop = async () => {
    await local.stop();
  };
  return {
    remote,
    locks,
    createLocal,
    local,
    sid,
    log,
    genId,
    id,
    col,
    stop,
  };
};
