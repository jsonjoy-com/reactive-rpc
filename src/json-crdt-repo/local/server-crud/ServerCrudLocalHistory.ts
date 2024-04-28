import {ServerCrudLocalHistoryCore, ServerCrudLocalHistoryCoreOpts} from './ServerCrudLocalHistoryCore';
import {ServerCrudLocalHistorySync} from './ServerCrudLocalHistorySync';
import {genId} from './util';
import type {Patch} from 'json-joy/lib/json-crdt-patch';
import type {Log} from 'json-joy/lib/json-crdt/log/Log';
import type {LocalHistory} from '../types';

export class ServerCrudLocalHistory implements LocalHistory {
  protected readonly core: ServerCrudLocalHistoryCore;
  public readonly sync: ServerCrudLocalHistorySync;

  constructor(opts: ServerCrudLocalHistoryCoreOpts) {
    this.core = new ServerCrudLocalHistoryCore(opts);
    this.sync = new ServerCrudLocalHistorySync(this.core);
  }

  public async create(collection: string[], log: Log, id: string = genId()): Promise<{id: string, remote: Promise<void>}> {
    if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
    const blob = this.encode(log);
    await this.lockForWrite({collection, id}, async () => {
      await this.core.create(collection, id, blob);
    });
    const remote = (async () => {
      await this.sync.markDirty(collection, id);
      // TODO: use pushNewBlock instead?
      const success = await this.sync.push(collection, id);
      if (!success) throw new Error('NOT_SYNCED');
    })();
    remote.catch(() => {});
    return {
      id,
      remote,
    };
  }

  protected encode(log: Log): Uint8Array {
    // TODO: Add browser-native compression. Wrap the blob into `[]` TLV tuple.
    // TODO: Encrypt with user's public key.
    return this.core.encoder.encode(log, {
      format: 'seq.cbor',
      model: 'binary',
      history: 'binary',
      noView: true,
    });
  }

  public async update(collection: string[], id: string, patches: Patch[]): Promise<void> {
    throw new Error('Method not implemented.');
    // const deps = this.core;
    // await this.lockBlock({collection, id}, async () => {
    //   const crudCollection = this.crudCollection(collection, id);
    //   const blob = await deps.crud.get(crudCollection, DATA_FILE_NAME);
    //   const decoded = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
    //   const log = decoded.history!;
    //   log.end.applyBatch(patches);
    //   const blob2 = this.encode(log);
    //   await deps.crud.put(crudCollection, DATA_FILE_NAME, blob2, {throwIf: 'missing'});
    // });
  }

  public async delete(collection: string[], id: string): Promise<void> {
    throw new Error('Method not implemented.');
    // const deps = this.core;
    // await this.lockBlock({collection, id}, async () => {
    //   await deps.crud.drop(collection, true);
    // });
  }

  public async read(collection: string[], id: string): Promise<{log: Log; cursor: string}> {
    throw new Error('Method not implemented.');
    // const blob = await this.core.read(collection, id);
    // const {frontier} = this.core.decoder.decode(blob, {format: 'seq.cbor', frontier: true});
    // return {
    //   log: frontier!,
    //   cursor: '1',
    // };
  }

  public async readHistory(collection: string[], id: string, cursor: string): Promise<{log: Log; cursor: string}> {
    throw new Error('Method not implemented.');
    // const core = this.core;
    // const blob = await core.read(collection, id);
    // const {history} = core.decoder.decode(blob, {format: 'seq.cbor', history: true});
    // return {
    //   log: history!,
    //   cursor: '',
    // };
  }

  protected async lockForWrite({collection, id}: {
    collection: string[];
    id: string;
  }, fn: () => Promise<void>): Promise<void> {
    const key = ['write', collection, id].join('/');
    await this.core.locks.lock(key, 300, 300)(fn);
  }
}
