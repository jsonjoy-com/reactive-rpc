import type {Observable} from 'rxjs';

export type Message<Data> = [data: Data, topic: string | number, isLocal?: boolean];

export type TopicPredicate<Data = unknown> = string | number | TopicPredicateFn<Data>;
export type TopicPredicateFn<Data = unknown> = ((message: Message<Data>) => boolean);

export interface PubSub<Data> {
  pub(topic: string | number, data: Data): void;
  sub$(topicPredicate: TopicPredicate<Data>): Observable<Message<Data>>;
  end(): void;
}
