// import {Model, nodes, s} from 'json-joy/lib/json-crdt';
// import {Log} from 'json-joy/lib/json-crdt/log/Log';
// import {BehaviorSubject} from 'rxjs';
// import {setup as remoteSetup} from '../../../remote/__tests__/setup';
// import {tick, until} from 'thingies';
// import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
// import {setup} from './setup';

test.skip('...', () => {});

// describe('.update()', () => {
//   // test('throws on empty log', async () => {
//   //   const kit = await setup();
//   //   const model = Model.create(undefined, kit.sid);
//   //   const emptyLog = Log.fromNewModel(model);
//   //   try {
//   //     await kit.local.create(['collection'], emptyLog, kit.id);
//   //     throw new Error('not this error');
//   //   } catch (err) {
//   //     expect(err).toEqual(new Error('EMPTY_LOG'));
//   //   }
//   // });

//   test('can apply an update patch', async () => {
//     const kit = await setup();
//     await kit.local.create(['collection'], kit.log, kit.id);
//     kit.log.end.api.obj([]).set({
//       x: 123,
//     });
//     await tick(1);
//     const patch = kit.log.end.api.flush();
//     const res = await kit.local.update(['collection'], kit.id, [patch]);
//     await res.remote;
//   });

//   test('stores the update on remote', async () => {
//     const kit = await setup();
//     const patches0 = kit.remote.services.blocks.stats().patches;
//     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//     await res.remote;
//     await until(() => kit.remote.services.blocks.stats().patches > patches0);
//     const patches1 = kit.remote.services.blocks.stats().patches;
//     kit.log.end.api.obj([]).set({
//       x: 123,
//     });
//     await tick(1);
//     const patch = kit.log.end.api.flush();
//     await kit.local.update(['my', 'col'], kit.id, [patch]);
//     await res.remote;
//     await until(() => kit.remote.services.blocks.stats().patches > patches1);
//     const patches2 = kit.remote.services.blocks.stats().patches;
//     expect(patches2 > patches1).toBe(true);
//   });

//   // test('marks item as "tidy" for sync', async () => {
//   //   const kit = await setup();
//   //   const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //   await res.remote;
//   //   const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
//   //   expect(meta).toMatchObject({
//   //     time: 1,
//   //     ts: expect.any(Number),
//   //   });
//   //   const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //   expect(isDirty).toBe(false);
//   // });

//   // test('sends over SESSION.GLOBAL patches', async () => {
//   //   const kit = await setup();
//   //   const schema = s.obj({
//   //     foo: s.str('bar'),
//   //     arr: s.arr<nodes.val<nodes.con<number>>>([]),
//   //   });
//   //   const model = Model.create(undefined, kit.sid).setSchema(schema);
//   //   const log = Log.fromNewModel(model);
//   //   log.end.api.r.get().get('foo').ins(3, '!');
//   //   log.end.api.flush();
//   //   const res = await kit.local.create(['my', 'col'], log, kit.id);
//   //   await res.remote;
//   //   const {block} = await kit.remote.remote.read(['my', 'col', kit.id].join('/'));
//   //   const model2 = Model.fromBinary(block.snapshot.blob).setSchema(schema).fork(kit.sid);
//   //   expect(model2.view()).toEqual({foo: 'bar!', arr: []});
//   //   expect(model2.clock.peers.has(SESSION.GLOBAL)).toBe(true);
//   // });

//   // describe('when not connected', () => {
//   //   const setupNotConnected = () =>
//   //     setup({
//   //       local: {
//   //         connected$: new BehaviorSubject(false),
//   //       },
//   //     });

//   //   test('throws on empty log', async () => {
//   //     const kit = await setupNotConnected();
//   //     const model = Model.create(undefined, kit.sid);
//   //     const emptyLog = Log.fromNewModel(model);
//   //     try {
//   //       await kit.local.create(['collection'], emptyLog, kit.id);
//   //       throw new Error('not this error');
//   //     } catch (err) {
//   //       expect(err).toEqual(new Error('EMPTY_LOG'));
//   //     }
//   //   });

//   //   test('can create a new block', async () => {
//   //     const kit = await setupNotConnected();
//   //     const res = await kit.local.create(['collection'], kit.log, kit.id);
//   //     expect(res).toMatchObject({
//   //       id: kit.id,
//   //       remote: expect.any(Promise),
//   //     });
//   //   });

//   //   test('does not store the block on remote, throws on remote sync', async () => {
//   //     const kit = await setupNotConnected();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //     try {
//   //       await res.remote;
//   //       throw new Error('not this error');
//   //     } catch (error) {
//   //       expect(error).toEqual(new Error('NOT_SYNCED'));
//   //     }
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //   });

//   //   test('marks item as "dirty" for sync', async () => {
//   //     const kit = await setupNotConnected();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     try {
//   //       await res.remote;
//   //     } catch {}
//   //     const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
//   //     expect(meta).toMatchObject({
//   //       time: -1,
//   //       ts: 0,
//   //     });
//   //     const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //     expect(isDirty).toBe(true);
//   //   });
//   // });

//   // describe('when not connected, but connection resumes', () => {
//   //   const setupNotConnected = async () => {
//   //     const connected$ = new BehaviorSubject(false);
//   //     const deps = await setup({
//   //       local: {
//   //         connected$,
//   //         sync: {
//   //           remoteTimeout: 100,
//   //         },
//   //       },
//   //     });
//   //     return {
//   //       ...deps,
//   //       connected$,
//   //     };
//   //   };

//   //   test('does not store the block on remote at first, synchronizes it when connection resumes', async () => {
//   //     const kit = await setupNotConnected();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //     try {
//   //       await res.remote;
//   //       throw new Error('not this error');
//   //     } catch (error) {
//   //       expect(error).toEqual(new Error('NOT_SYNCED'));
//   //     }
//   //     await tick(50);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //     kit.connected$.next(true);
//   //     await until(() => kit.remote.services.blocks.stats().blocks === 1);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(1);
//   //   });
//   // });

//   // describe('when remote call fails', () => {
//   //   const setupFaultyConnection = () => {
//   //     const remote = remoteSetup();
//   //     remote.remote.create = async (...args) => {
//   //       await tick(15);
//   //       throw new Error('Remote call failed');
//   //     };
//   //     remote.remote.update = async (...args) => {
//   //       await tick(15);
//   //       throw new Error('Remote call failed');
//   //     };
//   //     return setup({remote});
//   //   };

//   //   test('throws on empty log', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const model = Model.create(undefined, kit.sid);
//   //     const emptyLog = Log.fromNewModel(model);
//   //     try {
//   //       await kit.local.create(['collection'], emptyLog, kit.id);
//   //       throw new Error('not this error');
//   //     } catch (err) {
//   //       expect(err).toEqual(new Error('EMPTY_LOG'));
//   //     }
//   //   });

//   //   test('can create a new block', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['collection'], kit.log, kit.id);
//   //     expect(res).toMatchObject({
//   //       id: kit.id,
//   //       remote: expect.any(Promise),
//   //     });
//   //   });

//   //   test('does not store the block on remote, throws on remote sync', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //     try {
//   //       await res.remote;
//   //       throw new Error('not this error');
//   //     } catch (error) {
//   //       expect(error).toEqual(new Error('Remote call failed'));
//   //     }
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //   });

//   //   test('marks item as "dirty" for sync', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     try {
//   //       await res.remote;
//   //     } catch {}
//   //     const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
//   //     expect(meta).toMatchObject({
//   //       time: -1,
//   //       ts: 0,
//   //     });
//   //     const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //     expect(isDirty).toBe(true);
//   //   });
//   // });

//   // describe('when remote call times out hard', () => {
//   //   const setupFaultyConnection = () => {
//   //     const remote = remoteSetup();
//   //     const create = remote.remote.create.bind(remote.remote);
//   //     remote.remote.create = async (...args) => {
//   //       await tick(500);
//   //       throw new Error('something went wrong');
//   //     };
//   //     remote.remote.update = async (...args) => {
//   //       await tick(500);
//   //       throw new Error('something went wrong');
//   //     };
//   //     return setup({
//   //       remote,
//   //       local: {
//   //         sync: {
//   //           remoteTimeout: 100,
//   //         },
//   //       },
//   //     });
//   //   };

//   //   test('throws on empty log', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const model = Model.create(undefined, kit.sid);
//   //     const emptyLog = Log.fromNewModel(model);
//   //     try {
//   //       await kit.local.create(['collection'], emptyLog, kit.id);
//   //       throw new Error('not this error');
//   //     } catch (err) {
//   //       expect(err).toEqual(new Error('EMPTY_LOG'));
//   //     }
//   //   });

//   //   test('can create a new block', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['collection'], kit.log, kit.id);
//   //     expect(res).toMatchObject({
//   //       id: kit.id,
//   //       remote: expect.any(Promise),
//   //     });
//   //   });

//   //   test('does not store the block on remote, throws on remote sync', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //     try {
//   //       await res.remote;
//   //       throw new Error('not this error');
//   //     } catch (error) {
//   //       expect(error).toEqual(new Error('TIMEOUT'));
//   //     }
//   //     expect(kit.remote.services.blocks.stats().blocks).toBe(0);
//   //   });

//   //   test('marks item as "dirty" for sync', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     try {
//   //       await res.remote;
//   //     } catch {}
//   //     const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
//   //     expect(meta).toMatchObject({
//   //       time: -1,
//   //       ts: 0,
//   //     });
//   //     const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //     expect(isDirty).toBe(true);
//   //   });
//   // });

//   // describe('when remote call times out, but operation succeeds', () => {
//   //   const setupFaultyConnection = () => {
//   //     const remote = remoteSetup();
//   //     const create = remote.remote.create.bind(remote.remote);
//   //     remote.remote.create = async (...args) => {
//   //       await tick(200);
//   //       return create(...args);
//   //     };
//   //     remote.remote.update = async (...args) => {
//   //       await tick(200);
//   //       return create(...args);
//   //     };
//   //     return setup({
//   //       remote,
//   //       local: {
//   //         sync: {
//   //           remoteTimeout: 100,
//   //         },
//   //       },
//   //     });
//   //   };

//   //   test('throws on empty log', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const model = Model.create(undefined, kit.sid);
//   //     const emptyLog = Log.fromNewModel(model);
//   //     try {
//   //       await kit.local.create(['collection'], emptyLog, kit.id);
//   //       throw new Error('not this error');
//   //     } catch (err) {
//   //       expect(err).toEqual(new Error('EMPTY_LOG'));
//   //     }
//   //   });

//   //   test('can create a new block', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['collection'], kit.log, kit.id);
//   //     expect(res).toMatchObject({
//   //       id: kit.id,
//   //       remote: expect.any(Promise),
//   //     });
//   //   });

//   //   test('marks item as "dirty" for sync, but synchronizes over time', async () => {
//   //     const kit = await setupFaultyConnection();
//   //     const res = await kit.local.create(['my', 'col'], kit.log, kit.id);
//   //     try {
//   //       await res.remote;
//   //     } catch {}
//   //     const meta = await kit.local.sync.getMeta(['my', 'col'], kit.id);
//   //     expect(meta).toMatchObject({
//   //       time: -1,
//   //       ts: 0,
//   //     });
//   //     const isDirty = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //     expect(isDirty).toBe(true);
//   //     await until(async () => await kit.local.sync.isDirty(['my', 'col'], kit.id) === false);
//   //     const isDirty2 = await kit.local.sync.isDirty(['my', 'col'], kit.id);
//   //     expect(isDirty2).toBe(false);
//   //   });
//   // });
// });
