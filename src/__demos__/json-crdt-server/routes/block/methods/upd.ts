import {ResolveType} from 'json-joy/lib/json-type';
import {
  BlockBatchPartialRef,
  BlockBatchPartialReturnRef,
  BlockBatchRef,
  BlockCurRef,
  BlockIdRef,
  BlockSnapshotRef,
} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const upd =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Document ID',
        description: 'The ID of the document to apply the patch to.',
      }),
      t.prop('batch', BlockBatchPartialRef).options({
        title: 'Batch',
        description: 'The batch of changes to apply to the document.',
      }),
      t.propOpt('create', t.bool).options({
        title: 'Create, if not Exists',
        description: 'If true, creates a new document if it does not exist.',
      }),
      t.propOpt('seq', BlockCurRef).options({
        title: 'Sequence Number',
        description:
          'The last client known sequence number. The server will return history starting from this sequence number.',
      }),
    );

    const Response = t.Object(
      t.prop('batch', BlockBatchPartialReturnRef).options({
        title: 'Committed Batch Parts',
        description: 'Parts of committed batch which were generated on the server.',
      }),
      t.propOpt(
        'pull',
        t.Object(
          t.prop('batches', t.Array(BlockBatchRef)).options({
            title: 'Batches',
            description: 'The list of batches that happened after the given sequence number.',
          }),
          t.propOpt('snapshot', BlockSnapshotRef).options({
            title: 'Snapshot',
            description:
              'The snapshot of the block, to which the batches can be applied to get the current state of the block.',
          }),
        ),
      ),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Edit Block',
      intro: 'Applies patches to an existing block.',
      description: 'Applies patches to an existing document and returns the latest concurrent changes.',
    });

    return r.prop('block.upd', Func, async ({id, batch, create, seq}) => {
      const blocks = services.blocks;
      const res = await blocks.edit(id, batch, !!create);
      const response: ResolveType<typeof Response> = {
        batch: {
          seq: res.batch.seq,
          ts: res.batch.ts,
        },
      };
      type Pull = ResolveType<typeof Response>['pull'];
      let pull: Pull;
      if (typeof seq === 'number') {
        const diff = res.batch.seq - seq;
        if (diff <= 1) {
          pull = {batches: []};
        } else {
          const needsSnapshot = diff > 100;
          let min: number, max: number, limit: number;
          if (needsSnapshot) {
            min = res.batch.seq - 100;
            max = res.batch.seq - 1;
            limit = max - min + 1;
          } else {
            min = seq + 1;
            max = res.batch.seq - 1;
            limit = max - min + 1;
          }
          pull = (await blocks.scan(id, needsSnapshot, min, limit)) as Pull;
        }
      }
      if (pull) response.pull = pull;
      return response;
    });
  };
