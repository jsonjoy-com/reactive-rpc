// import {memfs} from 'memfs';
// import {NodeCrud} from 'memfs/lib/node-to-crud';
// import {Locks} from 'thingies/lib/Locks';
// import {ServerCrudLocalHistory} from '../local/crud/ServerCrudLocalHistory';
// import {setup as remoteSetup} from '../remote/__tests__/setup';
// import {Model} from 'json-joy/lib/json-crdt';
// import {Log} from 'json-joy/lib/json-crdt/log/Log';
// import {BehaviorSubject} from 'rxjs';

// const setup = async () => {
//   const {fs, vol} = memfs();
//   const crud = new NodeCrud({fs: fs.promises, dir: '/'});
//   const locks = new Locks();
//   const {remote} = remoteSetup();
//   const local = new ServerCrudLocalHistory({
//     crud,
//     locks,
//     remote,
//     sid: 123456788,
//     connected$: new BehaviorSubject(true),
//   });
//   return {
//     fs,
//     vol,
//     crud,
//     locks,
//     local,
//   };
// };

// describe.skip('LocalHistoryCrud', () => {
//   test('can create a new document', async () => {
//     const {local} = await setup();
//     const model = Model.withLogicalClock();
//     model.api.root({
//       foo: 'spam',
//     });
//     const log = Log.fromNewModel(model);
//     const {id} = await local.create(['test'], log);
//     expect(typeof id).toBe('string');
//     expect(id.length > 6).toBe(true);
//     const {log: log2} = await local.read(['test'], id);
//     expect(log2.end.view()).toStrictEqual({foo: 'spam'});
//   });

//   test('throws on non-existing document', async () => {
//     const {local} = await setup();
//     try {
//       await local.read(['test'], 'asdfasdf');
//       throw new Error('FAIL');
//     } catch (err) {
//       expect((err as Error).message).toBe('Collection /test/asdfasdf does not exist');
//     }
//   });

//   test('can delete a document', async () => {
//     const {local} = await setup();
//     const model = Model.withLogicalClock();
//     model.api.root({
//       foo: 'spam',
//     });
//     const log = Log.fromNewModel(model);
//     const {id} = await local.create(['test'], log);
//     await local.read(['test'], id);
//     await local.delete(['test'], id);
//     try {
//       await local.read(['test'], id);
//       throw new Error('FAIL');
//     } catch (err) {
//       expect((err as Error).message).toBe(`Collection /test/${id} does not exist`);
//     }
//   });

//   test('can update document', async () => {
//     const {local} = await setup();
//     const model = Model.withLogicalClock();
//     model.api.root({
//       foo: 'spam',
//     });
//     const log = Log.fromNewModel(model);
//     const {id} = await local.create(['test'], log);
//     const {log: log2} = await local.read(['test'], id);
//     log2.end.api.obj([]).set({
//       bar: 'eggs',
//     });
//     const patch = log2.end.api.flush();
//     await local.update(['test'], id, [patch]);
//     const {log: log3} = await local.read(['test'], id);
//     expect(log3.end.view()).toStrictEqual({
//       foo: 'spam',
//       bar: 'eggs',
//     });
//   });

//   test('can delete document', async () => {
//     const {local} = await setup();
//     const model = Model.withLogicalClock();
//     model.api.root({
//       foo: 'spam',
//     });
//     const log = Log.fromNewModel(model);
//     const {id} = await local.create(['test'], log);
//     await local.read(['test'], id);
//     await local.delete(['test'], id);
//     expect(() => local.read(['test'], id)).rejects.toThrow(`Collection /test/${id} does not exist`);
//   });
// });

test.skip('...', () => {});
