import {until} from 'thingies';
import {pubsub} from '..';

test('can emit to another instance', async () => {
  const id = 'test-' + Math.random();
  const bus1 = pubsub(id);
  const bus2 = pubsub(id);
  const msgs: any[] = [];
  bus2.bus$.subscribe((msg) => {
    msgs.push(msg);
  });
  bus1.pub('hello');
  await until(() => msgs.length === 1);
  expect(msgs).toEqual(['hello']);
  await bus1.end();
  await bus2.end();
});
