import {Subject} from 'rxjs';
import type {PubSub} from './types';

export type * from './types';

export class PubSubM<Message> implements PubSub<Message> {
  public readonly bus$ = new Subject<Message>();

  public pub(msg: Message): void {
    this.bus$.next(msg);
  }

  public end(): void {
    this.bus$.complete();
  }
}

export class PubSubBC<Message> extends PubSubM<Message> {
  public readonly ch: BroadcastChannel;

  constructor(public readonly bus: string) {
    super();
    const ch = this.ch = new BroadcastChannel(bus);
    ch.onmessage = (e) => this.bus$.next(e.data as Message);
  }

  public pub(msg: Message): void {
    this.ch.postMessage(msg);
    super.pub(msg);
  }

  public end(): void {
    this.ch.close();
    super.end();
  }
}

/** Cache of global in-memory pubsub instances. */
const memoryCache: Record<string, PubSubM<unknown>> = {};

/**
 * Creates new cross-tab pubsub broadcast channel. Own messages are also received.
 *
 * @param bus The name of the broadcast bus, where messages will be published.
 * @returns A PubSub instance that publishes messages to the specified bus.
 */
export const pubsub = <Events>(bus: string): PubSub<Events> =>
  typeof BroadcastChannel !== 'undefined'
    ? new PubSubBC<Events>(bus)
    : (<any>memoryCache[bus]) || ((<any>memoryCache[bus]) = new PubSubM<Events>());
