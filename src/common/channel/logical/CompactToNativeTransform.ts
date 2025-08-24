import {map} from "rxjs";
import {CompactMessage} from "../../codec/compact";
import {toMessage} from "../../codec/compact/toMessage";
import type {Observable} from "rxjs/internal/Observable";
import type {LogicalChannel} from "./types";
import type {RpcMessage} from "../../messages";

export class CompactToNativeTransform implements LogicalChannel<CompactMessage[], CompactMessage[]> {
  public readonly msg$: Observable<CompactMessage[]>;
  public readonly err$: Observable<unknown>;

  constructor(protected readonly upstream: LogicalChannel<RpcMessage[], RpcMessage[]>) {
    this.err$ = upstream.err$;
    this.msg$ = upstream.msg$.pipe(
      map((messages) => {
        const compact: CompactMessage[] = [];
        const length = messages.length;
        for (let i = 0; i < length; i++) compact.push(messages[i].toCompact());
        return compact;
      })
    );
  }

  public async send(outgoing: CompactMessage[]): Promise<void> {
    const native: RpcMessage[] = [];
    const length = outgoing.length;
    for (let i = 0; i < length; i++) native.push(toMessage(outgoing[i]));
    return this.upstream.send(native);
  }
}
