import type {RouteDeps, Router, RouterBase} from '../../types';

export const remove =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.Object(
      t.Key('room', t.str).options({
        title: 'Room ID',
        description: 'The ID of the room from which to remove the entry.',
      }),
      t.Key('id', t.str).options({
        title: 'ID of the entry',
        description: 'The ID of the entry to remove.',
      }),
    );

    const Response = t.obj;

    const Func = t.Function(Request, Response).options({
      title: 'Remove a presence entry.',
      intro: 'Removes a presence entry from a room and notifies all listeners.',
      description: 'This method removes a presence entry from a room and notifies all listeners. ',
    });

    return r.add('presence.remove', Func, async ({room, id}) => {
      await services.presence.remove(room, id);
      return {};
    });
  };
