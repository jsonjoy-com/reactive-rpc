import {CallerToMethods, TypedRpcClient} from '../../common';
import type {Observable} from 'rxjs';
import type {JsonJoyDemoRpcCaller} from '../../__demos__/json-crdt-server';
import type {ServerBlock, ServerSnapshot, ServerPatch, ServerCursor, ServerHistory, ServerBatch, ServerEvent} from './types';

type Methods = CallerToMethods<JsonJoyDemoRpcCaller>;
type DemoServerClient = TypedRpcClient<Methods>;

export type Cursor = ServerCursor;
export type DemoServerBlock = ServerBlock;
export type DemoServerSnapshot = ServerSnapshot;
export type DemoServerBatch = ServerBatch;
export type DemoServerPatch = ServerPatch;
export type DemoServerEvent = ServerEvent;

export class DemoServerRemoteHistory implements ServerHistory {
  constructor(protected readonly client: TypedRpcClient<Methods>) {}

  public async read(id: string): Promise<{block: DemoServerBlock}> {
    return await this.client.call('block.get', {id});
  }

  public async create(
    id: string,
    batch?: Pick<DemoServerBatch, 'patches'>,
  ): Promise<{
    snapshot: Omit<DemoServerSnapshot, 'blob'>;
    batch: Omit<DemoServerBatch, 'patches'>;
  }> {
    const res = await this.client.call('block.new', batch ? {id, batch} : {id});
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

  public async update(id: string, batch: Pick<DemoServerBatch, 'patches'>): Promise<{batch: Omit<DemoServerBatch, 'patches'>}> {
    const res = await this.client.call('block.upd', {
      create: true,
      id,
      batch,
    });
    return {
      batch: res.batch,
    };
  }

  public async delete(id: string): Promise<void> {
    await this.client.call('block.del', {id});
  }

  public async scanFwd(id: string, seq: Cursor): Promise<{batches: DemoServerBatch[]}> {
    const limit = 100;
    const res = await this.client.call('block.scan', {
      id,
      seq: seq + 1,
      limit,
    });
    return res;
  }

  public async scanBwd(id: string, seq: Cursor, snapshot?: boolean): Promise<{batches: DemoServerBatch[]; snapshot?: DemoServerSnapshot}> {
    if (seq <= 0) throw new Error('INV_SEQ');
    const startSeq = Math.max(0, seq - 100);
    const limit = seq - startSeq;
    const res = await this.client.call('block.scan', {
      id,
      seq: startSeq,
      limit,
      snapshot: !!snapshot,
    });
    return res;
  }

  public listen(id: string): Observable<{event: DemoServerEvent}> {
    return this.client.call$('block.listen', {id});
  }
}
