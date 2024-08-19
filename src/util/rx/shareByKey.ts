import { defer, finalize, Observable, share } from 'rxjs';

export const shareByKey = <TValue>(sub: (key: string) => Observable<TValue>): ((key: string) => Observable<TValue>) => {
  const map: Record<string, Observable<TValue>> = {};
  return (key: string) => {
    const observable = map[key];
    if (observable) return observable;
    return map[key] = defer(() => sub(key))
      .pipe(
        finalize(() => {
          delete map[key];
        }),
        share({
          resetOnRefCountZero: true,
        }),
      );
  };
};
