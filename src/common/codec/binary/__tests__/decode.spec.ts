import {NotificationMessage, RequestCompleteMessage, RequestDataMessage, RequestErrorMessage, RequestUnsubscribeMessage, ResponseCompleteMessage, ResponseDataMessage, ResponseErrorMessage, ResponseUnsubscribeMessage, type RpcMessage} from '../../../messages';
// import {decode} from '../decode';
// import {Reader} from '@jsonjoy.com/util/lib/buffers/Reader';
// import type {Uint8ArrayCut} from '@jsonjoy.com/util/lib/buffers/Uint8ArrayCut';
import {CborJsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/cbor';
import {Writer} from '@jsonjoy.com/util/lib/buffers/Writer';
import {unknown} from '@jsonjoy.com/json-type';
import {BinaryMsgStreamCodec} from '../BinaryMsgStreamCodec';

const msgCodec = new BinaryMsgStreamCodec();
const valueCodec = new CborJsonValueCodec(new Writer(64));
// const encoder = valueCodec.encoder;
// const decoder = valueCodec.decoder;
const val = <T>(v: T) => unknown(v);
const assertMessage = (msg: RpcMessage) => {
  const encoded = msgCodec.encode(valueCodec, [msg]);
  valueCodec.decoder.reader.reset(encoded);
  const [decoded] = msgCodec.read(valueCodec);
  if (decoded instanceof NotificationMessage
    || decoded instanceof RequestCompleteMessage
    || decoded instanceof RequestDataMessage
    || decoded instanceof RequestErrorMessage
    || decoded instanceof ResponseCompleteMessage
    || decoded instanceof ResponseDataMessage
    || decoded instanceof ResponseErrorMessage
  ) {
    if (!decoded.value) {
      decoded.value = val(undefined);
    }
  }
  expect(decoded).toEqual(msg);
};

describe('decodes back various messages', () => {
  test('empty notification', () => {
    assertMessage(new NotificationMessage('', val(undefined)));
  });

  test('notification with empty payload', () => {
    assertMessage(new NotificationMessage('hello.world', val(undefined)));
  });

  test('notification with payload', () => {
    assertMessage(new NotificationMessage('foo', val({foo: 'bar'})));
  });

  test('empty Request Data message', () => {
    assertMessage(new RequestDataMessage(0, '', val(undefined)));
  });

  test('Request Data message', () => {
    assertMessage(new RequestDataMessage(123, 'abc', val({foo: 'bar'})));
  });

  test('Request Complete message', () => {
    assertMessage(new RequestCompleteMessage(23324, 'adfasdf', val({foo: 'bar'})));
  });

  test('Request Error message', () => {
    assertMessage(new RequestCompleteMessage(4321, '', val('asdf')));
  });

  test('Request Un-subscribe message', () => {
    assertMessage(new RequestUnsubscribeMessage(4321));
  });

  test('empty Response Data message', () => {
    assertMessage(new ResponseDataMessage(0, val(undefined)));
  });

  test('Response Data message', () => {
    assertMessage(new ResponseDataMessage(123, val({foo: 'bar'})));
  });

  test('Response Complete message', () => {
    assertMessage(new ResponseCompleteMessage(123, val({foo: 'bar'})));
  });

  test('Response Error message', () => {
    assertMessage(new ResponseErrorMessage(123, val({foo: 'bar'})));
  });

  test('Response Un-subscribe message', () => {
    assertMessage(new ResponseUnsubscribeMessage(4321));
  });
});
