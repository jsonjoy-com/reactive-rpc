import type {Observable, Subject} from 'rxjs';

export type Message<Topic, Data> = MessageRemote<Topic, Data> | MessageLocal<Topic, Data>;
export type MessageRemote<Topic, Data> = [topic: Topic, data: Data];
export type MessageLocal<Topic, Data> = [topic: Topic, data: Data, isLocal: 1];

export interface PubSub<Events> {
  bus$: Subject<Message<keyof Events, Events[keyof Events]>>
  pub<K extends keyof Events>(msg: MessageRemote<K, Events[K]>): void;
  sub$<K extends keyof Events>(topic: K): Observable<Message<K, Events[K]>>;
  end(): void;
}
