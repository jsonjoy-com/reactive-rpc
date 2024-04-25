import {BlockIdRef, BlockPatchPartialRef, BlockPatchPartialReturnRef, BlockNewRef, NewBlockSnapshotResponseRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const new_ =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'New block ID',
        description: 'The ID of the new block. Must be a unique ID, if the block already exists it will return an error.',
      }),
      t.prop('patches', t.Array(BlockPatchPartialRef)).options({
        title: 'Patches',
        description: 'The patches to apply to the document.',
      }),
    );

    const Response = t.Object(
      t.prop('block', BlockNewRef),
      t.prop('snapshot', NewBlockSnapshotResponseRef),
      t.prop('patches', t.Array(BlockPatchPartialReturnRef)).options({
        title: 'Patches',
        description: 'The list of patches to apply to the newly created block.',
      }),
    ).options({
      title: 'New block creation response',
      description: 'The response object for the new block creation, contains server generated metadata without blobs supplied by the client.',
    });

    const Func = t.Function(Request, Response).options({
      title: 'Create Block',
      intro: 'Creates a new block out of patches.',
      description: 'Creates a new block out of supplied patches. A block starts empty with an `undefined` state, and patches are applied to it.',
    });

    return r.prop('block.new', Func, async ({id, patches}) => {
      const res = await services.blocks.create(id, patches);
      return {
        block: {
          id: res.snapshot.id,
          ts: res.snapshot.created,
        },
        snapshot: {
          cur: res.snapshot.seq,
          ts: res.snapshot.created,
        },
        patches: res.patches.map((patch) => ({
          ts: patch.created,
        })),
      };
    });
  };
