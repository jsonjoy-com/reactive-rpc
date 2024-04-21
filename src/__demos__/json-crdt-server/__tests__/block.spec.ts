import {setup} from './setup';
import {runBlockTests} from '../../../__tests__/json-crdt-server/block';
import type {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';

runBlockTests(setup as ApiTestSetup);
