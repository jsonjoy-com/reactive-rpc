import {BlockIdRef, BlockCurRef, BlockBatchRef, BlockSnapshotRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const scan =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block.',
      }),
      t.propOpt('seq', BlockCurRef).options({
        title: 'Starting Sequence Number',
        description: 'The sequence number to start from. Defaults to the latest sequence number.',
      }),
      t
        .propOpt(
          'limit',
          t.num.options({
            format: 'u16',
            gte: 0,
            lte: 1000,
          }),
        )
        .options({
          title: 'Number of Patches',
          description:
            'The minimum number of patches to return. Defaults to 10. ' +
            'When positive, returns the patches ahead of the starting sequence number. ' +
            'When negative, returns the patches behind the starting sequence number.',
        }),
      t.propOpt('snapshot', t.bool).options({
        title: 'Include Start Snapshot',
        description: 'If true, includes the snapshot of state at the start of the sequence.',
      }),
    );

    const Response = t.Object(
      t.prop('batches', t.Array(BlockBatchRef)).options({
        title: 'Batches',
        description: 'List of batches in given sequence range.',
      }),
      t.propOpt('snapshot', BlockSnapshotRef).options({
        title: 'Start Snapshot',
        description: 'The state of the block right before the first batch in the result.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Block History',
      intro: 'Fetch block history.',
      description: 'Returns a list of specified change patches for a block.',
    });

    return r.prop('block.scan', Func, async ({id, seq, limit = 10, snapshot}) => {
      return await services.blocks.scan(id, !!snapshot, seq, limit);
    });
  };
