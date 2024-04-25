import {map, switchMap, tap} from 'rxjs';
import {BlockEventRef, BlockIdRef} from '../schema';
import type {RouteDeps, Router, RouterBase} from '../../types';

export const listen =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', BlockIdRef).options({
        title: 'Block ID',
        description: 'The ID of the block to subscribe to.',
      }),
    );

    const Response = t.Object(t.prop('event', BlockEventRef));

    const Func = t.Function$(Request, Response).options({
      title: 'Listen for block changes',
      description: `Subscribe to a block to receive updates when it changes.`,
    });

    return r.prop('block.listen', Func, (req$) => {
      const response = req$.pipe(
        switchMap(({id}) => {
          return services.blocks.listen(id);
        }),
        map((event) => {
          return {
            event,
          };
        }),
      );
      return response;
    });
  };
