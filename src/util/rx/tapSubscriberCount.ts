import { Observable, OperatorFunction, share, Subject, Subscriber, takeUntil } from 'rxjs';

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

export const shareByKey = <TValue>(sub: (key: string) => Observable<TValue>): ((key: string) => Observable<TValue>) => {
  const map: Record<string, Observable<TValue>> = {};
  return (key: string) => {
    let observable = map[key];
    if (observable) return observable;
    const stop$ = new Subject<void>();
    observable = sub(key)
      .pipe(
        takeUntil(stop$),
        share(),
        tapSubscriberCount((count, oldCount) => {
          if (count === 0 && oldCount === 1) {
            stop$.next();
            delete map[key];
          }
        }),
      );
    map[key] = observable;
    return observable;
  };
};
