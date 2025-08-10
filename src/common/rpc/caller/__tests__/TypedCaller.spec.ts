import {TypeSystem} from '@jsonjoy.com/json-type';
import {ObjectValue} from '@jsonjoy.com/json-type/lib/value/ObjectValue';
import {TypedCaller} from '../TypedCaller';

test('can execute simple calls', async () => {
  const system = new TypeSystem();
  const {t} = system;
  const router = ObjectValue.create(system)
    .prop('ping',
      t.Function(t.any, t.Const(<const>'pong')),
      async () => <const>'pong',
  )
    .prop('echo', t.Function(t.any, t.any), async (req) => req);
  const caller = new TypedCaller({router});
  const res1 = await caller.call('ping', null, {});
  console.log(res1);
  // expect(res1.data).toBe('pong');
  // const res2 = await caller.callSimple('echo', {foo: 'bar'}, {});
  // expect(res2).toEqual({foo: 'bar'});
});
