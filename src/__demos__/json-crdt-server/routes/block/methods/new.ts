import {BlockIdRef, BlockBatchPartialRef, BlockSnapshotReturnRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const new_ =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'New block ID',
        description:
          'The ID of the new block. Must be a unique ID, if the block already exists it will return an error.',
      }),
      t.propOpt('batch', BlockBatchPartialRef).options({
        title: 'Batch',
        description: 'A collection of patches to apply to the new block.',
      }),
    );

    // prettier-ignore
    const Response = t.Object(
      t.prop('snapshot', BlockSnapshotReturnRef),
    ).options({
      title: 'New block creation response',
      description:
        'The response object for the new block creation, contains server generated metadata without blobs supplied by the client.',
    });

    const Func = t.Function(Request, Response).options({
      title: 'Create Block',
      intro: 'Creates a new block out of patches.',
      description:
        'Creates a new block out of supplied patches. A block starts empty with an `undefined` state, and patches are applied to it.',
    });

    return r.prop('block.new', Func, async ({id, batch}) => {
      const {block} = await services.blocks.create(id, batch);
      const snapshot = block.snapshot;
      return {
        snapshot: {
          id,
          seq: snapshot.seq,
          ts: snapshot.ts,
        },
      };
    });
  };
