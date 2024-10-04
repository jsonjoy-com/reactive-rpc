import type {ResolveType} from 'json-joy/lib/json-type';
import {BlockIdRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const view =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block to retrieve.',
      }),
    );

    const Response = t.Object(t.prop('view', t.any));

    const Func = t.Function(Request, Response).options({
      title: 'Read View',
      intro: 'Retrieves the latest view of a block.',
      description: 'This method retrieves the latest materialized view of a block by ID.',
    });

    return r.prop('block.view', Func, async ({id}) => {
      const view = await services.blocks.view(id);
      const response: ResolveType<typeof Response> = {
        view,
      };
      return response;
    });
  };
