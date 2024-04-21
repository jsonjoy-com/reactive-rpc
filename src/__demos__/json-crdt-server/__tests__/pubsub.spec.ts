import {runPubsubTests} from '../../../__tests__/json-crdt-server/pubsub';
import {setup} from './setup';
import type {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';

runPubsubTests(setup as ApiTestSetup);
