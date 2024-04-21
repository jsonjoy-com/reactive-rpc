import {t} from '../system';

export const BlockId = t.str.options({
  title: 'Block ID',
  min: 6,
  max: 40,
});
export const BlockSeq = t.num.options({
  title: 'Block Sequence Number',
  gte: 0,
  format: 'i32',
});

// ---------------------------------------------------------------------- Patch

// prettier-ignore
export const BlockPatchPartial = t.Object(
  t.prop('blob', t.bin).options({
    title: 'Patch Blob',
    description: 'The binary data of the patch. The format of the data is defined by the patch type.',
  }),
);
// prettier-ignore
export const BlockPatchPartialReturn = t.Object(
  t.prop('seq', t.num).options({
    title: 'Patch Sequence Number',
    description: 'The sequence number of the patch in the block. A monotonically increasing integer, starting from 0.',
  }),
  t.prop('created', t.num).options({
    title: 'Patch Creation Time',
    description: 'The time when the patch was created, in milliseconds since the Unix epoch.' +
      '\n\n' + 
      'This time is set by the server when the patch received and stored on the server. If you ' +
      'want to also store the time when the patch was created by the user, you can include this ' +
      'information in the patch blob itself.',
  }),
);
export const BlockPatch = BlockPatchPartial.extend(BlockPatchPartialReturn);

// ------------------------------------------------------------------- Snapshot

export const BlockSnapshot = t.Object(
  t.prop('blob', t.bin)
    .options({
      title: 'Snapshot Blob',
      description: 'A serialized JSON CRDT model.',
    }),
  t.prop('cur', t.num)
    .options({
      title: 'Snapshot Cursor',
      description: 'The cursor of the snapshot, representing the position in the history.',
    }),
  t.prop('ts', t.num)
    .options({
      title: 'Snapshot Creation Time',
      description: 'The time when the snapshot was created, in milliseconds since the Unix epoch.',
    }),
).options({
  title: 'Block Snapshot',
  description: 'A snapshot of the block\'s state at a certain point in time.',
});

// ---------------------------------------------------------------------- Block

// prettier-ignore
export const BlockPartial = t.Object(
  t.prop('blob', t.bin),
);
export const BlockPartialReturn = t.Object(
  t.prop('id', t.Ref<typeof BlockId>('BlockId')),
  t.prop('ts', t.num),
  t.prop('data', t.Ref<typeof BlockSnapshot>('BlockSnapshot')),
  t.prop('tip', t.Array(t.Ref<typeof BlockPatch>('BlockPatch'))),
);
export const Block = BlockPartial.extend(BlockPartialReturn);
