import {filter} from 'rxjs/operators';
import {Subject} from 'rxjs';
import type {Observable} from 'rxjs';
import type {Message, MessageLocal, MessageRemote, PubSub} from './types';

export type * from './types';

export class PubSubM<Events> implements PubSub<Events> {
  public readonly bus$ = new Subject<Message<keyof Events, Events[keyof Events]>>();

  public pub<K extends keyof Events>([topic, data]: MessageRemote<K, Events[K]>): void {
    const msg: MessageLocal<K, Events[K]> = [topic, data, 1];
    this.bus$.next(msg);
  }

  public sub$<K extends keyof Events>(topic: K): Observable<Message<K, Events[K]>> {
    const predicate = (msg: Message<K, Events[K]>) => msg[0] === topic;
    return this.bus$.pipe(filter(predicate) as any);
  }

  public end(): void {
    this.bus$.complete();
  }
}

export class PubSubBC<Events> extends PubSubM<Events> {
  public readonly ch: BroadcastChannel;

  constructor(public readonly bus: string) {
    super();
    const ch = this.ch = new BroadcastChannel(bus);
    ch.onmessage = (e) => this.bus$.next(e.data as Message<keyof Events, Events[keyof Events]>);
  }

  public pub<K extends keyof Events>(msg: MessageRemote<K, Events[K]>): void {
    this.ch.postMessage(msg);
    super.pub(msg);
  }

  public end(): void {
    super.end();
    this.ch.close();
  }
}

const hasBC = typeof BroadcastChannel !== 'undefined';

/** Cache of global in-memory pubsub instances. */
const memoryCache: Record<string, PubSubM<unknown>> = {};

/**
 * Creates new cross-tab pubsub broadcast channel. Own messages are also received.
 *
 * @param bus The name of the broadcast bus, where messages will be published.
 * @returns A PubSub instance that publishes messages to the specified bus.
 */
export const pubsub = <Events>(bus: string): PubSub<Events> =>
  hasBC ? new PubSubBC<Events>(bus) : (<any>memoryCache[bus]) || ((<any>memoryCache[bus]) = new PubSubM<Events>());
