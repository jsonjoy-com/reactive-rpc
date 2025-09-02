import {createRpcCaller, procedures, SampleCtx} from '../../caller/__tests__/RpcCaller.fixtures';
import {runApiTests} from './runApiTests';
import {RpcMessageStreamProcessor} from '../../remote';
import {Caller, Procedures} from '../../caller';
import {RxClient} from '../RxClient';
import {LogicalChannel} from '../../channel/logical/types';
import {BufferedLogicalChannel} from '../../channel/logical/BufferedLogicalChannel';
import {MsgCodecLogicalChannel} from '../../channel/logical/MsgCodecLogicalChannel';
import {JsonCompactMsgCodec} from '../../codec/JsonCompactMsgCodec';
import {Utf8Channel} from '../../channel/physical/Utf8Channel';
import {WebSocketChannel} from '../../channel/physical/WebSocketChannel';
import {RpcClientMessage, RpcMessage, RpcServerMessage} from '../../messages';
import {WebSocketMockFactory} from '../../channel/physical/__tests__/WebSocketMockFactory';
import {WebSocketMockServerConnection} from '../../channel/physical/__tests__/ServerConnection';
import {RpcMessageCodecs} from '../../codec/RpcMessageCodecs';
import {RpcCodec} from '../../codec/RpcCodec';
import {Writer} from '@jsonjoy.com/buffers/lib/Writer';
import {Codecs} from '@jsonjoy.com/json-pack/lib/codecs/Codecs';
import {CompactMsgStreamCodec} from '../../codec/compact';
import {ProceduresToClientMethods} from '../types';


const createRpcProcessor = <Ctx = unknown, P extends Procedures<any> = Procedures<Ctx>>(caller: Caller<Ctx, P>, ctx: Ctx) => {
  const connection = new WebSocketMockServerConnection();
  const socketFactory = new WebSocketMockFactory({newConnection: () => connection})
  const [socket] = socketFactory.create();
  const writer = new Writer();
  const codecs = new Codecs(writer);
  const serverCodec = new RpcCodec(new CompactMsgStreamCodec(), codecs.json, codecs.json);
  const processor = new RpcMessageStreamProcessor<Ctx>({
    caller: caller as Caller<Ctx, any>,
    send: (messages: RpcMessage[]) => {
      const buf = serverCodec.encode(messages);
      connection.outgoing$.next(buf);
    },
  });
  connection.incoming$.subscribe(data => {
    const messages = serverCodec.decode(data, serverCodec.req);
    processor.onMessages(messages as RpcClientMessage[], ctx);
  });
  return {socket, connection, processor};
};


runApiTests(async () => {
  // Server-side
  const caller = createRpcCaller();
  const ctx = {ip: '127.0.0.1'};
  const connection = new WebSocketMockServerConnection();
  const socketFactory = new WebSocketMockFactory({newConnection: () => connection})
  const [socket] = socketFactory.create();
  const writer = new Writer();
  const codecs = new Codecs(writer);
  const serverCodec = new RpcCodec(new CompactMsgStreamCodec(), codecs.json, codecs.json);
  const processor = new RpcMessageStreamProcessor<SampleCtx | void>({
    caller: caller as Caller<SampleCtx | void, any>,
    send: (messages: RpcMessage[]) => {
      const buf = serverCodec.encode(messages);
      connection.outgoing$.next(buf);
    },
  });
  connection.incoming$.subscribe(data => {
    const messages = serverCodec.decode(data, serverCodec.req);
    processor.onMessages(messages as RpcClientMessage[], ctx);
  });

  // Client-side
  const physicalChannel = new WebSocketChannel({newSocket: () => socket});
  const physicalTextChannel = new Utf8Channel(physicalChannel);
  const clientCodec = new JsonCompactMsgCodec();
  const logicalChannel = new MsgCodecLogicalChannel<string, RpcMessage>({channel: physicalTextChannel, codec: clientCodec});
  const bufferedChannel = new BufferedLogicalChannel({channel: logicalChannel, bufferTime: 1});
  const client = new RxClient<ProceduresToClientMethods<typeof procedures>>({channel: bufferedChannel as LogicalChannel<RpcServerMessage[], RpcClientMessage[]>});

  return {client, stop: async () => {} };
}, {
  skipValidationTests: true,
});
