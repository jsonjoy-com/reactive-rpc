import type {Observable} from 'rxjs';

export interface PubSub<Message> {
  bus$: Observable<Message>;
  pub(msg: Message): void;
  end(): void;
}
