import {util} from './util';
import {pubsub} from './pubsub';
import {presence} from './presence';
import {block} from './block';
import type {RouteDeps} from './types';
import type {ObjectValue} from '@jsonjoy.com/json-type/lib/value/ObjectValue';
import type {ObjectType} from '@jsonjoy.com/json-type';

// biome-ignore format: each on its own line
export const routes = (d: RouteDeps) => <R extends ObjectType<any>>(r: ObjectValue<R>) =>
  ( util(d)
  ( pubsub(d)
  ( presence(d)
  // TODO: rename "blocks" to "block", in all methods.
  ( block(d)
  ( r )))));
