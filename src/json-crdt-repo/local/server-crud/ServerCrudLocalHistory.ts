import {ServerCrudLocalHistoryCore, ServerCrudLocalHistoryCoreOpts} from './ServerCrudLocalHistoryCore';
import {genId} from './util';
import type {Patch} from 'json-joy/lib/json-crdt-patch';
import type {Log} from 'json-joy/lib/json-crdt/log/Log';
import type {LocalHistory} from '../types';

export class ServerCrudLocalHistory implements LocalHistory {
  protected readonly core: ServerCrudLocalHistoryCore;

  constructor(opts: ServerCrudLocalHistoryCoreOpts) {
    this.core = new ServerCrudLocalHistoryCore(opts);
  }

  public async create(collection: string[], log: Log, id: string = genId()): Promise<{id: string, remote: Promise<void>}> {
    if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
    const deps = this.core;
    const crud = deps.crud;
    const blob = this.encode(log);
    const crudCollection = this.core.crudCollection(collection, id);
    await this.lockForWrite({collection, id}, async () => {
      await crud.put(crudCollection, DATA_FILE_NAME, blob, {throwIf: 'exists'});
    });
    const remote = (async () => {
      await this.markDirty(collection, id);
      await this.sync(collection, id);
    })();
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
    const deps = this.core;
    await this.lockBlock({collection, id}, async () => {
      const crudCollection = this.crudCollection(collection, id);
      const blob = await deps.crud.get(crudCollection, DATA_FILE_NAME);
      const decoded = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
      const log = decoded.history!;
      log.end.applyBatch(patches);
      const blob2 = this.encode(log);
      await deps.crud.put(crudCollection, DATA_FILE_NAME, blob2, {throwIf: 'missing'});
    });
  }

  public async delete(collection: string[], id: string): Promise<void> {
    const deps = this.core;
    await this.lockBlock({collection, id}, async () => {
      await deps.crud.drop(collection, true);
    });
  }

  public async read(collection: string[], id: string): Promise<{log: Log; cursor: string}> {
    const blob = await this.__read(collection, id);
    const {frontier} = this.core.decoder.decode(blob, {format: 'seq.cbor', frontier: true});
    return {
      log: frontier!,
      cursor: '1',
    };
  }

  public async readHistory(collection: string[], id: string, cursor: string): Promise<{log: Log; cursor: string}> {
    const deps = this.core;
    const crudCollection = this.crudCollection(collection, id);
    const blob = await deps.crud.get(crudCollection, DATA_FILE_NAME);
    const {history} = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
    return {
      log: history!,
      cursor: '',
    };
  }

  // protected async scanDirty(): Promise<string[]> {
  //   const list = await this.deps.crud.list(['dirty']);
    
  // }

  /** @deprecated */
  protected async lockBlock(params: {
    reason?: 'write' | 'sync',
    collection: string[];
    id: string;
    lockDuration?: number;
    acquireTimeout?: number;
  }, fn: () => Promise<void>): Promise<void> {
    const deps = this.core;
    // const key = JSON.stringify([params.reason, params.collection, params.id]);
    const key = [params.reason, params.collection, params.id].join('/');
    await deps.locks.lock(
      key,
      params.lockDuration ?? 250,
      params.acquireTimeout ?? 500,
    )(async () => {
      await fn();
    });
  }

  protected async lockForWrite({collection, id}: {
    collection: string[];
    id: string;
  }, fn: () => Promise<void>): Promise<void> {
    const key = ['write', collection, id].join('/');
    await this.core.locks.lock(key, 300, 300)(fn);
  }
}
