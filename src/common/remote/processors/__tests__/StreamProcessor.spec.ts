import {until} from "thingies";
import {unknown} from '@jsonjoy.com/json-type';
import {CompactMessageType, CompactRequestCompleteMessage} from "../../../codec/compact";
import {
  RequestCompleteMessage,
  RequestDataMessage,
  NotificationMessage,
} from '../../../messages';
import {createStreamProcessor} from "./StreamProcessor.fixtures";

describe('StreamProcessor', () => {
  test('can execute a basic RPC call', async () => {
    const {connection} = createStreamProcessor();
    const msg: CompactRequestCompleteMessage = [CompactMessageType.RequestComplete, 1, 'ping'];
    const uint8 = new TextEncoder().encode(JSON.stringify(msg));
    connection.simulateMessage(uint8);
    await until(() => connection.sentData.length === 1);
    const [uint8Back] = connection.sentData;
    const text = new TextDecoder().decode(uint8Back);
    const decoded = JSON.parse(text);
    expect(decoded).toEqual([[CompactMessageType.ResponseComplete, 1, 'pong']]);
  });

  describe('.onMessage', () => {
    test('can process a single "ping" call', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      const msg = new RequestCompleteMessage(1, 'ping');

      processor.onMessage(msg, ctx);

      await until(() => connection.sentData.length === 1);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded).toContainEqual([CompactMessageType.ResponseComplete, 1, 'pong']);
    });

    test('can process RequestDataMessage', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      const msg = new RequestDataMessage(1, 'double', unknown({num: 5}));

      processor.onMessage(msg, ctx);

      await until(() => connection.sentData.length === 1);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded).toContainEqual([CompactMessageType.ResponseComplete, 1, {num: 10}]);
    });

    test('handles validation errors', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      const msg = new RequestDataMessage(1, 'double', unknown({invalidField: 'not a number'}));
      processor.onMessage(msg, ctx);
      await until(() => connection.sentData.length === 1);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded[0][0]).toBe(CompactMessageType.ResponseError);
      expect(decoded[0][1]).toBe(1);
      expect(decoded[0][2]).toMatchObject({
        message: 'Payload .num field missing.',
        code: 'BAD_REQUEST',
      });
    });

    test('handles errors gracefully', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      const msg = new RequestCompleteMessage(1, 'error');
      processor.onMessage(msg, ctx);
      await until(() => connection.sentData.length === 1);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded[0][0]).toBe(CompactMessageType.ResponseError);
      expect(decoded[0][1]).toBe(1);
      expect(decoded[0][2]).toMatchObject({
        message: 'this promise can throw'
      });
    });
  });

  describe('.onMessages', () => {
    test('processes empty batch', () => {
      const {processor, ctx} = createStreamProcessor();

      // Should not throw
      expect(() => processor.onMessages([], ctx)).not.toThrow();
    });

    test('can process a simple message batch', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      const messages = [
        new RequestCompleteMessage(1, 'ping'),
      ];
      processor.onMessages(messages, ctx);
      await until(() => connection.sentData.length === 1);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded).toContainEqual([CompactMessageType.ResponseComplete, 1, 'pong']);
    });

    test('can send a notification', async () => {
      const {processor, ctx, connection} = createStreamProcessor();
      processor.onMessages([
        new NotificationMessage('notificationSetValue', unknown({value: 124})),
        new RequestCompleteMessage(1, 'getValue'),
      ], ctx);
      await until(() => connection.sentData.length > 0);
      const [uint8] = connection.sentData;
      const text = new TextDecoder().decode(uint8);
      const decoded = JSON.parse(text);
      expect(decoded).toEqual([[CompactMessageType.ResponseComplete, 1, {value: 124}]]);
    });

      test('sends complete message if observable immediately completes after emitting one value', async () => {
      });

      test('observable emits three values synchronously', async () => {
      });

      test('when observable completes asynchronously, sends empty complete message', async () => {

      });

      test('when observable completes asynchronously and emits asynchronously, sends empty complete message', async () => {

      });
  });
});
