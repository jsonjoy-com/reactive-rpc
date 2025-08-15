import {MsgPackJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/msgpack';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {RequestCompleteMessage} from '../../../messages';
import {CompactMsgStreamCodec} from '../CompactMsgStreamCodec';
import {Value} from '@jsonjoy.com/json-type';

describe('sample messages', () => {
  test('can decode a message', () => {
    const msgpack = new MsgPackJsonValueCodec(new Writer(128));
    const codec = new CompactMsgStreamCodec();
    const batch = new Uint8Array([145, 148, 1, 1, 166, 100, 111, 117, 98, 108, 101, 129, 163, 110, 117, 109, 128]);
    const messages = codec.readChunk(msgpack, batch);
    expect(messages.length).toBe(1);
    expect(messages[0]).toBeInstanceOf(RequestCompleteMessage);
    expect((messages[0] as any).id).toBe(1);
    expect((messages[0] as any).method).toBe('double');
    expect((messages[0] as any).value).toBeInstanceOf(Value);
    expect((messages[0] as any).value.data).toEqual({num: {}});
  });
});
