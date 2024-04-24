import type {RouteDeps, Router, RouterBase} from '../../types';
import type {BlockId} from '../schema';

export const del =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.prop('id', t.Ref<typeof BlockId>('BlockId')).options({
        title: 'Block ID',
        description: 'The ID of the block to delete.',
      }),
    );

    const Response = t.Object(
      t.prop('success', t.bool).options({
        title: 'Success',
        description: 'Indicates whether the block was deleted successfully. Returns `false` if the block does not exist.',
      }),
    );

    const Func = t.Function(Request, Response).options({
      title: 'Delete Block',
      intro: 'Deletes a block by ID.',
      description: 'Deletes a block by ID. It will not rise an error if the block does not exist.',
    });

    return r.prop('block.del', Func, async ({id}) => {
      const success = await services.blocks.remove(id);
      return {
        success,
      };
    });
  };
