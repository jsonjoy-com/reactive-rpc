import {LevelLocalRepo, LevelLocalRepoOpts} from '../local/level/LevelLocalRepo';
import {Locks} from 'thingies/lib/Locks';
import {BehaviorSubject} from 'rxjs';
import {setup as remoteSetup} from '../remote/__tests__/setup';
import {MemoryLevel} from 'memory-level';
import {pubsub as createPubsub} from '../pubsub';
import {BinStrLevel, LevelLocalRepoPubSub} from '../local/level/types';
import {EditSessionFactory} from '../session/EditSessionFactory';

/* tslint:disable:no-console */

export class Testbed {
  public static readonly create = () => {
    return new Testbed();
  };

  public static readonly createRepo = (opts?: Partial<LevelLocalRepoOpts>) => {
    return Testbed.create().createBrowser().createTab().createRepo(opts);
  };

  constructor(
    public readonly remote: ReturnType<typeof remoteSetup> = remoteSetup(),
    public genId: () => string = () => Date.now().toString(36) + Math.random().toString(36).slice(2),
  ) {}

  public createBrowser(): BrowserTestbed {
    return new BrowserTestbed(this);
  }
}

export class BrowserTestbed {
  public readonly id: string;
  public readonly locks: Locks;
  public readonly kv: BinStrLevel;

  constructor(
    public readonly global: Testbed,
    public readonly sid: number = 12345678,
  ) {
    this.id = this.global.genId();
    // TODO: Namespace locks to a specific repo.
    this.locks = new Locks();
    this.kv = new MemoryLevel<string, Uint8Array>({
      keyEncoding: 'utf8',
      valueEncoding: 'view',
    }) as unknown as BinStrLevel;
  }

  public createTab(): BrowserTabTestbed {
    return new BrowserTabTestbed(this);
  }
}

export class BrowserTabTestbed {
  public readonly pubsubBusName: string;
  public readonly pubsub: LevelLocalRepoPubSub;

  constructor(public readonly browser: BrowserTestbed) {
    this.pubsubBusName = 'pubsub-bus-' + this.browser.id;
    this.pubsub = createPubsub(this.pubsubBusName) as LevelLocalRepoPubSub;
  }

  public createRepo(opts?: Partial<LevelLocalRepoOpts>): LocalRepoTestbed {
    const repo = new LevelLocalRepo({
      kv: this.browser.kv,
      locks: this.browser.locks,
      sid: this.browser.sid,
      rpc: this.browser.global.remote.remote,
      pubsub: this.pubsub,
      connected$: new BehaviorSubject(true),
      onSyncError: (error) => console.error(error),
      ...opts,
    });
    return new LocalRepoTestbed(this, repo);
  }

  public readonly stop = async () => {
    this.pubsub.end();
  };
}

export class LocalRepoTestbed {
  public readonly sessions: EditSessionFactory;
  public readonly col: string[] = ['collection', 'sub-collection'];
  public readonly blockId: string[] = [...this.col, this.tab.browser.id];

  constructor(
    public readonly tab: BrowserTabTestbed,
    public readonly repo: LevelLocalRepo,
  ) {
    this.sessions = new EditSessionFactory({
      sid: tab.browser.sid,
      repo,
    });
  }

  public readonly stop = async () => {
    await this.repo.stop();
  };

  public readonly stopTab = async () => {
    await this.stop();
    await this.tab.stop();
  };
}
