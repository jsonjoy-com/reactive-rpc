import {ResolveType} from 'json-joy/lib/json-type';
import type {RouteDeps, Router, RouterBase} from '../../types';
import {BlockCurRef, BlockIdRef, BlockPatchPartialRef, BlockPatchPartialReturnRef} from '../schema';

export const upd =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Document ID',
        description: 'The ID of the document to apply the patch to.',
      }),
      t.prop('patches', t.Array(BlockPatchPartialRef)).options({
        title: 'Patches',
        description: 'The patches to apply to the document.',
      }),
    );

    const Response = t.Object(
      t.prop('patches', t.Array(BlockPatchPartialReturnRef)).options({
        title: 'Latest patches',
        description: 'The list of patches that the client might have missed and should apply to the document.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Edit Block',
      intro: 'Applies patches to an existing block.',
      description: 'Applies patches to an existing document and returns the latest concurrent changes.',
    });

    return r.prop('block.upd', Func, async ({id, patches}) => {
      const res = await services.blocks.edit(id, patches);
      const patchesReturn: ResolveType<typeof BlockPatchPartialReturnRef>[] = res.patches.map(patch => ({
        ts: patch.created,
      }));
      return {
        patches: patchesReturn,
      };
    });
  };
