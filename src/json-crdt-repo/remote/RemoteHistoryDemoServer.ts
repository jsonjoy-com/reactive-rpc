import {CallerToMethods, TypedRpcClient} from '../../common';
import type {JsonJoyDemoRpcCaller} from '../../__demos__/json-crdt-server';
import type {RemoteHistory, RemoteSnapshot, RemotePatch} from './types';

type Methods = CallerToMethods<JsonJoyDemoRpcCaller>;

export type Cursor = number;

export interface DemoServerSnapshot extends RemoteSnapshot {
  seq: number;
  created: number;
}

export interface DemoServerPatch extends RemotePatch {
  seq: number;
}

export class RemoteHistoryDemoServer implements RemoteHistory<Cursor, DemoServerSnapshot, DemoServerPatch> {
  constructor(protected readonly client: TypedRpcClient<Methods>) {}

  public async create(id: string, patches: RemotePatch[]): Promise<void> {
    await this.client.call('block.new', {
      id,
      patches: patches.map((patch) => ({
        blob: patch.blob,
      })),
    });
  }

  /**
   * Load latest state of the model, and any unmerged "tip" of patches
   * it might have.
   */
  public async read(id: string): Promise<{cursor: Cursor; model: DemoServerSnapshot; patches: DemoServerPatch[]}> {
    const {model, patches} = await this.client.call('block.get', {id});
    return {
      cursor: model.seq,
      model,
      patches: [],
    };
  }

  public async scanFwd(id: string, cursor: Cursor): Promise<{cursor: Cursor; patches: DemoServerPatch[]}> {
    const limit = 100;
    const res = await this.client.call('block.scan', {
      id,
      seq: cursor,
      limit: cursor + limit,
    });
    if (res.patches.length === 0) {
      return {
        cursor,
        patches: [],
      };
    }
    return {
      cursor: res.patches[res.patches.length - 1].seq,
      patches: res.patches,
    };
  }

  public async scanBwd(
    id: string,
    cursor: Cursor,
  ): Promise<{cursor: Cursor; model: DemoServerSnapshot; patches: DemoServerPatch[]}> {
    throw new Error('The "blocks.history" should be able to return starting model.');
    const res = await this.client.call('block.scan', {
      id,
      seq: cursor,
      limit: -100,
      model: true,
    });
  }

  public async update(
    id: string,
    cursor: Cursor,
    patches: RemotePatch[],
  ): Promise<{cursor: Cursor; patches: DemoServerPatch[]}> {
    const res = await this.client.call('block.upd', {
      id,
      patches: patches.map((patch, seq) => ({
        seq,
        created: Date.now(),
        blob: patch.blob,
      })),
    });
    return {
      cursor: res.patches.length ? res.patches[res.patches.length - 1].seq : cursor,
      patches: res.patches,
    };
  }

  public async delete(id: string): Promise<void> {
    await this.client.call('block.del', {id});
  }

  /**
   * Subscribe to the latest changes to the model.
   * @param callback
   */
  public listen(id: string, cursor: Cursor, callback: (changes: DemoServerPatch[]) => void): void {
    throw new Error('Method not implemented.');
  }
}
