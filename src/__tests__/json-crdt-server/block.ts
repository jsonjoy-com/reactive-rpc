import {Model} from 'json-joy/lib/json-crdt';
import {RpcErrorCodes} from '../../common/rpc/caller';
import {tick, until} from 'thingies';
import type {ApiTestSetup} from '../../common/rpc/__tests__/runApiTests';
import type {JsonCrdtTestSetup} from '../../__demos__/json-crdt-server/__tests__/setup';

const sid = Math.random().toString(36).slice(2);
let seq = 0;
const getId = () => `${sid}-${Date.now().toString(36)}-${seq++}`;

export const runBlockTests = (_setup: ApiTestSetup, params: {staticOnly?: true} = {}) => {
  const setup = _setup as JsonCrdtTestSetup;

  describe('block.*', () => {
    describe('block.new', () => {
      test('can create an empty block', async () => {
        const {call} = await setup();
        const id = getId();
        await call('block.new', {id, patches: []});
        const {model} = await call('block.get', {id});
        expect(model).toMatchObject({
          id,
          seq: -1,
          blob: expect.any(Uint8Array),
          created: expect.any(Number),
          updated: expect.any(Number),
        });
        const model2 = Model.fromBinary(model.blob);
        expect(model2.view()).toBe(undefined);
      });

      test('can create a block with value', async () => {
        const {call} = await setup();
        const model = Model.withLogicalClock();
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
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
            {
              blob: patch2.toBinary(),
            },
          ],
        });
        const res = await call('block.get', {id});
        expect(res.model).toMatchObject({
          id,
          seq: 1,
          blob: expect.any(Uint8Array),
          created: expect.any(Number),
          updated: expect.any(Number),
        });
        const model2 = Model.fromBinary(res.model.blob);
        expect(model2.view()).toStrictEqual({
          name: 'Super Woman',
          age: 26,
        });
      });
    });

    describe('block.remove', () => {
      test('can remove an existing block', async () => {
        const {call} = await setup();
        const id = getId();
        await call('block.new', {id, patches: []});
        const {model} = await call('block.get', {id});
        expect(model.id).toBe(id);
        await call('block.del', {id});
        try {
          await call('block.get', {id});
          throw new Error('not this error');
        } catch (err: any) {
          expect(err.errno).toBe(RpcErrorCodes.NOT_FOUND);
        }
      });
    });

    describe('block.upd', () => {
      test('can edit a document sequentially', async () => {
        const {call} = await setup();
        const id = getId();
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
          ],
        });
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.str(['text']).ins(5, ' World');
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: Date.now(),
              blob: patch3.toBinary(),
            },
          ],
        });
        const block2 = await call('block.get', {id});
        expect(Model.fromBinary(block2.model.blob).view()).toStrictEqual({
          text: 'Hello World',
        });
        model.api.str(['text']).del(5, 1).ins(5, ', ');
        const patch4 = model.api.flush();
        model.api.str(['text']).ins(12, '!');
        const patch5 = model.api.flush();
        await call('block.upd', {
          id,
          patches: [
            {
              seq: 3,
              created: Date.now(),
              blob: patch4.toBinary(),
            },
            {
              seq: 4,
              created: Date.now(),
              blob: patch5.toBinary(),
            },
          ],
        });
        const block3 = await call('block.get', {id});
        expect(Model.fromBinary(block3.model.blob).view()).toStrictEqual({
          text: 'Hello, World!',
        });
      });

      test('can edit a document concurrently', async () => {
        const {call} = await setup();
        const id = getId();

        // User 1
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
          ],
        });

        // User 2
        const block2 = await call('block.get', {id});
        const model2 = Model.fromBinary(block2.model.blob).fork();
        model2.api.str(['text']).ins(4, ' yeah!');
        const patch2User2 = model2.api.flush();
        await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2User2.toBinary(),
            },
          ],
        });
        expect(model2.view()).toStrictEqual({text: 'Hell yeah!'});

        const block3 = await call('block.get', {id});
        const model3 = Model.fromBinary(block3.model.blob).fork();
        expect(model3.view()).toStrictEqual({text: 'Hell yeah!'});

        // User 1
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.str(['text']).ins(5, ' World');
        const patch3 = model.api.flush();
        const {patches} = await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: Date.now(),
              blob: patch3.toBinary(),
            },
          ],
        });

        const block4 = await call('block.get', {id});
        const model4 = Model.fromBinary(block4.model.blob).fork();
        expect(model4.view()).not.toStrictEqual({text: 'Hell yeah!'});
      });

      test('returns patches that happened concurrently', async () => {
        const {call} = await setup();
        const id = getId();

        // User 1
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
          ],
        });

        // User 2
        const block2 = await call('block.get', {id});
        const model2 = Model.fromBinary(block2.model.blob).fork();
        model2.api.str(['text']).ins(4, ' yeah!');
        const patch2User2 = model2.api.flush();
        await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2User2.toBinary(),
            },
          ],
        });

        // User 1
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.str(['text']).ins(5, ' World');
        const patch3 = model.api.flush();
        const {patches} = await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: Date.now(),
              blob: patch3.toBinary(),
            },
          ],
        });
        expect(patches.length).toBe(3);
        expect(patches[0].seq).toBe(1);
        expect(patches[1].seq).toBe(2);
        expect(patches[2].seq).toBe(3);
        expect(patches[1].blob).toStrictEqual(patch2.toBinary());
        expect(patches[2].blob).toStrictEqual(patch3.toBinary());
      });
    });

    if (!params.staticOnly) {
      describe('block.listen', () => {
        test('can listen for block changes', async () => {
          const {call, call$} = await setup();
          const id = getId();
          await call('block.new', {id, patches: []});
          await tick(11);
          const emits: any[] = [];
          call$('block.listen', {id}).subscribe((data) => emits.push(data));
          const model = Model.withLogicalClock();
          model.api.root({
            text: 'Hell',
          });
          const patch1 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(0);
          await call('block.upd', {
            id,
            patches: [{seq: 0, created: Date.now(), blob: patch1.toBinary()}],
          });
          await until(() => emits.length === 1);
          expect(emits.length).toBe(1);
          expect(emits[0][0]).toBe('upd');
          expect(emits[0][1].patches.length).toBe(1);
          expect(emits[0][1].patches[0].seq).toBe(0);
          model.api.root({
            text: 'Hello',
          });
          const patch2 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(1);
          await call('block.upd', {
            id,
            patches: [{seq: 1, created: Date.now(), blob: patch2.toBinary()}],
          });
          await until(() => emits.length === 2);
          expect(emits.length).toBe(2);
          expect(emits[1][0]).toBe('upd');
          expect(emits[1][1].patches.length).toBe(1);
          expect(emits[1][1].patches[0].seq).toBe(1);
        });

        test('can subscribe before block is created', async () => {
          const {call, call$} = await setup();
          const emits: any[] = [];
          const id = getId();
          call$('block.listen', {id}).subscribe((data) => emits.push(data));
          const model = Model.withLogicalClock();
          model.api.root({
            text: 'Hell',
          });
          const patch1 = model.api.flush();
          await tick(12);
          expect(emits.length).toBe(0);
          await call('block.new', {
            id,
            patches: [
              {
                blob: patch1.toBinary(),
              },
            ],
          });
          await until(() => emits.length === 1);
          expect(emits.length).toBe(1);
          expect(emits[0][0]).toBe('upd');
          expect(emits[0][1].patches.length).toBe(1);
          expect(emits[0][1].patches[0].seq).toBe(0);
          expect(emits[0][1].patches[0].blob).toStrictEqual(patch1.toBinary());
        });

        test('can receive deletion events', async () => {
          const {call, call$} = await setup();
          const emits: any[] = [];
          const id = getId();
          call$('block.listen', {id}).subscribe((data) => {
            emits.push(data);
          });
          await call('block.new', {id, patches: []});
          await until(() => emits.length === 1);
          expect(emits[0][1].model.seq).toBe(-1);
          await tick(3);
          await call('block.del', {id});
          await until(() => emits.length === 2);
          expect(emits[1][0]).toBe('del');
        });
      });
    }

    describe('block.scan', () => {
      test('can retrieve change history', async () => {
        const {call} = await setup();
        const id = getId();
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
          ],
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
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: Date.now(),
              blob: patch3.toBinary(),
            },
          ],
        });
        const history = await call('block.scan', {id, seq: 0, limit: 3});
        expect(history).toMatchObject({
          patches: [
            {
              seq: 0,
              created: expect.any(Number),
              blob: patch1.toBinary(),
            },
            {
              seq: 1,
              created: expect.any(Number),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: expect.any(Number),
              blob: patch3.toBinary(),
            },
          ],
        });
      });
    });

    describe('block.get', () => {
      test('returns whole history when block is loaded', async () => {
        const {call} = await setup();
        const id = getId();
        const model = Model.withLogicalClock();
        model.api.root({
          text: 'Hell',
        });
        const patch1 = model.api.flush();
        await call('block.new', {
          id,
          patches: [
            {
              blob: patch1.toBinary(),
            },
          ],
        });
        model.api.str(['text']).ins(4, 'o');
        const patch2 = model.api.flush();
        model.api.obj([]).set({
          age: 26,
        });
        const patch3 = model.api.flush();
        await call('block.upd', {
          id,
          patches: [
            {
              seq: 1,
              created: Date.now(),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: Date.now(),
              blob: patch3.toBinary(),
            },
          ],
        });
        const result = await call('block.get', {id, history: true});
        expect(result).toMatchObject({
          model: {
            id,
            seq: 2,
            blob: expect.any(Uint8Array),
            created: expect.any(Number),
            updated: expect.any(Number),
          },
          patches: [
            {
              seq: 0,
              created: expect.any(Number),
              blob: patch1.toBinary(),
            },
            {
              seq: 1,
              created: expect.any(Number),
              blob: patch2.toBinary(),
            },
            {
              seq: 2,
              created: expect.any(Number),
              blob: patch3.toBinary(),
            },
          ],
        });
      });
    });
  });
};