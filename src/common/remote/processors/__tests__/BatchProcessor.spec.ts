import {unknown} from '@jsonjoy.com/json-type';
import {
  RequestCompleteMessage,
  ResponseCompleteMessage,
  RequestDataMessage,
  RequestErrorMessage,
  NotificationMessage,
  ResponseErrorMessage,
} from '../../../messages';
import {createBatchProcessor} from './BatchProcessor.fixtures';

describe('BatchProcessor', () => {
  describe('.onBatch', () => {
    test('can process a single "ping" call', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'ping');
      const response = await processor.onBatch([msg], ctx);
      expect(response).toEqual([new ResponseCompleteMessage(1, unknown('pong'))]);
    });

    test('can process multiple requests in a batch', async () => {
      const {processor, ctx} = createBatchProcessor();
      const messages = [
        new RequestCompleteMessage(1, 'ping'),
        new RequestCompleteMessage(2, 'getIp'),
        new RequestCompleteMessage(3, 'getValue'),
      ];
      const responses = await processor.onBatch(messages, ctx);
      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual(new ResponseCompleteMessage(1, unknown('pong')));
      expect(responses[1]).toEqual(new ResponseCompleteMessage(2, unknown({ip: '127.0.0.1'})));
      expect(responses[2]).toEqual(new ResponseCompleteMessage(3, unknown({value: 0})));
    });

    test('can process RequestDataMessage', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestDataMessage(1, 'double', unknown({num: 5}));
      const response = await processor.onBatch([msg], ctx);
      expect(response).toEqual([new ResponseCompleteMessage(1, unknown({num: 10}))]);
    });

    test('can process RequestErrorMessage', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestErrorMessage(1, 'ping', unknown({error: 'test error'}));
      const response = await processor.onBatch([msg], ctx);
      expect(response).toEqual([new ResponseCompleteMessage(1, unknown('pong'))]);
    });

    test('handles notifications without returning responses', async () => {
      const {processor, caller, ctx} = createBatchProcessor();

      // Reset the value first
      await caller.notify('notificationSetValue', {value: 0}, ctx);

      const notification = new NotificationMessage('notificationSetValue', unknown({value: 42}));
      const request = new RequestCompleteMessage(1, 'getValue');
      const responses = await processor.onBatch([notification, request], ctx);

      // Should only get response for the request, not the notification
      expect(responses).toHaveLength(1);
      expect(responses[0]).toEqual(new ResponseCompleteMessage(1, unknown({value: 42})));
    });

    test('handles mixed message types in batch', async () => {
      const {processor, caller, ctx} = createBatchProcessor();

      // Reset the value first
      await caller.notify('notificationSetValue', {value: 0}, ctx);

      const messages = [
        new NotificationMessage('notificationSetValue', unknown({value: 100})),
        new RequestCompleteMessage(1, 'ping'),
        new RequestDataMessage(2, 'double', unknown({num: 10})),
        new RequestCompleteMessage(3, 'getValue'),
      ];
      const responses = await processor.onBatch(messages, ctx);

      // Should get 3 responses (excluding notification)
      expect(responses).toHaveLength(3);
      expect(responses[0]).toEqual(new ResponseCompleteMessage(1, unknown('pong')));
      expect(responses[1]).toEqual(new ResponseCompleteMessage(2, unknown({num: 20})));
      expect(responses[2]).toEqual(new ResponseCompleteMessage(3, unknown({value: 100})));
    });

    test('handles errors gracefully', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'error');
      const responses = await processor.onBatch([msg], ctx);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toBeInstanceOf(ResponseErrorMessage);
    });

    test('processes empty batch', async () => {
      const {processor, ctx} = createBatchProcessor();
      const responses = await processor.onBatch([], ctx);
      expect(responses).toEqual([]);
    });

    test('handles invalid method names', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'nonexistentMethod');
      const responses = await processor.onBatch([msg], ctx);
      expect(responses).toHaveLength(1);
      expect(responses[0]).toBeInstanceOf(ResponseErrorMessage);
    });
  });

  describe('.onRequest', () => {
    test('can process a single "ping" call', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'ping');
      const response = await processor.onRequest(msg, ctx);
      expect(response).toEqual(new ResponseCompleteMessage(1, unknown('pong')));
    });

    test('can process RequestDataMessage', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestDataMessage(2, 'double', unknown({num: 5}));
      const response = await processor.onRequest(msg, ctx);
      expect(response).toEqual(new ResponseCompleteMessage(2, unknown({num: 10})));
    });

    test('can process RequestErrorMessage', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestErrorMessage(3, 'getIp', unknown({error: 'test'}));
      const response = await processor.onRequest(msg, ctx);
      expect(response).toEqual(new ResponseCompleteMessage(3, unknown({ip: '127.0.0.1'})));
    });

    test('handles method with undefined payload', async () => {
      const {processor, caller, ctx} = createBatchProcessor();

      // Reset the value to a known state
      await caller.notify('notificationSetValue', {value: 0}, ctx);

      const msg = new RequestCompleteMessage(1, 'getValue');
      const response = await processor.onRequest(msg, ctx);
      expect(response).toEqual(new ResponseCompleteMessage(1, unknown({value: 0})));
    });

    test('throws ResponseErrorMessage for invalid methods', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'invalidMethod');

      await expect(processor.onRequest(msg, ctx)).rejects.toBeInstanceOf(ResponseErrorMessage);
    });

    test('throws ResponseErrorMessage when procedure throws error', async () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new RequestCompleteMessage(1, 'error');

      await expect(processor.onRequest(msg, ctx)).rejects.toBeInstanceOf(ResponseErrorMessage);
    });
  });

  describe('.onNotification', () => {
    test('can process notification without throwing', () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new NotificationMessage('notificationSetValue', unknown({value: 123}));

      // Should not throw
      expect(() => processor.onNotification(msg, ctx)).not.toThrow();
    });

    test('can process notification with undefined value', () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new NotificationMessage('ping');

      // Should not throw
      expect(() => processor.onNotification(msg, ctx)).not.toThrow();
    });

    test('handles invalid notification methods gracefully', () => {
      const {processor, ctx} = createBatchProcessor();
      const msg = new NotificationMessage('invalidNotificationMethod', unknown({data: 'test'}));

      // Should not throw even for invalid methods (notifications are fire-and-forget)
      expect(() => processor.onNotification(msg, ctx)).not.toThrow();
    });
  });
});
