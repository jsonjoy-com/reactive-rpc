import type {RouteDeps, Router, RouterBase} from '../../types';
import {BlockCurRef, BlockIdRef, BlockPatchPartialRef, BlockPatchRef} from '../schema';

export const upd =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Document ID',
        description: 'The ID of the document to apply the patch to.',
      }),
      t.prop('cur', BlockCurRef).options({
        title: 'Last known sequence number',
        description:
          'The last known sequence number of the document. ' +
          'If the document has changed since this sequence number, ' +
          'the response will contain all the necessary patches for the client to catch up.',
      }),
      t.prop('patches', t.Array(BlockPatchPartialRef)).options({
        title: 'Patches',
        description: 'The patches to apply to the document.',
      }),
    );

    const Response = t.Object(
      t.prop('patches', t.Array(BlockPatchRef)).options({
        title: 'Latest patches',
        description: 'The list of patches that the client might have missed and should apply to the document.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Edit Block',
      intro: 'Applies patches to an existing block.',
      description: 'Applies patches to an existing document and returns the latest concurrent changes.',
    });

    return r.prop('block.upd', Func, async ({id, cur, patches}) => {
      const res = await services.blocks.edit(id, patches);
      return {
        patches: res.patches,
      };
    });
  };
