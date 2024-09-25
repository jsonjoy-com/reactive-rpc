import {LevelLocalRepo, LevelLocalRepoOpts} from '../LevelLocalRepo';
import {Locks} from 'thingies/lib/Locks';
import {Model, Patch} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';
import {MemoryLevel} from 'memory-level';
import {BinStrLevel, LevelLocalRepoPubSub} from '../types';
import {pubsub as createPubsub} from '../../../pubsub';

/* tslint:disable:no-console */

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
  const col = ['collection', 'sub-collection'];
  const kv = new MemoryLevel<string, Uint8Array>({
    keyEncoding: 'utf8',
    valueEncoding: 'view',
  }) as unknown as BinStrLevel;
  const blockId = [...col, id];
  const createLocal = (sid: number = 12345678) => {
    const busName = 'test-' + id;
    const pubsub = createPubsub(busName) as LevelLocalRepoPubSub;
    const local = new LevelLocalRepo({
      kv,
      locks,
      sid,
      rpc: remote.remote,
      connected$: new BehaviorSubject(true),
      pubsub,
      onSyncError: (error) => console.error(error),
      ...opts.local,
    });
    const stop = async () => {
      await local.stop();
      pubsub.end();
    };
    return {kv, sid, local, pubsub, stop};
  };
  const {sid, local, pubsub, stop} = createLocal();
  const createRemote = (localOpts: Partial<LevelLocalRepoOpts> = {}) => {
    const sid = localOpts.sid ?? 123456789;
    const busName = 'test-' + id;
    const pubsub = createPubsub(busName) as LevelLocalRepoPubSub;
    const kv = new MemoryLevel<string, Uint8Array>({
      keyEncoding: 'utf8',
      valueEncoding: 'view',
    }) as unknown as BinStrLevel;
    const locks = new Locks();
    const local = new LevelLocalRepo({
      kv,
      locks,
      sid,
      rpc: remote.remote,
      connected$: new BehaviorSubject(true),
      pubsub,
      onSyncError: (error) => console.error(error),
      ...opts.local,
    });
    const stop = async () => {
      await local.stop();
      pubsub.end();
    };
    return {kv, sid, local, pubsub, stop};
  };
  const log = Log.fromNewModel(Model.create(undefined, sid));
  const getModelFromRemote = async (id: string = blockId.join('/')): Promise<Model> => {
    const res = await remote.client.call('block.get', {id});
    const model = Model.fromBinary(res.block.snapshot.blob);
    for (const batch of res.block.tip)
      for (const patch of batch.patches) model.applyPatch(Patch.fromBinary(patch.blob));
    return model;
  };
  log.end.api.root({foo: 'bar'});
  log.end.api.flush();
  return {
    remote,
    locks,
    createLocal,
    createRemote,
    pubsub,
    local,
    sid,
    log,
    genId,
    id,
    col,
    blockId,
    getModelFromRemote,
    stop,
  };
};
