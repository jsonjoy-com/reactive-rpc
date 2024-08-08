import {filter} from 'rxjs/operators';
import {Subject} from 'rxjs';
import type {Observable} from 'rxjs';
import type {Message, MessageRemote, PubSub, TopicPredicate, TopicPredicateFn} from './types';

export type * from './types';

export class PubSubM<Data> implements PubSub<Data> {
  protected readonly bus$ = new Subject<Message<Data>>();

  public pub([data, topic]: MessageRemote<Data>): void {
    const msg: Message<Data> = [data, topic, 1];
    this.bus$.next(msg);
  }

  public sub$(topicPredicate: TopicPredicate<Data>): Observable<Message<Data>> {
    const predicate: TopicPredicateFn<Data> = typeof topicPredicate === 'function'
        ? topicPredicate : (msg: Message<Data>) => msg[1] === topicPredicate;
    return this.bus$.pipe(filter(predicate));
  }

  public end(): void {
    this.bus$.complete();
  }
}

export class PubSubBC<Data> extends PubSubM<Data> {
  public readonly ch: BroadcastChannel;

  constructor(public readonly bus: string) {
    super();
    const ch = this.ch = new BroadcastChannel(bus);
    ch.onmessage = (e) => this.bus$.next(e.data as Message<Data>);
  }

  public pub(msg: MessageRemote<Data>): void {
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
export const pubsub = <Data>(bus: string): PubSub<Data> =>
  hasBC ? new PubSubBC<Data>(bus) : (<PubSub<Data>>memoryCache[bus]) || ((<PubSub<Data>>memoryCache[bus]) = new PubSubM<Data>());
