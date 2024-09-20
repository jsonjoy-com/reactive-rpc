import {tick, until} from 'thingies';
import {ApiTestSetup} from '../../common/rpc/__tests__/runApiTests';
import type {JsonCrdtTestSetup} from '../../__demos__/json-crdt-server/__tests__/setup';

const roomId = () => 'room-' + Math.random().toString(36).slice(2);

export const runPresenceTests = (_setup: ApiTestSetup, params: {staticOnly?: true} = {}) => {
  const setup = _setup as JsonCrdtTestSetup;

  describe('presence', () => {
    if (!params.staticOnly) {
      test('can subscribe and receive published presence entries', async () => {
        const {call, call$, stop} = await setup();
        const emits: any[] = [];
        const room = roomId();
        call$('presence.listen', {room}).subscribe((res) => {
          emits.push(res);
        });
        await call('presence.update', {
          room,
          id: 'user-1',
          data: {
            hello: 'world',
          },
        });
        await until(() => emits.length === 1);
        expect(emits[0]).toMatchObject({
          time: expect.any(Number),
          entries: [
            {
              id: 'user-1',
              lastSeen: expect.any(Number),
              validUntil: expect.any(Number),
              data: {
                hello: 'world',
              },
            },
          ],
        });
        stop();
      });

      test('can receive an existing record when subscribing after it was created', async () => {
        const {call, call$, stop} = await setup();
        const emits: any[] = [];
        const room = roomId();
        const subscription = call$('presence.listen', {room}).subscribe((res) => {
          emits.push(res);
        });
        await call('presence.update', {
          room,
          id: 'user-1',
          data: {
            hello: 'world',
          },
        });
        await until(() => emits.length === 1);
        const emits2: any[] = [];
        call$('presence.listen', {room}).subscribe((res) => {
          emits2.push(res);
        });
        await until(() => emits2.length === 1);
        expect(emits2[0]).toMatchObject({
          time: expect.any(Number),
          entries: [
            {
              id: 'user-1',
              lastSeen: expect.any(Number),
              validUntil: expect.any(Number),
              data: {
                hello: 'world',
              },
            },
          ],
        });
        subscription.unsubscribe();
        stop();
      });

      test('can remove existing entries', async () => {
        const {call, call$, stop} = await setup();
        const emits: any[] = [];
        const room = roomId();
        call$('presence.listen', {room}).subscribe((res) => {
          emits.push(res);
        });
        await call('presence.update', {
          room,
          id: 'user-1',
          data: {
            hello: 'world',
          },
        });
        await until(() => emits.length === 1);
        await call('presence.remove', {room, id: 'user-1'});
        await until(() => emits.length === 2);
        const emits2: any[] = [];
        call$('presence.listen', {room}).subscribe((res) => {
          emits2.push(res);
        });
        await tick(50);
        expect(emits2.length).toBe(0);
        stop();
      });

      test('emits entry deletion messages', async () => {
        const {call, call$, stop} = await setup();
        const room = roomId();
        await call('presence.update', {
          room,
          id: 'user-1',
          data: {
            hello: 'world',
          },
        });
        const emits: any[] = [];
        call$('presence.listen', {room}).subscribe((res) => {
          emits.push(res);
        });
        await call('presence.remove', {room, id: 'user-1'});
        await until(() => emits.length === 2);
        expect(emits[1].entries[0]).toMatchObject({
          id: 'user-1',
          lastSeen: expect.any(Number),
          validUntil: 0,
          data: expect.any(Object),
        });
        stop();
      });
    }
  });
};
