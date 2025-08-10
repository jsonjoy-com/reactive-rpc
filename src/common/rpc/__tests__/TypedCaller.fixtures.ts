import {ObjValue} from '@jsonjoy.com/json-type';
import {TypedCaller} from '../caller/TypedCaller';
import {procedures, SampleCtx} from './RpcCaller.fixtures';

const base = ObjValue.new();
const t = base.system.t;

export const obj = base
  .add('ping', t.fn.inp(t.undef).out(t.con('pong')).ctx<SampleCtx>(), procedures.ping.call)
  .add('getIp', t.fn.inp(t.undef).out(t.str).ctx<SampleCtx>(), procedures.getIp.call)
  .add(
    'delay',
    t.fn
      .inp(t.object({timeout: t.num}))
      .out(t.object({done: t.bool, timeout: t.num}))
      .ctx<SampleCtx>()
      .default(({timeout}) => {
        return {
          done: true,
          timeout,
        };
      }),
    procedures.delay.call,
  )
  .add(
    'notificationSetValue',
    t.fn
      .inp(t.object({value: t.num}))
      .out(t.undef)
      .ctx<SampleCtx>(),
    procedures.notificationSetValue.call,
  )
  .add(
    'notificationSetValueFromCtx',
    t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(),
    procedures.notificationSetValueFromCtx.call,
  )
  .add(
    'getValue',
    t.fn
      .inp(t.undef)
      .out(t.object({value: t.num}))
      .ctx<SampleCtx>(),
    procedures.getValue.call,
  )
  .add(
    'delayStreaming',
    t.fn
      .inp(t.object({timeout: t.num}))
      .out(t.object({done: t.bool, timeout: t.num}))
      .ctx<SampleCtx>(),
    procedures.delayStreaming.call,
  )
  .add(
    'double',
    t.fn
      .inp(t.object({num: t.num}))
      .out(t.object({num: t.num}))
      .ctx<SampleCtx>(),
    procedures.double.call,
  )
  .add('error', t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(), procedures.error.call)
  .add(
    'auth.users.get',
    t.fn
      .inp(t.object({id: t.str}))
      .out(t.object({id: t.str, name: t.str, tags: t.array(t.str)}))
      .ctx<SampleCtx>(),
    procedures['auth.users.get'].call,
  )
  .add('streamError', t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(), procedures.streamError.call)
  .add('utilTimer', t.fn.inp(t.undef).out(t.num).ctx<SampleCtx>(), procedures.utilTimer.call);

export const createTypedCaller = () =>
  new TypedCaller<SampleCtx | void, typeof obj>({
    router: obj,
  });
