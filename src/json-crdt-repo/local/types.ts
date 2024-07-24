import type {Patch} from 'json-joy/lib/json-crdt-patch';
import type {Log} from 'json-joy/lib/json-crdt/log/Log';

/** @todo Rename "History" to "Storage"? */
export interface LocalHistory {
  create(collection: string[], log: Log, id?: string): Promise<{id: string; remote: Promise<void>}>;
  update(collection: string[], id: string, patches: Patch[]): Promise<{remote: Promise<void>}>;
  read(collection: string[], id: string): Promise<{log: Log; cursor: string}>;
  readHistory(collection: string[], id: string, cursor: string): Promise<{log: Log; cursor: string}>;
  delete(collection: string[], id: string): Promise<void>;
}
