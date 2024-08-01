import {ResolveType} from 'json-joy/lib/json-type';
import {BlockRef, BlockIdRef} from '../schema';
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

    const Response = t.Object(t.prop('block', BlockRef));

    const Func = t.Function(Request, Response).options({
      title: 'Read Block',
      intro: 'Retrieves a block by ID.',
    });

    return r.prop('block.get', Func, async ({id}) => {
      const {snapshot} = await services.blocks.get(id);
      const response: ResolveType<typeof Response> = {
        block: {
          id: snapshot.id,
          ts: snapshot.ts,
          snapshot: {
            blob: snapshot.blob,
            cur: snapshot.seq,
            ts: snapshot.ts,
          },
          tip: [],
        },
      };
      return response;
    });
  };
