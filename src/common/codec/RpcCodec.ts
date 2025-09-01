import type {RpcSpecifier} from '../remote/types';
import type {RpcMessage} from '../messages';
import type {JsonValueCodec} from '@jsonjoy.com/json-pack/lib/codecs/types';
import type {MsgStreamCodec} from './types';

export class RpcCodec {
  constructor(
    public readonly msg: MsgStreamCodec,
    public readonly req: JsonValueCodec,
    public readonly res: JsonValueCodec,
  ) {}

  public specifier(): RpcSpecifier {
    const specifier = `rpc.${this.msg.id}.${this.req.id}` + (this.req.id !== this.res.id ? `-${this.res.id}` : '');
    return specifier as RpcSpecifier;
  }

  public encode(messages: RpcMessage[]): Uint8Array {
    const encoder = this.req.encoder;
    const writer = encoder.writer;
    writer.reset();
    this.msg.writeBatch(this.req, messages);
    return writer.flush();
  }

  public decode(data: Uint8Array, valueCodec: JsonValueCodec): RpcMessage[] {
    const decoder = valueCodec.decoder;
    const reader = decoder.reader;
    reader.reset(data);
    return this.msg.readChunk(valueCodec, data);
  }
}
