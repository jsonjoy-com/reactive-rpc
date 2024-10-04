import type {Codecs} from '@jsonjoy.com/json-pack/lib/codecs/Codecs';
import type {RpcMessageCodecs} from './RpcMessageCodecs';

export class RpcCodecs {
  constructor(
    public readonly value: Codecs,
    public readonly messages: RpcMessageCodecs,
  ) {}
}
