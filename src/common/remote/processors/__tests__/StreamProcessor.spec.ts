import {until} from "thingies";
import {CompactMessageType, CompactRequestCompleteMessage} from "../../../codec/compact";
import {createStreamProcessor} from "./StreamProcessor.fixtures";


test('can create StreamProcessor with WsConnection', async () => {
  const {processor, ctx, connection} = createStreamProcessor();
  const msg: CompactRequestCompleteMessage = [CompactMessageType.RequestComplete, 1, 'ping'];
  const uint8 = new TextEncoder().encode(JSON.stringify(msg));
  connection.simulateMessage(uint8);


  await until(() => connection.sentData.length > 0)
  const data = connection.getAllSentData();

  console.log(data);

  // ctx.connection.write(new Uint8Array([4, 5, 6]));
  // console.log(processor);
});
