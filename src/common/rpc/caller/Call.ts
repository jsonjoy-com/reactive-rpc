import {Observable, Observer, Subject} from "rxjs";

/**
 * Represents an in-flight call.
 */
export class Call<Req = unknown, Res = unknown> {
  constructor(
    public readonly req$: Observer<Req>,
    public readonly reqUnsubscribe$: Observable<null>,
    public readonly stop$: Subject<null>,
    public readonly res$: Observable<Res>,
  ) {}
}
