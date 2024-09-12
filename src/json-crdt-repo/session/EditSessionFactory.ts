import {Model, NodeBuilder} from 'json-joy/lib/json-crdt';
import {BlockId, LocalRepo} from '../local/types';
import {EditSession} from './EditSession';

export interface EditSessionFactoryOpts {
  readonly sid: number;
  readonly repo: LocalRepo;
}

export class EditSessionFactory {
  constructor(protected readonly opts: EditSessionFactoryOpts) {}

  /**
   * Creates a new editing session synchronously (immediately). If the block
   * with a given ID already exists, it asynchronously synchronizes the local
   * and remote state.
   */
  public make({id, schema, pull = true}: EditSessionMakeOpts): EditSession {
    const opts = this.opts;
    const model = Model.create(void 0, opts.sid);
    const session = new EditSession(opts.repo, id, model);
    if (schema) {
      const api = session.model.api;
      api.root(schema);
      api.flush();
    }
    if (pull) session.sync().catch(() => {});
    return session;
  }

  /**
   * Load block from the local repo. Creates a new editing session
   * asynchronously from an existing local block.
   * 
   * It is also possible to block on remote state check in case the block does
   * not exist locally, or to pull the latest state from the remote.
   */
  public async load(opts: EditSessionLoadOpts): Promise<EditSession> {
    const id = opts.id;
    const repo = this.opts.repo;
    try {
      const {model} = await repo.get({id});
      // TODO: need to set `cursor` here.
      const session = new EditSession(repo, id, model);
      return session;
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        if (opts.remote) {
          const {model, cursor} = await repo.pull(id);
          const session = new EditSession(repo, id, model, cursor);
          return session;
        } else if (opts.make) return this.make({...opts.make, id});
      }
      throw error;
    }
  }
}

/**
 * Constructs a new editing session synchronously.
 */
export interface EditSessionMakeOpts {
  /** Block ID. */
  id: BlockId;

  /** Thew new block schema, if any. */
  schema?: NodeBuilder;

  /**
   * Weather to asynchronously pull for any existing local block state, if a
   * block with the same ID already exists. Defaults to `true`.
   */
  pull?: boolean;
}

/**
 * Constructs and editing session asynchronously from an existing block. In
 * case the block does not exist, it is possible to create one or throw an
 * error.
 */
export interface EditSessionLoadOpts {
  /** Block ID. */
  id: BlockId;

  /**
   * If specified, will create a new block, if one does not already exist. Will
   * use these `make` options and provide them to the `make()` call.
   */
  make?: Omit<EditSessionMakeOpts, 'id'>;

  /** Thew new block schema, if any. */
  schema?: NodeBuilder;

  local?: {
    throwIf?: '' | 'missing' | 'exists';
  };

  remote?: {
    throwIf?: '' | 'missing' | 'exists';
    timeout?: number;
    throwOnTimeout?: boolean;
  };
}
