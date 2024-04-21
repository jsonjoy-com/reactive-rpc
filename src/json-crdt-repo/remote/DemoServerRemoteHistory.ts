import type {Observable} from "rxjs";
import {CallerToMethods, TypedRpcClient} from '../../common';
import type {JsonJoyDemoRpcCaller} from '../../__demos__/json-crdt-server';
import type {RemoteHistory, RemoteSnapshot, RemotePatch, RemoteBlock} from './types';

type Methods = CallerToMethods<JsonJoyDemoRpcCaller>;

export type Cursor = number;

export interface DemoServerBlock extends RemoteBlock<Cursor> {}
export interface DemoServerSnapshot extends RemoteSnapshot<Cursor> {}
export interface DemoServerPatch extends RemotePatch<Cursor> {}

export class DemoServerRemoteHistory implements RemoteHistory<Cursor, DemoServerBlock, DemoServerSnapshot, DemoServerPatch> {
  constructor(protected readonly client: TypedRpcClient<Methods>) {}

  public async read(id: string): Promise<{block: DemoServerBlock}> {
    throw new Error('Method not implemented.');
    const res = await this.client.call('block.get', {id});
    
    // return {
    //   cursor: model.seq,
    //   model,
    //   patches: [],
    // };
  }

  public async scanFwd(id: string, cursor: Cursor): Promise<{patches: DemoServerPatch[]}> {
    throw new Error('Method not implemented.');
    // const limit = 100;
    // const res = await this.client.call('block.scan', {
    //   id,
    //   seq: cursor,
    //   limit: cursor + limit,
    // });
    // if (res.patches.length === 0) {
    //   return {
    //     cursor,
    //     patches: [],
    //   };
    // }
    // return {
    //   cursor: res.patches[res.patches.length - 1].seq,
    //   patches: res.patches,
    // };
  }

  public async scanBwd(
    id: string,
    cursor: Cursor,
  ): Promise<{snapshot: DemoServerSnapshot; patches: DemoServerPatch[]}> {
    throw new Error('Method not implemented.');
    // const res = await this.client.call('block.scan', {
    //   id,
    //   seq: cursor,
    //   limit: -100,
    //   model: true,
    // });
  }

  public async create(id: string, patches: Pick<DemoServerPatch, 'blob'>[]): Promise<{
    block: Omit<DemoServerBlock, 'data' | 'tip'>,
    snapshot: Omit<DemoServerSnapshot, 'blob'>,
    patches: Omit<DemoServerPatch, 'blob'>[],
  }> {
    throw new Error('Method not implemented.');
    // await this.client.call('block.new', {
    //   id,
    //   patches: patches.map((patch) => ({
    //     blob: patch.blob,
    //   })),
    // });
  }

  public async update(
    id: string,
    cursor: Cursor,
    patches: Pick<DemoServerPatch, 'blob'>[],
  ): Promise<{patches: Omit<DemoServerPatch, 'blob'>[]}> {
    throw new Error('Method not implemented.');
    // const res = await this.client.call('block.upd', {
    //   id,
    //   patches: patches.map((patch, seq) => ({
    //     seq,
    //     created: Date.now(),
    //     blob: patch.blob,
    //   })),
    // });
    // return {
    //   cursor: res.patches.length ? res.patches[res.patches.length - 1].seq : cursor,
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
