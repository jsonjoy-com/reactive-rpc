import {unknown} from '@jsonjoy.com/json-type';
import {RequestCompleteMessage, ResponseCompleteMessage} from '../../../messages';
import {createBatchProcessor} from './BatchProcessor.fixtures';

describe('.onBatch', () => {
  test('can process a single "ping" call', async () => {
    const {processor, ctx} = createBatchProcessor();
    const msg = new RequestCompleteMessage(1, 'ping');
    const response = await processor.onBatch([msg], ctx);
    expect(response).toEqual([new ResponseCompleteMessage(1, unknown('pong'))]);
  });
});

describe('.onRequest', () => {
  test('can process a single "ping" call', async () => {
    const {processor, ctx} = createBatchProcessor();
    const msg = new RequestCompleteMessage(1, 'ping');
    const response = await processor.onRequest(msg, ctx);
    expect(response).toEqual(new ResponseCompleteMessage(1, unknown('pong')));
  });
});
