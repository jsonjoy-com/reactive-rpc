import {CallerToMethods, TypedRpcClient} from '../../common';
import type {Observable} from 'rxjs';
import type {JsonJoyDemoRpcCaller} from '../../__demos__/json-crdt-server';
import type {RemoteHistory, RemoteBlock, RemoteSnapshot, RemotePatch} from './types';

type Methods = CallerToMethods<JsonJoyDemoRpcCaller>;
type DemoServerClient = TypedRpcClient<Methods>;

export type Cursor = number;

export interface DemoServerBlock extends RemoteBlock<Cursor> {}
export interface DemoServerSnapshot extends RemoteSnapshot<Cursor> {}
export interface DemoServerPatch extends RemotePatch {}

export class DemoServerRemoteHistory
  implements RemoteHistory<Cursor, DemoServerBlock, DemoServerSnapshot, DemoServerPatch>
{
  constructor(protected readonly client: TypedRpcClient<Methods>) {}

  public async read(id: string): Promise<{block: DemoServerBlock}> {
    const res = await this.client.call('block.get', {id});
    return {
      block: {
        id: res.block.snapshot.id,
        snapshot: res.block.snapshot,
        tip: [],
      },
    };
  }

  public async scanFwd(id: string, cursor: Cursor): Promise<{patches: DemoServerPatch[]}> {
    throw new Error('Method not implemented.');
    // const limit = 100;
    // const res = await this.client.call('block.scan', {
    //   id,
    //   cur: cursor + 1,
    //   limit,
    // });
    // return res;
  }

  public async scanBwd(
    id: string,
    cursor: Cursor,
  ): Promise<{snapshot?: DemoServerSnapshot; patches: DemoServerPatch[]}> {
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
    patches: Pick<DemoServerPatch, 'blob'>[],
  ): Promise<{
    block: Omit<DemoServerBlock, 'data' | 'tip' | 'snapshot'>;
    snapshot: Omit<DemoServerSnapshot, 'blob'>;
    patches: Omit<DemoServerPatch, 'blob'>[];
  }> {
    throw new Error('Method not implemented.');
    // const res = await this.client.call('block.new', {
    //   id,
    //   patches: patches.map((patch) => ({
    //     blob: patch.blob,
    //   })),
    // });
    // return res;
  }

  public async update(
    id: string,
    patches: Pick<DemoServerPatch, 'blob'>[],
  ): Promise<{patches: Omit<DemoServerPatch, 'blob'>[]}> {
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

  public listen(id: string, cursor: Cursor): Observable<{patches: DemoServerPatch[]}> {
    throw new Error('Method not implemented.');
  }
}
