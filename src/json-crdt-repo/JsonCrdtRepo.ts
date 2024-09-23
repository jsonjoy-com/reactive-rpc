import {BrowserLevel} from 'browser-level';
import {createBinaryWsRpcClient} from '../browser/createBinaryWsRpcClient';
import {DemoServerClient, DemoServerRemoteHistory} from './remote/DemoServerRemoteHistory';
import {EditSessionFactory} from './session/EditSessionFactory';
import {BinStrLevel, LevelLocalRepoPubSubMessage} from './local/level/types';
import {PubSubBC} from './pubsub';
import {Locks} from 'thingies/lib/Locks';
import {BehaviorSubject} from 'rxjs';
import {LevelLocalRepo} from './local/level/LevelLocalRepo';
import {Model} from 'json-joy/lib/json-crdt';
import type {EditSession} from './session/EditSession';

export interface JsonCrdtRepoOpts {
  name: string;
  wsUrl: string;
}

export class JsonCrdtRepo {
  public readonly sessions: EditSessionFactory;
  public readonly opts: JsonCrdtRepoOpts;

  constructor(opts: Partial<JsonCrdtRepoOpts>) {
    this.opts = {
      name: opts.name ?? 'json-crdt-repo',
      wsUrl: opts.wsUrl ?? 'ws://localhost:9999/rpc',
      ...opts,
    };
    const client = createBinaryWsRpcClient(this.opts.wsUrl) as DemoServerClient;
    const remote = new DemoServerRemoteHistory(client);
    const kv: BinStrLevel = new BrowserLevel(this.opts.name, {
      keyEncoding: 'utf8',
      valueEncoding: 'view',
    }) as any;
    const pubsub = new PubSubBC<LevelLocalRepoPubSubMessage>(this.opts.name);
    const locks = new Locks();
    const sid: number = this.readSid();
    const connected$ = new BehaviorSubject(true);
    const repo = new LevelLocalRepo({
      kv,
      locks,
      sid,
      rpc: remote,
      pubsub,
      connected$,
    });
    this.sessions = new EditSessionFactory({
      repo,
      sid,
    });
  }

  public readSid(): number {
    const ls = window.localStorage;
    const key = this.opts.name + '-sid';
    const value = ls.getItem(key);
    if (value) return +value;
    const sid: number = Model.sid();
    ls.setItem(key, sid + '');
    return sid;
  }

  public genId(): string {
    return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  public make(id: string = this.genId()): EditSession {
    const {session} = this.sessions.make({
      id: [id],
    });
    return session;
  }
}
