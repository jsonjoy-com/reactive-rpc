import {CallerToMethods, TypedRpcClient} from '../../common';
import type {Observable} from 'rxjs';
import type {JsonJoyDemoRpcCaller} from '../../__demos__/json-crdt-server';
import type {RemoteHistory, RemoteBlock, RemoteSnapshot, RemotePatch, ServerBlock, ServerSnapshot, ServerPatch, ServerCursor, ServerHistory, ServerBatch} from './types';

type Methods = CallerToMethods<JsonJoyDemoRpcCaller>;
type DemoServerClient = TypedRpcClient<Methods>;

export type Cursor = ServerCursor;
export type DemoServerBlock = ServerBlock;
export type DemoServerSnapshot = ServerSnapshot;
export type DemoServerBatch = ServerBatch;
export type DemoServerPatch = ServerPatch;

export class DemoServerRemoteHistory implements ServerHistory {
  constructor(protected readonly client: TypedRpcClient<Methods>) {}

  public async read(id: string): Promise<{block: DemoServerBlock}> {
    const res = await this.client.call('block.get', {id});
    throw new Error('Method not implemented.');
    // return res;
  }

  public async scanFwd(id: string, seq: Cursor): Promise<{batches: DemoServerBatch[]}> {
    throw new Error('Method not implemented.');
    // const limit = 100;
    // const res = await this.client.call('block.scan', {
    //   id,
    //   cur: cursor + 1,
    //   limit,
    // });
    // return res;
  }

  public async scanBwd(id: string, seq: Cursor): Promise<{batches: DemoServerBatch[]; snapshot?: DemoServerSnapshot}> {
    throw new Error('Method not implemented.');
    // if (cursor <= 0) {
    //   return {
    //     patches: [],
    //   };
    // }
    // const res = await this.client.call('block.scan', {
    //   id,
    //   cur: 0,
    //   limit: cursor,
    // });
    // return {
    //   patches: res.patches,
    // };
  }

  public async create(
    id: string,
    batch: Pick<DemoServerBatch, 'patches'>,
  ): Promise<{
    snapshot: Omit<DemoServerSnapshot, 'blob'>;
    batch: Omit<DemoServerBatch, 'patches'>;
  }> {
    const res = await this.client.call('block.new', {
      id,
      batch,
    });
    return {
      snapshot: {
        seq: res.snapshot.seq,
      },
      batch: {
        seq: res.snapshot.seq,
        ts: res.snapshot.ts,
      },
    };
  }

  public async update(id: string, batch: Pick<DemoServerBatch, 'patches'>): Promise<{batch: Omit<DemoServerBatch, 'patches'>[]}> {
    throw new Error('Method not implemented.');
    // const res = await this.client.call('block.upd', {
    //   create: true,
    //   id,
    //   patches: patches.map((patch) => ({
    //     blob: patch.blob,
    //   })),
    // });
    // return {
    //   patches: res.patches,
    // };
  }

  public async delete(id: string): Promise<void> {
    await this.client.call('block.del', {id});
  }

  public listen(id: string, cursor: Cursor): Observable<{batches: DemoServerBatch[]}> {
    throw new Error('Method not implemented.');
  }
}
