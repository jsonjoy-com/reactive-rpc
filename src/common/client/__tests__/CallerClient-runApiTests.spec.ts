import {createRpcCaller} from '../../caller/__tests__/RpcCaller.fixtures';
import {runApiTests} from './runApiTests';
import {CallerClient} from '../CallerClient';

runApiTests(async () => {
  const caller = createRpcCaller();
  const ctx = {ip: '127.0.0.1'};
  const client = new CallerClient(caller, ctx);
  return {client, stop: async () => {} };
}, {
  skipValidationTests: true,
});
