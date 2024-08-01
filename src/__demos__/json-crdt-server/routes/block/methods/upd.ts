import {ResolveType} from 'json-joy/lib/json-type';
import {BlockBatchPartialRef, BlockBatchPartialReturnRef, BlockBatchSeqRef, BlockIdRef} from '../schema';
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
      t.propOpt('seq', BlockBatchSeqRef).options({
        title: 'Sequence Number',
        description: 'The last sequence number the client has seen.',
      }),
    );

    const Response = t.Object(
      t.propOpt('batch', BlockBatchPartialReturnRef).options({
        title: 'Committed Batch Parts',
        description: 'Parts of committed batch which were generated on the server.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Edit Block',
      intro: 'Applies patches to an existing block.',
      description: 'Applies patches to an existing document and returns the latest concurrent changes.',
    });

    return r.prop('block.upd', Func, async ({id, batch, create}) => {
      const res = await services.blocks.edit(id, batch, !!create);
      const response: ResolveType<typeof Response> = {};
      if (res.batch) {
        response.batch = {
          seq: res.batch.seq,
          ts: res.batch.ts,
        };
      }
      return response;
    });
  };
