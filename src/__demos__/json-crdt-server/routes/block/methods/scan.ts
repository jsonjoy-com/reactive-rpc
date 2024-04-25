import {BlockIdRef, BlockCurRef, BlockPatchRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const scan =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block.',
      }),
      t.propOpt('cur', BlockCurRef).options({
        title: 'Starting Sequence Number',
        description: 'The sequence number to start from. Defaults to the latest sequence number.',
      }),
      t.propOpt('limit', t.num.options({format: 'u32'})).options({
        title: 'Number of Patches',
        description:
          'The minimum number of patches to return. Defaults to 10. ' +
          'When positive, returns the patches ahead of the starting sequence number. ' +
          'When negative, returns the patches behind the starting sequence number.',
      }),
    );

    const Response = t.Object(
      t.prop('patches', t.Array(BlockPatchRef)).options({
        title: 'Patches',
        description: 'The list of patches.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Block History',
      intro: 'Fetch block history.',
      description: 'Returns a list of specified change patches for a block.',
    });

    return r.prop('block.scan', Func, async ({id, cur, limit = 10}) => {
      const {patches} = await services.blocks.scan(id, cur, limit);
      return {patches: patches.map(p => ({
        blob: p.blob,
        ts: p.created,
      }))};
    });
  };
