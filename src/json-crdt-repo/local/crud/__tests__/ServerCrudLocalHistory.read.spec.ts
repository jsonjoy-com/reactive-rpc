// import {Model, nodes, s} from 'json-joy/lib/json-crdt';
// import {Log} from 'json-joy/lib/json-crdt/log/Log';
// import {BehaviorSubject} from 'rxjs';
// import {setup as remoteSetup} from '../../../remote/__tests__/setup';
// import {tick, until} from 'thingies';
// import {SESSION} from 'json-joy/lib/json-crdt-patch/constants';
// import {setup} from './setup';

// describe('.read()', () => {
//   test('can read new block', async () => {
//     const kit = await setup();
//     await kit.local.create(['collection'], kit.log, kit.id);
//     const res = await kit.local.read(['collection'], kit.id);
//     expect(res.log.end.view()).toEqual(kit.log.end.view());
//   });

//   test('can read a model even if it was not synced to remote', async () => {
//     const kit = await setup();
//     const {local: local2} = kit.createLocal();
//     await local2.create(['collection'], kit.log, kit.id);
//     const res = await local2.read(['collection'], kit.id);
//     expect(res.log.end.view()).toEqual(kit.log.end.view());
//     const res2 = await kit.local.read(['collection'], kit.id);
//     expect(res2.log.end.view()).toEqual(kit.log.end.view());
//   });

//   test.skip('can read block created by remote', async () => {
    
//   });

//   test.skip('adopts local session ID, when reading model from remote', async () => {
    
//   });
// });

test.skip('...', () => {});
