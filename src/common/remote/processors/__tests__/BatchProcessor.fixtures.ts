import {createRpcCaller, SampleCtx} from '../../../caller/__tests__/RpcCaller.fixtures';
import {BatchProcessor} from '../BatchProcessor';

export const createBatchProcessor = () => {
  const ctx: SampleCtx = {ip: '127.0.0.1'};
  const caller = createRpcCaller();
  const processor = new BatchProcessor({caller});
  return {caller, processor, ctx};
};
