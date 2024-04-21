import {runUtilTests} from '../../../__tests__/json-crdt-server/util';
import {setup} from './setup';
import type {ApiTestSetup} from '../../../common/rpc/__tests__/runApiTests';

runUtilTests(setup as ApiTestSetup);
