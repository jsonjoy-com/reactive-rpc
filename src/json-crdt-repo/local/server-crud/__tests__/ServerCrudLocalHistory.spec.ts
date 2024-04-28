import {ServerCrudLocalHistory} from '../ServerCrudLocalHistory';
import {memfs} from 'memfs';
import {NodeCrud} from 'memfs/lib/node-to-crud';
import {toTreeSync} from 'memfs/lib/print';
import {Locks} from 'thingies/es2020/Locks';
import {Model} from 'json-joy/lib/json-crdt';
import {Log} from 'json-joy/lib/json-crdt/log/Log';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../../../remote/__tests__/setup';
import type {ServerCrudLocalHistoryCoreOpts} from '../ServerCrudLocalHistoryCore';

const setup = async (opts: {
  local?: Partial<ServerCrudLocalHistoryCoreOpts>;
} = {}) => {
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
    ...opts.local,
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
  test('throws on empty log', async () => {
    const kit = await setup();
    const model = Model.withLogicalClock(kit.sid);
    const emptyLog = Log.fromNewModel(model);
    try {
      await kit.local.create(['collection'], emptyLog, kit.id);
      throw 'not this error';
    } catch (err) {
      expect(err).toEqual(new Error('EMPTY_LOG'));
    }
  });

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

  test('marks item as "tidy" for sync', async () => {
    const kit = await setup();
    const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
    await res.remote;
    const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
    expect(meta).toMatchObject({
      time: 1,
      ts: expect.any(Number),
    });
    const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
    expect(isDirty).toBe(false);
  });

  describe('when not connected', () => {
    const setupNotConnected = () => setup({
      local: {
        connected$: new BehaviorSubject(false),
      }
    });

    test('throws on empty log', async () => {
      const kit = await setupNotConnected();
      const model = Model.withLogicalClock(kit.sid);
      const emptyLog = Log.fromNewModel(model);
      try {
        await kit.local.create(['collection'], emptyLog, kit.id);
        throw 'not this error';
      } catch (err) {
        expect(err).toEqual(new Error('EMPTY_LOG'));
      }
    });
  
    test('can create a new block', async () => {
      const kit = await setupNotConnected();
      const res = await kit.local.create(['collection'], kit.log, kit.id);
      expect(res).toMatchObject({
        id: kit.id,
        remote: expect.any(Promise)
      });
    });
  
    test('does not store the block on remote, throws on remote sync', async () => {
      const kit = await setupNotConnected();
      const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
      expect(kit.remote.services.blocks.stats().blocks).toBe(0);
      try {
        await res.remote;
        throw 'not this error';
      } catch (error) {
        expect(error).toEqual(new Error('NOT_SYNCED'));
      }
      expect(kit.remote.services.blocks.stats().blocks).toBe(0);
    });
  
    test('marks item as "dirty" for sync', async () => {
      const kit = await setupNotConnected();
      const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
      try {
        await res.remote;
      } catch {}
      const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
      expect(meta).toMatchObject({
        time: -1,
        ts: 0,
      });
      const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
      expect(isDirty).toBe(true);
    });
  });
});