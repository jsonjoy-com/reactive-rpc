import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Writer} from '@jsonjoy.com/buffers/lib/Writer';
import {compactMessages} from './compact-messages';
import {CompactMsgStreamCodec} from '../CompactMsgStreamCodec';
import {messages} from '../../../messages/__tests__/fixtures';
import {toMessage} from '../toMessage';

const codec = new CompactMsgStreamCodec();
const writer = new Writer(8 * Math.round(Math.random() * 100));
const cborCodec = new CborJsonValueCodec(writer);

describe('hydrate, encode, decode', () => {
  for (const [name, compact] of Object.entries(compactMessages)) {
    test(name, () => {
      const message = toMessage(compact);
      codec.writeBatch(cborCodec, [message]);
      const encoded = cborCodec.encoder.writer.flush();
      const [decoded] = codec.readChunk(cborCodec, encoded);
      expect(decoded).toStrictEqual(message);
    });
  }
});

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
