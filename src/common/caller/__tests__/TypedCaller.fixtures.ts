import {TypedCaller} from '../TypedCaller';
import {ObjValue} from '@jsonjoy.com/json-type';
import {procedures, SampleCtx} from './RpcCaller.fixtures';

const base = ObjValue.new();
const t = base.system.t;

export const obj = base
  .add('ping', t.fn.inp(t.undef).out(t.con('pong')).ctx<SampleCtx>(), procedures.ping.call.bind(procedures.ping))
  .add('getIp', t.fn.inp(t.undef).out(t.object({ip: t.str})).ctx<SampleCtx>(), procedures.getIp.call.bind(procedures.getIp))
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
    procedures.delay.call.bind(procedures.delay),
  )
  .add(
    'notificationSetValue',
    t.fn
      .inp(t.object({value: t.num}))
      .out(t.undef)
      .ctx<SampleCtx>(),
    procedures.notificationSetValue.call.bind(procedures.notificationSetValue),
  )
  .add(
    'notificationSetValueFromCtx',
    t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(),
    procedures.notificationSetValueFromCtx.call.bind(procedures.notificationSetValueFromCtx),
  )
  .add(
    'getValue',
    t.fn
      .inp(t.undef)
      .out(t.object({value: t.num}))
      .ctx<SampleCtx>(),
    procedures.getValue.call.bind(procedures.getValue),
  )
  .add(
    'delayStreaming',
    t.fn
      .inp(t.object({timeout: t.num}))
      .out(t.object({done: t.bool, timeout: t.num}))
      .ctx<SampleCtx>(),
    procedures.delayStreaming.call.bind(procedures.delayStreaming),
  )
  .add(
    'double',
    t.fn
      .inp(t.object({num: t.num}))
      .out(t.object({num: t.num}))
      .ctx<SampleCtx>(),
    procedures.double.call.bind(procedures.double),
  )
  .add('error', t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(), procedures.error.call.bind(procedures.error))
  .add('streamError', t.fn.inp(t.undef).out(t.undef).ctx<SampleCtx>(), procedures.streamError.call.bind(procedures.streamError))
  .add(
    'auth.users.get',
    t.fn
      .inp(t.object({id: t.str}))
      .out(t.object({id: t.str, name: t.str, tags: t.array(t.str)}))
      .ctx<SampleCtx>(),
    procedures['auth.users.get'].call.bind(procedures['auth.users.get']),
  )
  .add('utilTimer', t.fn.inp(t.undef).out(t.num).ctx<SampleCtx>(), procedures.utilTimer.call.bind(procedures.utilTimer));

export const createTypedCaller = () =>
  new TypedCaller<SampleCtx | void, typeof obj>({
    router: obj,
  });
