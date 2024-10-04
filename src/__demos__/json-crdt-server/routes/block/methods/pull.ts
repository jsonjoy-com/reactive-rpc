import {BlockIdRef, BlockCurRef, BlockBatchRef, BlockSnapshotRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const pull =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    // biome-ignore format: props
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block.',
      }),
      t.prop('seq', BlockCurRef).options({
        title: 'Last Known Sequence Number',
        description: 'The sequence number that the client is caught up to. If '
          + 'the client is not caught up to the latest state of the block, the '
          + 'server will return a list of batches that the client needs to apply '
          + 'to get to the latest state. If the client is too far behind, the '
          + 'server will return a snapshot of the block.'
          + '\n\n'
          + 'The initial value should be `-1`.',
      }),
      t.propOpt('create', t.bool).options({
        title: 'Create Block',
        description: 'Whether to create a new block if it does not exist.',
      }),
    );

    // biome-ignore format: props
    const Response = t.Object(
      t.prop('batches', t.Array(BlockBatchRef)).options({
        title: 'Batches',
        description: 'List of batches that the client need to apply to the local state. ' +
          'Or, if `snapshot` is provided, the list of batches that the client need to apply to the snapshot to get to the latest state.',
      }),
      t.propOpt('snapshot', BlockSnapshotRef).options({
        title: 'Snapshot',
        description: 'The state of the block right before the first batch in the result.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Pull Block',
      intro: 'Catch up to the latest state of a block.',
      description: 'Returns a list of most recent change batches or a snapshot of a block.',
    });

    return r.prop('block.pull', Func, async ({id, seq, create}) => {
      return await services.blocks.pull(id, seq, !!create);
    });
  };
