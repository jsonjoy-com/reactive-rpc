import {Model} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {RpcErrorCodes} from '../../common/rpc/caller';
import {tick, until} from 'thingies';
import type {ApiTestSetup} from '../../common/rpc/__tests__/runApiTests';
import type {JsonCrdtTestSetup} from '../../__demos__/json-crdt-server/__tests__/setup';
import type {TBlockEvent} from '../../__demos__/json-crdt-server/routes/block/schema';

const sid = Math.random().toString(36).slice(2);
let seq = 0;
const getId = () => `${sid}-${Date.now().toString(36)}-${seq++}`;

export const runBlockTests = (_setup: ApiTestSetup, params: {staticOnly?: true} = {}) => {
  const setup = _setup as JsonCrdtTestSetup;

  describe('block.*', () => {
    describe('block.new', () => {
      test('can create an empty block', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const response1 = await call('block.new', {id});
        expect(response1).toMatchObject({
          snapshot: {
            id,
            seq: -1,
            ts: expect.any(Number),
          },
        });
        const response2 = await call('block.get', {id});
        expect(response2).toMatchObject({
          block: {
            ts: expect.any(Number),
            snapshot: {
              seq: -1,
              blob: expect.any(Uint8Array),
            },
            tip: [],
          }
        });
        const model2 = Model.fromBinary(response2.block.snapshot.blob);
        expect(model2.view()).toBe(undefined);
        expect(model2.clock.sid).toBe(SESSION.GLOBAL);
        stop();
      });

      test('can create a block with value', async () => {
        const {call, stop} = await setup();
        const model = Model.create();
        const id = getId();
        model.api.root({
          name: 'Super Woman',
          age: 25,
        });
        const patch1 = model.api.flush();
        model.api.obj([]).set({
          age: 26,
        });
        const patch2 = model.api.flush();
        const newResponse = await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
              {
                blob: patch2.toBinary(),
              },
            ],
          },
        });
        expect(newResponse).toMatchObject({
          snapshot: {
            seq: 0,
            ts: expect.any(Number),
          },
        });
        const res = await call('block.get', {id});
        expect(res).toMatchObject({
          block: {
            snapshot: {
              seq: 0,
              blob: expect.any(Uint8Array),
              ts: expect.any(Number),
            },
            tip: [],
          }
        });
        const model2 = Model.fromBinary(res.block.snapshot.blob);
        expect(model2.view()).toStrictEqual({
          name: 'Super Woman',
          age: 26,
        });
        stop();
      });
    });

    describe('block.remove', () => {
      test('can remove an existing block', async () => {
        const {call, stop} = await setup();
        const id = getId();
        await call('block.new', {id});
        const {block: {snapshot}} = await call('block.get', {id});
        expect(snapshot.id).toBe(id);
        const res1 = await call('block.del', {id});
        expect(res1.success).toBe(true);
        const res2 = await call('block.del', {id});
        expect(res2.success).toBe(false);
        try {
          await call('block.get', {id});
          throw new Error('not this error');
        } catch (err: any) {
          expect(err.errno).toBe(RpcErrorCodes.NOT_FOUND);
        }
        stop();
      });
    });

    describe('block.upd', () => {
      test('can create a new block', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        const result = await call('block.upd', {
          create: true,
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });
        expect(result).toMatchObject({
          batch: {
            seq: 0,
            ts: expect.any(Number),
          },
        });
        stop();
      });

      test('throws NOT_FOUND when "create" flag missing', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        try {
          await call('block.upd', {
            create: false,
            id,
            batch: {
              patches: [
                {
                  blob: patch1.toBinary(),
                },
              ],
            },
          });
          throw new Error('not this error');
        } catch (error) {
          expect(error).toMatchObject({
            code: 'NOT_FOUND',
          });
        }
        stop();
      });

      test('can edit a document sequentially', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        const newResult = await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.str(['text']).ins(5, ' World');
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2.toBinary(),
              },
              {
                blob: patch3.toBinary(),
              },
            ],
          },
        });
        const block2 = await call('block.get', {id});
        expect(Model.fromBinary(block2.block.snapshot.blob).view()).toStrictEqual({
          text: 'Hello World',
        });
        const str = model.api.str(['text']);
        str.del(5, 1);
        str.ins(5, ', ');
        const patch4 = model.api.flush();
        model.api.str(['text']).ins(12, '!');
        const patch5 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch4.toBinary(),
              },
              {
                blob: patch5.toBinary(),
              },
            ],
          },
        });
        const block3 = await call('block.get', {id});
        expect(Model.fromBinary(block3.block.snapshot.blob).view()).toStrictEqual({
          text: 'Hello, World!',
        });
        stop();
      });

      test('can edit a document concurrently', async () => {
        const {call, stop} = await setup();
        const id = getId();

        // User 1
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });

        // User 2
        const block2 = await call('block.get', {id});
        const model2 = Model.fromBinary(block2.block.snapshot.blob).fork();
        model2.api.str(['text']).ins(4, ' yeah!');
        const patch2User2 = model2.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2User2.toBinary(),
              },
            ],
          },
        });
        expect(model2.view()).toStrictEqual({text: 'Hell yeah!'});

        const block3 = await call('block.get', {id});
        const model3 = Model.fromBinary(block3.block.snapshot.blob).fork();
        expect(model3.view()).toStrictEqual({text: 'Hell yeah!'});

        // User 1
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.str(['text']).ins(5, ' World');
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2.toBinary(),
              },
              {
                blob: patch3.toBinary(),
              },
            ],
          },
        });

        const block4 = await call('block.get', {id});
        const model4 = Model.fromBinary(block4.block.snapshot.blob).fork();
        expect(model4.view()).not.toStrictEqual({text: 'Hell yeah!'});
        stop();
      });
    });

    if (!params.staticOnly) {
      describe('block.listen', () => {
        test('can listen for block changes', async () => {
          const {call, call$, stop} = await setup();
          const id = getId();
          await call('block.new', {id});
          await tick(11);
          const emits: TBlockEvent[] = [];
          call$('block.listen', {id}).subscribe(({event}) => emits.push(event));
          const model = Model.create();
          model.api.root({
            text: 'Hell',
          });
          const patch1 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(0);
          await call('block.upd', {
            id,
            batch: {
              patches: [{blob: patch1.toBinary()}],
            },
          });
          await until(() => emits.length === 1);
          expect(emits.length).toBe(1);
          expect(emits[0][0]).toBe('upd');
          if (emits[0][0] === 'upd') {
            expect(emits[0][1].batch).toMatchObject({
              ts: expect.any(Number),
              patches: [{blob: patch1.toBinary()}],
            });
          }
          model.api.root({
            text: 'Hello',
          });
          const patch2 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(1);
          await call('block.upd', {
            id,
            batch: {
              patches: [{blob: patch2.toBinary()}],
            },
          });
          await until(() => emits.length === 2);
          expect(emits.length).toBe(2);
          expect(emits[1][0]).toBe('upd');
          if (emits[1][0] === 'upd') {
            expect(emits[1][1].batch.patches.length).toBe(1);
            expect(emits[1][1].batch).toMatchObject({
              ts: expect.any(Number),
              patches: [{blob: patch2.toBinary()}],
            });
          }
          stop();
        });

        test('can subscribe before block is created', async () => {
          const {call, call$, stop} = await setup();
          const emits: TBlockEvent[] = [];
          const id = getId();
          call$('block.listen', {id}).subscribe(({event}) => emits.push(event));
          const model = Model.withLogicalClock();
          model.api.root({
            text: 'Hell',
          });
          const patch1 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(0);
          await call('block.new', {
            id,
            batch: {
              patches: [
                {
                  blob: patch1.toBinary(),
                },
              ],
            },
          });
          await until(() => emits.length === 2);
          expect(emits.length).toBe(2);
          expect(emits[0]).toEqual(['new']);
          expect(emits[1][0]).toBe('upd');
          if (emits[1][0] === 'upd') {
            expect(emits[1][1].batch.patches.length).toBe(1);
            expect(emits[1][1].batch).toMatchObject({
              ts: expect.any(Number),
              patches: [
                {
                  blob: patch1.toBinary(),
                },
              ],
            });
          }
          stop();
        });

        test('can receive creation events', async () => {
          const {call, call$, stop} = await setup();
          const emits: TBlockEvent[] = [];
          const id = getId();
          call$('block.listen', {id}).subscribe(({event}) => {
            emits.push(event);
          });
          await call('block.new', {id});
          await until(() => emits.length === 1);
          expect(emits).toEqual([['new']]);
          stop();
        });

        test('can receive deletion events', async () => {
          const {call, call$, stop} = await setup();
          const emits: TBlockEvent[] = [];
          const id = getId();
          call$('block.listen', {id}).subscribe(({event}) => {
            emits.push(event);
          });
          await call('block.new', {id});
          await call('block.del', {id});
          await until(() => emits.length === 2);
          expect(emits).toEqual([['new'], ['del']]);
          stop();
        });
      });
    }

    describe('block.scan', () => {
      test('can retrieve change history', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });
        await tick(11);
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.obj([]).set({
          age: 26,
        });
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2.toBinary(),
              },
              {
                blob: patch3.toBinary(),
              },
            ],
          },
        });
        const history = await call('block.scan', {id, seq: 0, limit: 3});
        expect(history).toMatchObject({
          batches: [
            {
              ts: expect.any(Number),
              patches: [
                {
                  blob: patch1.toBinary(),
                },
              ],
            },
            {
              ts: expect.any(Number),
              patches: [
                {
                  blob: patch2.toBinary(),
                },
                {
                  blob: patch3.toBinary(),
                },
              ],
            },
          ],
        });
        stop();
      });
    });

    describe('block.get', () => {
      test('can load a block', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.obj([]).set({
          age: 26,
        });
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2.toBinary(),
              },
              {
                blob: patch3.toBinary(),
              },
            ],
          },
        });
        const result = await call('block.get', {id});
        expect(result).toMatchObject({
          block: {
            snapshot: {
              id,
              seq: 1,
              blob: expect.any(Uint8Array),
              ts: expect.any(Number),
            },
            tip: [],
          }
        });
        stop();
      });
    });

    describe('block.view', () => {
      test('can read a block view', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          },
        });
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.obj([]).set({
          age: 26,
        });
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          batch: {
            patches: [
              {
                blob: patch2.toBinary(),
              },
              {
                blob: patch3.toBinary(),
              },
            ],
          },
        });
        const res = await call('block.view', {id});
        expect(res).toMatchObject({
          view: {
            text: 'Hello',
            age: 26,
          },
        });
        stop();
      });
    });
  });
};
