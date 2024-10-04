import type {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';
import {runUtilTests} from '../../json-crdt-server/util';
import {runPubsubTests} from '../../json-crdt-server/pubsub';
import {runPresenceTests} from '../../json-crdt-server/presence';
import {runBlockTests} from '../../json-crdt-server/block';
import {cborCodec} from '../codecs';
import {
  setupDemoServerPersistentClient,
  setupDemoServerFetchClient,
  setupDemoServerStreamingClient,
} from '../demo-client';

if (process.env.TEST_E2E && process.env.TEST_E2E_DEMO_SERVER) {
  describe('RpcPersistentClient', () => {
    const codec = cborCodec();
    const setup: ApiTestSetup = async () => setupDemoServerPersistentClient(codec);
    describe(`protocol: application/x.${codec.specifier()}`, () => {
      runUtilTests(setup);
      runPubsubTests(setup);
      runPresenceTests(setup);
      runBlockTests(setup);
    });
  });

  describe('FetchRpcClient', () => {
    const codec = cborCodec();
    const setup: ApiTestSetup = async () => setupDemoServerFetchClient(codec);
    describe(`protocol: application/x.${codec.specifier()}`, () => {
      runUtilTests(setup);
      runPubsubTests(setup, {staticOnly: true});
      runPresenceTests(setup, {staticOnly: true});
      runBlockTests(setup, {staticOnly: true});
    });
  });

  describe('StreamingRpcClient', () => {
    const codec = cborCodec();
    const setup: ApiTestSetup = async () => setupDemoServerStreamingClient(codec);
    describe(`protocol: application/x.${codec.specifier()}`, () => {
      runUtilTests(setup);
      runPubsubTests(setup, {staticOnly: true});
      runPresenceTests(setup, {staticOnly: true});
      runBlockTests(setup, {staticOnly: true});
    });
  });
} else {
  test.skip('set TEST_E2E=1 env var to run this test suite', () => {});
}
