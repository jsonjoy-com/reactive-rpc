import {t} from '../system';
import type {ResolveType} from 'json-joy/lib/json-type';

export const BlockId = t.str.options({
  title: 'Block ID',
  min: 6,
  max: 40,
});
export const BlockIdRef = t.Ref<typeof BlockId>('BlockId');

export const BlockCur = t.num.options({
  title: 'Block Sequence Number',
  gte: -1,
  format: 'i32',
});
export const BlockCurRef = t.Ref<typeof BlockCur>('BlockCur');

// ---------------------------------------------------------------------- Patch

// prettier-ignore
export const BlockPatchPartial = t.Object(
  t.prop('blob', t.bin).options({
    title: 'Patch Blob',
    description: 'The binary data of the patch. The format of the data is defined by the patch type.',
  }),
);
export const BlockPatchPartialRef = t.Ref<typeof BlockPatchPartial>('BlockPatchPartial');

// prettier-ignore
export const BlockPatchPartialReturn = t.Object(
  t.prop('ts', t.num.options({format: 'u'})).options({
    title: 'Patch Creation Time',
    description: 'The time when the patch was created, in milliseconds since the Unix epoch.' +
      '\n\n' + 
      'This time is set by the server when the patch received and stored on the server. If you ' +
      'want to also store the time when the patch was created by the user, you can include this ' +
      'information in the patch blob itself.',
  }),
);
export const BlockPatchPartialReturnRef = t.Ref<typeof BlockPatchPartialReturn>('BlockPatchPartialReturn');

export const BlockPatch = BlockPatchPartial.extend(BlockPatchPartialReturn);
export const BlockPatchRef = t.Ref<typeof BlockPatch>('BlockPatch');

// ------------------------------------------------------------------- Snapshot

export const BlockSnapshot = t.Object(
  t.prop('blob', t.bin)
    .options({
      title: 'Snapshot Blob',
      description: 'A serialized JSON CRDT model.',
    }),
  t.prop('cur', BlockCurRef)
    .options({
      title: 'Snapshot Cursor',
      description: 'The cursor of the snapshot, representing the position in the history.',
    }),
  t.prop('ts', t.num.options({format: 'u'}))
    .options({
      title: 'Snapshot Creation Time',
      description: 'The time when the snapshot was created, in milliseconds since the Unix epoch.',
    }),
).options({
  title: 'Block Snapshot',
  description: 'A snapshot of the block\'s state at a certain point in time.',
});
export const BlockSnapshotRef = t.Ref<typeof BlockSnapshot>('BlockSnapshot');

export const NewBlockSnapshotResponse = BlockSnapshot.omit('blob');
export const NewBlockSnapshotResponseRef = t.Ref<typeof NewBlockSnapshotResponse>('NewBlockSnapshotResponse');

// ---------------------------------------------------------------------- Block

// prettier-ignore
export const BlockNew = t.Object(
  t.prop('id', t.Ref<typeof BlockId>('BlockId')),
  t.prop('ts', t.num.options({format: 'u'})),
);
export const BlockNewRef = t.Ref<typeof BlockNew>('BlockNew');

export const Block = BlockNew.extend(t.Object(
  t.prop('snapshot', BlockSnapshotRef),
  t.prop('tip', t.Array(BlockPatchRef)),
));
export const BlockRef = t.Ref<typeof Block>('Block');

// --------------------------------------------------------------------- Events

export const BlockDeleteEvent = t.Tuple(
  t.Const(<const>'del').options({title: 'Event Type'}),
).options({title: 'Delete Event'});

export const BlockUpdateEvent = t.Tuple(
  t.Const(<const>'upd').options({title: 'Event Type'}),
  t.Object(
    t.prop('patches', t.Array(BlockPatchRef)).options({
      title: 'Latest Patches',
      description: 'Patches that have been applied to the block.',
    }),
  ).options({title: 'Event Data'}),
).options({title: 'Update Event'});

export const BlockEvent = t.Or(
  BlockUpdateEvent,
  BlockDeleteEvent,
).options({
  title: 'Block Event',
  description: 'A collection of possible events that can happen to a block.',
});
export const BlockEventRef = t.Ref<typeof BlockEvent>('BlockEvent');

export type TBlockDeleteEvent = ResolveType<typeof BlockDeleteEvent>;
export type TBlockUpdateEvent = ResolveType<typeof BlockUpdateEvent>;
export type TBlockEvent = ResolveType<typeof BlockEvent>;
