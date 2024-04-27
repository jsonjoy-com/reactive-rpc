import {CborEncoder} from '@jsonjoy.com/json-pack/lib/cbor/CborEncoder';
import {CborDecoder} from '@jsonjoy.com/json-pack/lib/cbor/CborDecoder';
import {LogEncoder} from 'json-joy/lib/json-crdt/log/codec/LogEncoder';
import {LogDecoder} from 'json-joy/lib/json-crdt/log/codec/LogDecoder';
import {BehaviorSubject} from 'rxjs';
import type {CrudApi} from 'memfs/lib/crud/types';
import type {Locks} from 'thingies/es2020/Locks';
import type {RemoteHistory} from '../../remote/types';

export interface ServerCrudLocalHistoryDependenciesOpts {
  readonly remote: RemoteHistory;
  readonly crud: CrudApi;
  readonly locks: Locks;
  readonly sid: number;
  readonly connected$?: BehaviorSubject<boolean>;
}

export class ServerCrudLocalHistoryDependencies implements ServerCrudLocalHistoryDependenciesOpts {
  public readonly remote: RemoteHistory;
  public readonly crud: CrudApi;
  public readonly locks: Locks;
  public readonly sid: number;
  public readonly cborEncoder = new CborEncoder();
  public readonly cborDecoder = new CborDecoder();
  public readonly encoder: LogEncoder = new LogEncoder({cborEncoder: this.cborEncoder});
  public readonly decoder: LogDecoder = new LogDecoder({cborDecoder: this.cborDecoder});
  public readonly connected$: BehaviorSubject<boolean>;

  constructor(opts: ServerCrudLocalHistoryDependenciesOpts) {
    this.remote = opts.remote;
    this.crud = opts.crud;
    this.locks = opts.locks;
    this.sid = opts.sid;
    this.connected$ = opts.connected$ ?? new BehaviorSubject(true);
  }
}
