import {Subject, type Observable} from "rxjs";
import type {MsgCodec} from "../../codec/types";
import type {PhysicalChannel} from "../physical/types";
import type {LogicalChannel} from "./types";

export interface MsgCodecLogicalChannelOpts<Chunk extends string | Uint8Array, Message> {
  codec: MsgCodec<Chunk, Message>;
  channel: PhysicalChannel<Chunk>;
}

export class MsgCodecLogicalChannel<Chunk extends string | Uint8Array, Message> implements LogicalChannel<Message[], Message[]> {
  public readonly msg$: Observable<Message[]> = new Subject<Message[]>();
  public readonly err$: Observable<unknown>;

  protected _codec: MsgCodec<Chunk, Message>;
  protected _channel: PhysicalChannel<Chunk>;

  constructor({codec, channel}: MsgCodecLogicalChannelOpts<Chunk, Message>) {
    this._codec = codec;
    this._channel = channel;

    const subscription = channel.message$.subscribe({
      next: (chunk) => {
        const messages = codec.fromChunk(chunk);
        (this.msg$ as Subject<Message[]>).next(messages);
      },
      error: () => {
        subscription?.unsubscribe();
      },
    });

    this.err$ = channel.error$;
  }

  public async send(outgoing: Message[]): Promise<void> {
    const { _codec, _channel } = this;
    const buf = _codec.toChunk(outgoing);
    _channel.send(buf);
  }

  public async sendMany(outgoing: Message[]): Promise<void> {
    const { _codec, _channel } = this;
    const buf = _codec.toChunk(outgoing);
    _channel.send(buf);
  }
}
