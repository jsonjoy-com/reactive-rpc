import {Model, NodeBuilder} from 'json-joy/lib/json-crdt';
import {BlockId, LocalRepo} from '../local/types';
import {EditSession} from './EditSession';

export interface EditSessionFactoryOpts {
  readonly sid: number;
  readonly repo: LocalRepo;
}

export class EditSessionFactory {
  constructor(protected readonly opts: EditSessionFactoryOpts) {}

  public make(id: BlockId, schema?: NodeBuilder): EditSession {
    const opts = this.opts;
    const model = Model.create(schema, opts.sid);
    const session = new EditSession(opts.repo, id, model);
    return session;
  }

  public async load(id: BlockId): Promise<EditSession> {
    const opts = this.opts;
    const {model} = await opts.repo.get(id);
    const session = new EditSession(opts.repo, id, model);
    return session;
  }
}
