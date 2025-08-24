import type {Observable, Subject} from "rxjs";

export interface LogicalChannel<Incoming, Outgoing> {
  msg$: Observable<Incoming>;
  err$: Observable<unknown>;
  send(outgoing: Outgoing): Promise<void>;
}
