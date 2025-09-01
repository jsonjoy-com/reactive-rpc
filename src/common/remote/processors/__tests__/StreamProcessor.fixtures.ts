import {Caller} from '../../../caller';
import {createRpcCaller} from '../../../caller/__tests__/RpcCaller.fixtures';
import {createWsConnectionContext} from '../../context/__tests__/WsConnectionContext.fixtures';
import {WsConnectionContext} from '../../context/WsConnectionContext';
import {StreamProcessor} from '../StreamProcessor';

export const createStreamProcessor = () => {
  const caller = createRpcCaller();
  const {ctx, connection} = createWsConnectionContext();
  const processor = new StreamProcessor<WsConnectionContext>({
    caller: caller as Caller<WsConnectionContext>,
    connection: ctx.connection,
    ctx,
    logger: console,
  });
  return {caller, processor, ctx, connection};
};
