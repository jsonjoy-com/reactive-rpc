import {until} from "thingies";
import {CompactMessageType, CompactRequestCompleteMessage} from "../../../codec/compact";
import {createStreamProcessor} from "./StreamProcessor.fixtures";

test('can create StreamProcessor with WsConnection', async () => {
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
