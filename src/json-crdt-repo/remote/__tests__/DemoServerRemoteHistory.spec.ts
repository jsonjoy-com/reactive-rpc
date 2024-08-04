import {Model} from 'json-joy/lib/json-crdt';
import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
import {Value} from 'json-joy/lib/json-type-value/Value';
import {setup} from './setup';

let cnt = 0;
const genId = () => Math.random().toString(36).slice(2) + '-' + Date.now().toString(36) + '-' + cnt++;

describe('.create()', () => {
  test('can create a block with a simple patch', async () => {
    const {remote, caller} = await setup();
    const model = Model.create();
    model.api.root({foo: 'bar'});
    const patch = model.api.flush();
    const blob = patch.toBinary();
    const id = genId();
    await remote.create(id, {
      patches: [
        {blob},
      ]
    });
    const {data} = await caller.call('block.get', {id}, {});
    const model2 = Model.fromBinary(data.block.snapshot.blob);
    expect(model2.view()).toEqual({foo: 'bar'});
  });

//   test('can create with empty model', async () => {
//     const {remote, caller} = await setup();
//     const id = genId();
//     await remote.create(id, []);
//     const {data} = await caller.call('block.get', {id}, {});
//     const model2 = Model.fromBinary(data.snapshot.blob);
//     expect(model2.view()).toBe(undefined);
//   });

//   test('empty model uses global session ID', async () => {
//     const {remote, caller} = await setup();
//     const id = genId();
//     await remote.create(id, []);
//     const {data} = await caller.call('block.get', {id}, {});
//     const model2 = Model.fromBinary(data.snapshot.blob);
//     expect(model2.clock.sid).toBe(SESSION.GLOBAL);
//   });
// });

// describe('.read()', () => {
//   test('can read a block with a simple patch', async () => {
//     const {remote} = await setup();
//     const model = Model.create();
//     model.api.root({score: 42});
//     const patch = model.api.flush();
//     const blob = patch.toBinary();
//     const id = genId();
//     await remote.create(id, [{blob}]);
//     const read = await remote.read(id);
//     expect(read).toMatchObject({
//       block: {
//         id,
//         snapshot: {
//           blob: expect.any(Uint8Array),
//           cur: 0,
//           ts: expect.any(Number),
//         },
//         tip: [],
//       },
//     });
//     const model2 = Model.fromBinary(read.block.snapshot.blob);
//     expect(model2.view()).toEqual({score: 42});
//   });

//   test('throws NOT_FOUND error on missing block', async () => {
//     const {remote} = await setup();
//     const id = genId();
//     try {
//       const read = await remote.read(id);
//       throw new Error('not this error');
//     } catch (error) {
//       expect(error).toMatchObject({
//         message: 'NOT_FOUND',
//       });
//     }
//   });
});

// describe('.update()', () => {
//   test('can apply changes to an empty document', async () => {
//     const {remote} = await setup();
//     const id = genId();
//     await remote.create(id, []);
//     const read1 = await remote.read(id);
//     const model1 = Model.fromBinary(read1.block.snapshot.blob);
//     expect(model1.view()).toBe(undefined);
//     const model = Model.create();
//     model.api.root({score: 42});
//     const patch = model.api.flush();
//     const blob = patch.toBinary();
//     const update = await remote.update(id, [{blob}]);
//     expect(update).toMatchObject({
//       patches: [
//         {
//           ts: expect.any(Number),
//         },
//       ],
//     });
//     const read2 = await remote.read(id);
//     const model2 = Model.fromBinary(read2.block.snapshot.blob);
//     expect(model2.view()).toEqual({score: 42});
//   });

//   test('can create a block using .update() call', async () => {
//     const {remote} = await setup();
//     const id = genId();
//     const model = Model.create();
//     model.api.root({score: 42});
//     const patch = model.api.flush();
//     const blob = patch.toBinary();
//     const update = await remote.update(id, [{blob}]);
//     expect(update).toMatchObject({
//       patches: [
//         {
//           ts: expect.any(Number),
//         },
//       ],
//     });
//     const read = await remote.read(id);
//     const model1 = Model.fromBinary(read.block.snapshot.blob);
//     expect(model1.view()).toEqual({score: 42});
//   });
// });

// describe('.scanFwd()', () => {
//   test('can scan patches forward', async () => {
//     const {remote} = await setup();
//     const id = genId();
//     const model1 = Model.create();
//     model1.api.root({score: 42});
//     const patch1 = model1.api.flush();
//     const blob = patch1.toBinary();
//     await remote.create(id, [{blob}]);
//     const read1 = await remote.read(id);
//     model1.api.obj([]).set({
//       foo: 'bar',
//     });
//     const patch2 = model1.api.flush();
//     const blob2 = patch2.toBinary();
//     await remote.update(id, [{blob: blob2}]);
//     const scan1 = await remote.scanFwd(id, read1.block.snapshot.cur);
//     expect(scan1).toMatchObject({
//       patches: [
//         {
//           blob: expect.any(Uint8Array),
//           ts: expect.any(Number),
//         },
//       ],
//     });
//     expect(scan1.patches[0].blob).toEqual(blob2);
//   });
// });

// describe('.scanBwd()', () => {
//   test('can scan patches backward', async () => {
//     const {remote} = await setup();
//     const id = genId();
//     const model1 = Model.create();
//     model1.api.root({score: 42});
//     const patch1 = model1.api.flush();
//     const blob1 = patch1.toBinary();
//     await remote.create(id, [{blob: blob1}]);
//     const read1 = await remote.read(id);
//     model1.api.obj([]).set({
//       foo: 'bar',
//     });
//     const patch2 = model1.api.flush();
//     const blob2 = patch2.toBinary();
//     await remote.update(id, [{blob: blob2}]);
//     const read2 = await remote.read(id);
//     const scan1 = await remote.scanBwd(id, read2.block.snapshot.cur);
//     expect(scan1.patches.length).toBe(1);
//     expect(scan1).toMatchObject({
//       patches: [
//         {
//           blob: expect.any(Uint8Array),
//           ts: expect.any(Number),
//         },
//       ],
//     });
//     expect(scan1.patches[0].blob).toEqual(blob1);
//   });
// });

// describe('.delete()', () => {
//   test('can delete an existing block', async () => {
//     const {remote, caller} = await setup();
//     const id = genId();
//     await remote.create(id, []);
//     const get1 = await caller.call('block.get', {id}, {});
//     await remote.delete(id);
//     try {
//       const get2 = await caller.call('block.get', {id}, {});
//       throw new Error('not this error');
//     } catch (err) {
//       expect((err as Value<any>).data.message).toBe('NOT_FOUND');
//     }
//   });
// });
