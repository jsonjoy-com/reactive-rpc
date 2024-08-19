import {LevelLocalRepo, LevelLocalRepoOpts} from '../LevelLocalRepo';
import {Locks} from 'thingies/lib/Locks';
import {Model} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';
import {MemoryLevel} from 'memory-level';
import {BinStrLevel, LevelLocalRepoPubSub} from '../types';
import {pubsub as createPubsub} from '../../../pubsub';

export const setup = async (
  opts: {
    remote?: ReturnType<typeof remoteSetup>;
    local?: Partial<LevelLocalRepoOpts>;
  } = {},
) => {
  const remote = opts.remote ?? remoteSetup();
  const locks = new Locks();
  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  const id = genId();
  const col = ['collection', 'sub-collection']
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  }) as unknown as BinStrLevel;
  const blockId = [...col, id];
  const createLocal = (sid: number = 12345678) => {
    const pubsub = createPubsub('test-' + blockId.join('/')) as LevelLocalRepoPubSub;
    const local = new LevelLocalRepo({
      kv,
      locks,
      sid,
      rpc: remote.remote,
      connected$: new BehaviorSubject(true),
      pubsub,
      ...opts.local,
    });
    const stop = async () => {
      await local.stop();
      pubsub.end();
    };
    return {kv, sid, local, pubsub, stop};
  };
  const {sid, local, pubsub, stop} = createLocal();
  local.start();
  const log = Log.fromNewModel(Model.create(undefined, sid));
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  return {
    remote,
    locks,
    createLocal,
    pubsub,
    local,
    sid,
    log,
    genId,
    id,
    col,
    blockId,
    stop,
  };
};
