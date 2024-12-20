import {Model, Patch} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {RpcErrorCodes} from '../../common/rpc/caller';
import {of, tick, until} from 'thingies';
import type {ApiTestSetup} from '../../common/rpc/__tests__/runApiTests';
import type {JsonCrdtTestSetup} from '../../__demos__/json-crdt-server/__tests__/setup';
import type {TBlockEvent} from '../../__demos__/json-crdt-server/routes/block/schema';

const sid = Math.random().toString(36).slice(2);
let seq = 0;
const getId = () => `${sid}-${Date.now().toString(36)}-${seq++}-${Math.random().toString(36).slice(2)}`;

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
          },
        });
        const model2 = Model.fromBinary(response2.block.snapshot.blob);
        expect(model2.view()).toBe(undefined);
        expect(model2.clock.sid).toBe(SESSION.GLOBAL);
        await stop();
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
          },
        });
        const model2 = Model.fromBinary(res.block.snapshot.blob);
        expect(model2.view()).toStrictEqual({
          name: 'Super Woman',
          age: 26,
        });
        await stop();
      });
    });

    describe('block.remove', () => {
      test('can remove an existing block', async () => {
        const {call, stop} = await setup();
        const id = getId();
        await call('block.new', {id});
        const {
          block: {snapshot},
        } = await call('block.get', {id});
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
        await stop();
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
        await stop();
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
        await stop();
      });

      test('can edit a document sequentially', async () => {
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
        await stop();
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
        await stop();
      });

      test('can pull concurrent changes', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {id, batch: {patches: [{blob: patch1.toBinary()}]}});
        const user1 = await call('block.get', {id});
        const user2 = await call('block.get', {id});
        const model1 = Model.load(user1.block.snapshot.blob, 1e7);
        const model2 = Model.load(user2.block.snapshot.blob, 1e7 + 1);
        model1.api.str(['text']).ins(4, 'o');
        const patch2 = model1.api.flush();
        await call('block.upd', {id, batch: {patches: [{blob: patch2.toBinary()}]}});
        model1.api.obj([]).set({x: 123});
        const patch3 = model1.api.flush();
        await call('block.upd', {id, batch: {patches: [{blob: patch3.toBinary()}]}});
        expect(model1.view()).toStrictEqual({text: 'Hello', x: 123});
        model2.api.str(['text']).ins(4, '!');
        const patch4 = model2.api.flush();
        expect(model2.view()).toStrictEqual({text: 'Hell!'});
        const res = await call('block.upd', {
          id,
          seq: user2.block.snapshot.seq,
          batch: {patches: [{blob: patch4.toBinary()}]},
        });
        expect(res.pull?.batches.length).toBe(2);
        expect(res.pull).toMatchObject({
          batches: [
            {
              seq: 1,
              ts: expect.any(Number),
              patches: [{blob: patch2.toBinary()}],
            },
            {
              seq: 2,
              ts: expect.any(Number),
              patches: [{blob: patch3.toBinary()}],
            },
          ],
        });
        for (const batch of res.pull!.batches!)
          for (const patch of batch.patches) model2.applyPatch(Patch.fromBinary(patch.blob));
        expect(model2.view()).toStrictEqual({text: 'Hell!o', x: 123});
        const pull = await call('block.scan', {id, seq: 2, limit: 100});
        expect(model1.view()).toStrictEqual({text: 'Hello', x: 123});
        for (const batch of pull.batches!)
          for (const patch of batch.patches) model1.applyPatch(Patch.fromBinary(patch.blob));
        expect(model1.view()).toStrictEqual({text: 'Hell!o', x: 123});
        await stop();
      });

      test('can pull with no prior known sequence', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {id, batch: {patches: [{blob: patch1.toBinary()}]}});
        const model2 = model.fork();
        model2.api.str(['text']).ins(4, 'o');
        const patch2 = model2.api.flush();
        const {pull} = await call('block.upd', {id, seq: -1, batch: {patches: [{blob: patch2.toBinary()}]}});
        expect(pull).toMatchObject({
          batches: [
            {
              seq: 0,
              ts: expect.any(Number),
              patches: [{blob: patch1.toBinary()}],
            },
          ],
        });
        await stop();
      });

      test('can pull concurrent changes, with snapshot as too many batches', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {id, batch: {patches: [{blob: patch1.toBinary()}]}});
        const user1 = await call('block.get', {id});
        const user2 = await call('block.get', {id});
        const model1 = Model.load(user1.block.snapshot.blob, 1e7);
        const model2 = Model.load(user2.block.snapshot.blob, 1e7 + 1);
        for (let i = 0; i < 111; i++) {
          model1.api.obj([]).set({num: i});
          const patch = model1.api.flush();
          await call('block.upd', {id, batch: {patches: [{blob: patch.toBinary()}]}});
        }
        expect(model1.view()).toStrictEqual({text: 'Hell', num: 110});
        model2.api.str(['text']).ins(4, '!');
        const patch2 = model2.api.flush();
        expect(model2.view()).toStrictEqual({text: 'Hell!'});
        const res = await call('block.upd', {
          id,
          seq: user2.block.snapshot.seq,
          batch: {patches: [{blob: patch2.toBinary()}]},
        });
        expect(Number(res.pull?.batches?.length) >= 100).toBe(true);
        const snapshot = res.pull?.snapshot as any;
        expect(snapshot).toMatchObject({
          id,
          seq: expect.any(Number),
          ts: expect.any(Number),
          blob: expect.any(Uint8Array),
        });
        const model3 = Model.load(snapshot.blob, 1e7 + 1);
        const length = res.pull!.batches.length;
        for (let i = 0; i < length; i++) {
          const b = res.pull!.batches[i];
          for (const patch of b.patches) model3.applyPatch(Patch.fromBinary(patch.blob));
          expect(b.seq).toBe(snapshot.seq + i + 1);
        }
        expect(model3.view()).toStrictEqual({text: 'Hell', num: 110});
        model3.applyPatch(patch2);
        expect(model3.view()).toStrictEqual({text: 'Hell!', num: 110});
        await stop();
      }, 45000);
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
          await stop();
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
          await stop();
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
          await stop();
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
          await stop();
        });
      });
    }

    describe('block.scan', () => {
      test('can retrieve change history', async () => {
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
        await stop();
      });

      test.todo('can retrieve change history when it was compacted');
    });

    describe('block.pull', () => {
      test('can pull latest changes', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const model = Model.create();
        const patches: Patch[] = [];
        model.api.root({
          text: 'Hell',
        });
        const patch = model.api.flush();
        patches.push(patch);
        await call('block.new', {
          id,
          batch: {
            patches: [
              {
                blob: patch.toBinary(),
              },
            ],
          },
        });
        const setX = async (x: number) => {
          model.api.obj([]).set({x});
          const patch = model.api.flush();
          patches.push(patch);
          await call('block.upd', {
            id,
            batch: {
              patches: [
                {
                  blob: patch.toBinary(),
                },
              ],
            },
          });
        };
        for (let i = 1; i <= 150; i++) await setX(i);
        const block = await call('block.get', {id});
        const model2 = Model.load(block.block.snapshot.blob);
        expect(model2.view()).toStrictEqual({text: 'Hell', x: 150});
        const assertPull = async (seq: number) => {
          const pull = await call('block.pull', {id, seq});
          const model = pull.snapshot ? Model.load(pull.snapshot.blob) : Model.create();
          for (let i = 0; i <= seq; i++) model.applyPatch(patches[i]);
          for (const batch of pull.batches) {
            for (const p of batch.patches) {
              const patch = Patch.fromBinary(p.blob);
              model.applyPatch(patch);
            }
          }
          expect(model.view()).toStrictEqual({text: 'Hell', x: 150});
        };
        for (let i = -1; i <= 150; i++) await assertPull(i);
        await stop();
      }, 60000);

      test('can create a new block, if it does not exist', async () => {
        const {call, stop} = await setup();
        const id = getId();
        const get1 = await of(call('block.get', {id}));
        expect(get1[1]).toMatchObject({code: 'NOT_FOUND'});
        const result = await call('block.pull', {
          id,
          seq: -1,
          create: true,
        });
        expect(result).toMatchObject({
          batches: [],
          snapshot: {
            id,
            seq: -1,
            ts: expect.any(Number),
            blob: expect.any(Uint8Array),
          },
        });
        const model = Model.fromBinary(result.snapshot!.blob);
        expect(model.view()).toBe(undefined);
        expect(model.clock.sid).toBe(SESSION.GLOBAL);
        expect(model.clock.time).toBe(1);
        const get2 = await call('block.get', {id});
        expect(get2).toMatchObject({
          block: {
            snapshot: {
              id,
              seq: -1,
              blob: expect.any(Uint8Array),
              ts: expect.any(Number),
            },
            tip: [],
          },
        });
        const model2 = Model.fromBinary(get2.block.snapshot.blob);
        expect(model2.view()).toBe(undefined);
        expect(model2.clock.sid).toBe(SESSION.GLOBAL);
        expect(model2.clock.time).toBe(1);
        await stop();
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
          },
        });
        await stop();
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
        await stop();
      });
    });
  });
};
