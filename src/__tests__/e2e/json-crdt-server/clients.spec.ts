import {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';
import {runUtilTests} from '../../json-crdt-server/util';
import {runPubsubTests} from '../../json-crdt-server/pubsub';
import {runPresenceTests} from '../../json-crdt-server/presence';
import {runBlockTests} from '../../json-crdt-server/block';
import {setupCodecs} from '../codecs';
import {setupRpcPersistentClient, setupFetchRpcClient, setupStreamingRpcClient} from '../clients';

if (process.env.TEST_E2E) {
  describe('RpcPersistentClient', () => {
    const {list} = setupCodecs({skipJson2: true});
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupRpcPersistentClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runUtilTests(setup);
        runPubsubTests(setup);
        runPresenceTests(setup);
        runBlockTests(setup);
      });
    }
  });

  describe('RpcPersistentClient', () => {
    const {list} = setupCodecs();
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupFetchRpcClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runUtilTests(setup, {staticOnly: true});
        runPubsubTests(setup, {staticOnly: true});
        runPresenceTests(setup, {staticOnly: true});
        runBlockTests(setup, {staticOnly: true});
      });
      break;
    }
  });

  describe('FetchRpcClient', () => {
    const {list} = setupCodecs();
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupStreamingRpcClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runUtilTests(setup, {staticOnly: true});
        runPubsubTests(setup, {staticOnly: true});
        runPresenceTests(setup, {staticOnly: true});
        runBlockTests(setup, {staticOnly: true});
      });
    }
  });
} else {
  test.skip('set TEST_E2E=1 env var to run this test suite', () => {});
}
