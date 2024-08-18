import { Observable, OperatorFunction, Subscriber } from 'rxjs';

export const tapSubscriberCount = <TValue>(listener: (newCount: number, oldCount: number) => void): OperatorFunction<TValue, TValue> => {
  return (source$) => {
    let count = 0;
    return new Observable((subscriber: Subscriber<TValue>) => {
      const subscription = source$.subscribe(subscriber);
      const oldCount = count;
      const newCount = ++count;
      listener(newCount, oldCount);
      return () => {
        subscription.unsubscribe();
        const oldCount = count;
        const newCount = --count;
        listener(newCount, oldCount);
      };
    });
  };
};
