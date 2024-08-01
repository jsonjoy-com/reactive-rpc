// import {Model, s, NodeBuilder, Patch} from 'json-joy/lib/json-crdt';
// import {setup} from './setup';

// const META_FILE = 'meta.seq.cbor';

// describe('.sync()', () => {
//   describe('create', () => {
//     test('can create a new block', async () => {
//       const kit = await setup();
//       const model = Model.create(undefined, kit.sid);
//       model.api.root({foo: 'bar'});
//       const patches = [model.api.flush()];
//       await kit.local.sync({
//         col: ['collection'],
//         id: kit.id,
//         batch: patches,
//       });
//       expect(kit.vol.toJSON()).toMatchObject({
//         [`/blocks/collection/${kit.id}/${META_FILE}`]: expect.any(String),
//       });
//     });

//     const testCreateAndMerge = async (schema: undefined | NodeBuilder) => {
//       const kit = await setup();
//       const local2 = kit.createLocal();
//       const model1 = Model.create(schema, kit.sid);
//       const patches1: Patch[] = [];
//       if (model1.api.builder.patch.ops.length) {
//         patches1.push(model1.api.flush());
//       }
//       model1.api.root({foo: 'bar'});
//       patches1.push(model1.api.flush());
//       await kit.local.sync({
//         col: ['collection'],
//         id: kit.id,
//         batch: patches1,
//       });
//       const metaFile = `/blocks/collection/${kit.id}/${META_FILE}`;
//       const frontier1 = kit.vol.toJSON()[metaFile] as string;
//       expect(kit.vol.toJSON()).toMatchObject({
//         [metaFile]: expect.any(String),
//       });
//       const model2 = Model.create(schema, kit.sid);
//       const patches2: Patch[] = [];
//       if (model2.api.builder.patch.ops.length) {
//         patches2.push(model2.api.flush());
//       }
//       model2.api.root({foo: 'baz'});
//       patches2.push(model2.api.flush());
//       await local2.local.sync({
//         col: ['collection'],
//         id: kit.id,
//         batch: patches2,
//       });
//       const frontier2 = kit.vol.toJSON()[metaFile] as string;
//       expect(kit.vol.toJSON()).toMatchObject({
//         [metaFile]: expect.any(String),
//       });
//       expect(frontier2.length > frontier1.length).toBe(true);
//       const {model} = await kit.local.sync({
//         col: ['collection'],
//         id: kit.id,
//       });
//       expect(model?.view()).toEqual({foo: 'baz'});
//     };

//     test('can merge new block patches, with concurrently created same-ID block from another tab', async () => {
//       await testCreateAndMerge(undefined);
//     });

//     test('can merge new block patches, with concurrently created same-ID block from another tab (with schema)', async () => {
//       const schema = s.obj({});
//       await testCreateAndMerge(schema);
//     });

//     test.todo('test merge on create with multiple patches');
//     test.todo('test merge on create with remote Model already available');
//   });
// });

test.skip('...', () => {});
