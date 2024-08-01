import {ResolveType} from 'json-joy/lib/json-type';
import {BlockIdRef, BlockSnapshotRef, BlockBatchRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const get =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block to retrieve.',
      }),
    );

    const Response = t.Object(
      t.prop('snapshot', BlockSnapshotRef),
      t.prop('tip', t.Array(BlockBatchRef)),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Read Block',
      intro: 'Retrieves a block by ID.',
    });

    return r.prop('block.get', Func, async ({id}) => {
      const {snapshot} = await services.blocks.get(id);
      const response: ResolveType<typeof Response> = {
        snapshot,
        tip: [],
      };
      return response;
    });
  };
