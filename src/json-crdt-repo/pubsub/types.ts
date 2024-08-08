import type {Observable} from 'rxjs';

export type Message<Data> = MessageRemote<Data> | MessageLocal<Data>;
export type MessageRemote<Data> = [data: Data, topic: string | number];
export type MessageLocal<Data> = [data: Data, topic: string | number, isLocal: 1];

export type TopicPredicate<Data = unknown> = string | number | TopicPredicateFn<Data>;
export type TopicPredicateFn<Data = unknown> = ((message: Message<Data>) => boolean);

export interface PubSub<Data> {
  pub(msg: MessageRemote<Data>): void;
  sub$(topicPredicate: TopicPredicate<Data>): Observable<Message<Data>>;
  end(): void;
}
