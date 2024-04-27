import {ServerCrudLocalHistoryDependencies, ServerCrudLocalHistoryDependenciesOpts} from './ServerCrudLocalHistoryDependencies';
import {genId} from './util';
import type {Patch} from 'json-joy/lib/json-crdt-patch';
import type {Log} from 'json-joy/lib/json-crdt/log/Log';
import type {LocalHistory} from '../types';
import type {BlockMetadata} from './types';
import {RemoteBlockPatch} from '../../remote/types';

const LOG_FILE_NAME = 'log.seq.cbor';
const META_FILE_NAME = 'meta.cbor';

export class ServerCrudLocalHistory implements LocalHistory {
  protected readonly deps: ServerCrudLocalHistoryDependencies;

  constructor(opts: ServerCrudLocalHistoryDependenciesOpts) {
    this.deps = new ServerCrudLocalHistoryDependencies(opts);
  }

  public async create(collection: string[], log: Log, id: string = genId()): Promise<{id: string}> {
    if (log.end.clock.time <= 1) throw new Error('EMPTY_LOG');
    const deps = this.deps;
    const crud = deps.crud;
    const blob = this.encode(log);
    const crudCollection = this.crudCollection(collection, id);
    await this.lockBlock({collection, id}, async () => {
      await crud.put(crudCollection, LOG_FILE_NAME, blob, {throwIf: 'exists'});
      await this.putMeta(collection, id, {cur: -1});
      await this.markDirty(collection, id);
    });
    return {id};
  }

  protected async sync(collection: string[], id: string, log: Log): Promise<void> {
    const deps = this.deps;
    const crudCollection = this.crudCollection(collection, id);
    await this.lockBlock({reason: 'sync', collection, id}, async () => {
      const meta = await this.getMeta(collection, id);
      const isNewBlock = meta.cur < 1;
      if (isNewBlock) {
        const remoteId = [...collection, id].join('/');
        const blob = await deps.crud.get(crudCollection, LOG_FILE_NAME);
        const {history} = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
        const patches: RemoteBlockPatch[] = [];
        history!.patches.forEach(({v: patch}) => {
          if (patch.getId()?.sid === deps.sid) patches.push({blob: patch.toBinary()});
        });
        await this.deps.remote.create(remoteId, patches);
      }
    });
  }

  protected encode(log: Log): Uint8Array {
    // TODO: Add browser-native compression. Wrap the blob into `[]` TLV tuple.
    return this.deps.encoder.encode(log, {
      format: 'seq.cbor',
      model: 'binary',
      history: 'binary',
      noView: true,
    });
  }

  public async update(collection: string[], id: string, patches: Patch[]): Promise<void> {
    const deps = this.deps;
    await this.lockBlock({collection, id}, async () => {
      const crudCollection = this.crudCollection(collection, id);
      const blob = await deps.crud.get(crudCollection, LOG_FILE_NAME);
      const decoded = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
      const log = decoded.history!;
      log.end.applyBatch(patches);
      const blob2 = this.encode(log);
      await deps.crud.put(crudCollection, LOG_FILE_NAME, blob2, {throwIf: 'missing'});
    });
  }

  public async delete(collection: string[], id: string): Promise<void> {
    const deps = this.deps;
    await this.lockBlock({collection, id}, async () => {
      await deps.crud.drop(collection, true);
    });
  }

  protected async getMeta(collection: string[], id: string): Promise<BlockMetadata> {
    const deps = this.deps;
    const crudCollection = this.crudCollection(collection, id);
    const meta = await deps.crud.get(crudCollection, META_FILE_NAME);
    try {
      return deps.cborDecoder.decode(meta) as BlockMetadata;
    } catch (err) {
      return {
        cur: -1,
      } as BlockMetadata;
    }
  }

  public async read(collection: string[], id: string): Promise<{log: Log; cursor: string}> {
    const deps = this.deps;
    const crudCollection = this.crudCollection(collection, id);
    const blob = await deps.crud.get(crudCollection, LOG_FILE_NAME);
    const {frontier} = deps.decoder.decode(blob, {format: 'seq.cbor', frontier: true});
    return {
      log: frontier!,
      cursor: '1',
    };
  }

  public async readHistory(collection: string[], id: string, cursor: string): Promise<{log: Log; cursor: string}> {
    const deps = this.deps;
    const crudCollection = this.crudCollection(collection, id);
    const blob = await deps.crud.get(crudCollection, LOG_FILE_NAME);
    const {history} = deps.decoder.decode(blob, {format: 'seq.cbor', history: true});
    return {
      log: history!,
      cursor: '',
    };
  }

  protected async putMeta(collection: string[], id: string, meta: BlockMetadata): Promise<void> {
    const deps = this.deps;
    const blob = deps.cborEncoder.encode(meta);
    await deps.crud.put([...collection, id], META_FILE_NAME, blob);
  }

  protected crudCollection(collection: string[], id: string): string[] {
    return ['blocks', ...collection, id];
  }

  protected async markDirty(collection: string[], id: string): Promise<void> {
    const dir = ['dirty', ...collection];
    await this.deps.crud.put(dir, id, new Uint8Array(0));
  }

  protected async markTidy(collection: string[], id: string): Promise<void> {
    const dir = ['dirty', ...collection];
    await this.deps.crud.del(dir, id);
  }

  // protected async scanDirty(): Promise<string[]> {
  //   const list = await this.deps.crud.list(['dirty']);
    
  // }

  protected async lockBlock(params: {
    reason?: 'write' | 'sync',
    collection: string[];
    id: string;
    lockDuration?: number;
    acquireTimeout?: number;
  }, fn: () => Promise<void>): Promise<void> {
    const deps = this.deps;
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
}
