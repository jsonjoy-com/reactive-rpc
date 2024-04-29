import type {Log} from 'json-joy/lib/json-crdt/log/Log';
import type {Model} from 'json-joy/lib/json-crdt/model';

export interface EditingSessionHistory {
  load(id: string): Promise<Model>;
  loadHistory(id: string): Promise<Log>;
  undo(id: string): Promise<void>;
  redo(id: string): Promise<void>;
}
