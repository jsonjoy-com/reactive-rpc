import {BinaryMsgStreamCodec} from '../BinaryMsgStreamCodec';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Writer} from '@jsonjoy.com/buffers/lib/Writer';
import {messages} from '../../../messages/__tests__/fixtures';

const codec = new BinaryMsgStreamCodec();
const cborCodec = new CborJsonValueCodec(new Writer());

describe('encode, decode', () => {
  for (const [name, message] of Object.entries(messages)) {
    test(name, () => {
      codec.writeBatch(cborCodec, [message]);
      const encoded = cborCodec.encoder.writer.flush();
      const [decoded] = codec.readChunk(cborCodec, encoded);
      expect(decoded).toStrictEqual(message);
    });
  }
});
