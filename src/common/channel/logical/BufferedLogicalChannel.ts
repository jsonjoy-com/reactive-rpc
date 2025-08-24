import {TimedQueue} from "thingies";
import type {Observable} from "rxjs/internal/Observable";
import type {LogicalChannel} from "./types";

export interface BufferedLogicalChannelOpts<Incoming, Outgoing> {
  channel: LogicalChannel<Incoming[], Outgoing[]>;

  /**
   * Number of messages to keep in buffer before sending them to the server.
   * The buffer is flushed when the message reaches this limit or when the
   * buffering time has reached the time specified in `bufferTime` parameter.
   * Defaults to 100 messages.
   */
  bufferSize?: number;

  /**
   * Time in milliseconds for how long to buffer messages before sending them
   * to the server. Defaults to 10 milliseconds.
   */
  bufferTime?: number;
}

export class BufferedLogicalChannel<Incoming, Outgoing> implements LogicalChannel<Incoming[], Outgoing[]> {
  public readonly msg$: Observable<Incoming[]>;
  public readonly err$: Observable<unknown>;
  public readonly buffer: TimedQueue<Outgoing>;

  constructor({channel, bufferSize = 100, bufferTime = 5}: BufferedLogicalChannelOpts<Incoming, Outgoing>) {
    this.msg$ = channel.msg$;
    this.err$ = channel.err$;
    this.buffer = new TimedQueue();
    this.buffer.itemLimit = bufferSize;
    this.buffer.timeLimit = bufferTime;
    this.buffer.onFlush = (list: Outgoing[]) => {
      const promise = channel.send(list);
      if (promise instanceof Promise) promise.catch((error) => {
        console.error(error);
      });
    }
  }

  public async send(outgoing: Outgoing[]): Promise<void> {
    const buffer = this.buffer;
    const length = outgoing.length;
    for (let i = 0; i < length; i++) buffer.push(outgoing[i]);
  }
}
