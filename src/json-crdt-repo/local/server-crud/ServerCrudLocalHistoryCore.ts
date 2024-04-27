import {CborEncoder} from '@jsonjoy.com/json-pack/lib/cbor/CborEncoder';
import {CborDecoder} from '@jsonjoy.com/json-pack/lib/cbor/CborDecoder';
import {LogEncoder} from 'json-joy/lib/json-crdt/log/codec/LogEncoder';
import {LogDecoder} from 'json-joy/lib/json-crdt/log/codec/LogDecoder';
import {BehaviorSubject} from 'rxjs';
import type {CrudApi} from 'memfs/lib/crud/types';
import type {Locks} from 'thingies/es2020/Locks';
import type {RemoteHistory} from '../../remote/types';

const DATA_FILE_NAME = 'data.seq.cbor';

export interface ServerCrudLocalHistoryCoreOpts {
  readonly remote: RemoteHistory;
  readonly crud: CrudApi;
  readonly locks: Locks;
  readonly sid: number;
  readonly connected$?: BehaviorSubject<boolean>;
}

export class ServerCrudLocalHistoryCore implements ServerCrudLocalHistoryCoreOpts {
  public readonly remote: RemoteHistory;
  public readonly crud: CrudApi;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly cborEncoder = new CborEncoder();
  public readonly cborDecoder = new CborDecoder();
  public readonly encoder: LogEncoder = new LogEncoder({cborEncoder: this.cborEncoder});
  public readonly decoder: LogDecoder = new LogDecoder({cborDecoder: this.cborDecoder});
  public readonly connected$: BehaviorSubject<boolean>;

  constructor(opts: ServerCrudLocalHistoryCoreOpts) {
    this.remote = opts.remote;
    this.crud = opts.crud;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
  }

  public crudCollection(collection: string[], id: string): string[] {
    return ['blocks', ...collection, id];
  }

  public async markDirty(collection: string[], id: string): Promise<void> {
    const dir = ['dirty', ...collection];
    await this.crud.put(dir, id, new Uint8Array(0));
  }

  public async markTidy(collection: string[], id: string): Promise<void> {
    const dir = ['dirty', ...collection];
    await this.crud.del(dir, id);
  }

  public async read(collection: string[], id: string): Promise<Uint8Array> {
    const crudCollection = this.crudCollection(collection, id);
    const blob = await this.crud.get(crudCollection, DATA_FILE_NAME);
    return blob;
  }
}
