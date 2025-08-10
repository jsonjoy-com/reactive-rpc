import {objToModule} from '@jsonjoy.com/json-type/lib/typescript/converter';
import {toText} from '@jsonjoy.com/json-type/lib/typescript/toText';
import type {RouteDeps, Router, RouterBase} from '../types';

export const ping =
  ({t}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.undef;
    const Response = t.Const(<const>'pong');
    const Func = t.Function(Request, Response);
    return r.add('util.ping', Func, async () => {
      return 'pong' as const;
    });
  };

export const echo =
  ({t}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.any;
    const Response = t.any;
    const Func = t.Function(Request, Response);
    return r.add('util.echo', Func, async function(this: {}, msg: any) {
      return msg;
    });
  };

export const info =
  ({t, services}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.any;
    const Response = t.Object(
      t.Key('now', t.num),
      t.Key(
        'stats',
        t.Object(
          t.Key('pubsub', t.Object(t.Key('channels', t.num), t.Key('observers', t.num))),
          t.Key('presence', t.Object(t.Key('rooms', t.num), t.Key('entries', t.num), t.Key('observers', t.num))),
          t.Key('blocks', t.Object(t.Key('blocks', t.num), t.Key('batches', t.num))),
        ),
      ),
    );
    const Func = t.Function(Request, Response);
    return r.add('util.info', Func, async () => {
      return {
        now: Date.now(),
        stats: {
          pubsub: services.pubsub.stats(),
          presence: services.presence.stats(),
          blocks: services.blocks.stats(),
        },
      };
    });
  };

export const schema =
  ({t, router}: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) => {
    const Request = t.any;
    const Response = t.Object(t.Key('typescript', t.str));
    const Func = t.Function(Request, Response);
    return r.add('util.schema', Func, async () => {
      return {
        typescript: toText(objToModule(router.type)),
      };
    });
  };

export const util =
  (d: RouteDeps) =>
  <R extends RouterBase>(r: Router<R>) =>
    // biome-ignore format: each on its own line
    ( ping(d)
    ( echo(d)
    ( info(d)
    ( schema(d)
    ( r )))));
