import {runPresenceTests} from '../../../__tests__/json-crdt-server/presence';
import {setup} from './setup';
import type {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';

runPresenceTests(setup as ApiTestSetup);
