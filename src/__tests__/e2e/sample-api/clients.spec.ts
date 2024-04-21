import {ApiTestSetup, runApiTests} from '../../../common/rpc/__tests__/runApiTests';
import {setupCodecs} from '../codecs';
import {setupRpcPersistentClient, setupFetchRpcClient, setupStreamingRpcClient} from '../clients';

if (process.env.TEST_E2E) {
  describe('RpcPersistentClient', () => {
    const {list} = setupCodecs();
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupRpcPersistentClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runApiTests(setup);
      });
    }
  });

  describe('RpcPersistentClient', () => {
    const {list} = setupCodecs();
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupFetchRpcClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runApiTests(setup, {staticOnly: true});
      });
    }
  });

  describe('FetchRpcClient', () => {
    const {list} = setupCodecs();
    for (const codec of list) {
      const setup: ApiTestSetup = async () => setupStreamingRpcClient(codec);
      describe(`protocol: application/x.${codec.specifier()}`, () => {
        runApiTests(setup, {staticOnly: true});
      });
    }
  });
} else {
  test.skip('set TEST_E2E=1 env var to run this test suite', () => {});
}
