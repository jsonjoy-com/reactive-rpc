import {listToUint8} from '@jsonjoy.com/util/lib/buffers/concat';
import type {Patch} from 'json-joy/lib/json-crdt';

export const patchListBlob = (patches: Patch[]): Uint8Array => {
  const list: Uint8Array[] = [];
  const length = patches.length;
  for (let i = 0; i < length; i++) {
    const patch = patches[i];
    list.push(patch.toBinary());
  }
  return listToUint8(list);
};
