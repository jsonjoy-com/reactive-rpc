import type {Patch} from 'json-joy/lib/json-crdt';

/**
 * Returns the first logical time of the first operation in a patch list.
 */
export const patchListStart = (patches: Patch[]): number => {
  if (!patches.length) throw new Error('EMPTY');
  const first = patches[0];
  const firstId = first.getId();
  if (!firstId) throw new Error('EMPTY_PATCH');
  const min = firstId.time;
  return min;
};

/**
 * Returns the time of the first operation in patch list and the time
 * of the next available logical time tick. Returns -1 if the list is empty.
 */
export const patchListSpan = (patches: Patch[]): [min: number, max: number] => {
  const min = patchListStart(patches);
  const last = patches[patches.length - 1];
  const lastId = last.getId();
  if (!lastId) throw new Error('EMPTY_PATCH');
  return [min, lastId.time + last.span()];
};
