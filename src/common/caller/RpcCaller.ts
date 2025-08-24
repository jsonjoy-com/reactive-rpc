import {firstValueFrom, from, type Observable, Subject} from 'rxjs';
import {catchError, finalize, first, mergeWith, share, switchMap, take, takeUntil, tap} from 'rxjs/operators';
import {RpcError, RpcErrorCodes} from 'rpc-error';
import {BufferSubject} from '../../util/rx/BufferSubject';
import {Call} from './Call';
import {printTree} from 'tree-dump/lib/printTree';
import {type RxProcedure, Procedure} from '../procedures';
import type {Printable} from 'tree-dump/lib/types';
import type {Caller, ProcedureReq, ProcedureRes, Procedures} from './types';

const defaultWrapInternalError = (error: unknown) => RpcError.internal(error);

export interface RpcCallerOptions<P extends Procedures<any> = Procedures> {
  procedures: P;

  /**
   * When call `request$` is a multi-value observable and request data is coming
   * in while pre-call check is still being executed, this property determines
   * how many `request$` values to buffer in memory before raising an error
   * and stopping the streaming call. Defaults to 10.
   */
  preCallBufferSize?: number;

  wrapInternalError?: (error: unknown) => unknown;
}

/**
 * Implements methods to call Reactive-RPC methods on the server.
 */
export class RpcCaller<Ctx = unknown, P extends Procedures<any> = Procedures<Ctx>>
  implements Caller<Ctx, P>, Printable
{
  protected readonly procedures: P;
  protected readonly preCallBufferSize: number;
  protected readonly wrapInternalError: (error: unknown) => unknown;

  constructor({procedures, preCallBufferSize = 10, wrapInternalError = defaultWrapInternalError}: RpcCallerOptions<P>) {
    this.procedures = procedures;
    this.preCallBufferSize = preCallBufferSize;
    this.wrapInternalError = wrapInternalError;
  }

  public exists(name: string): boolean {
    return name in this.procedures;
  }

  public getMethodStrict<K extends keyof P>(name: K): P[K] {
    const method = this.procedures[name];
    if (method instanceof Procedure) return method;
    throw RpcError.fromErrno(RpcErrorCodes.METHOD_UNK);
  }

  public info(name: string): Pick<Procedure, 'pretty' | 'rx'> {
    return this.getMethodStrict(name);
  }

  protected validate(method: Procedure, request: unknown): void {
    const validate = method.validate;
    if (!validate) return;
    try {
      const errors = validate(request);
      if (errors as any) throw errors;
    } catch (error) {
      if (RpcError.isRpcError(error)) throw error;
      throw this.wrapValidationError(error);
    }
  }

  protected wrapValidationError(error: unknown): RpcError {
    return RpcError.badRequest(void 0, void 0, error);
  }

  /**
   * A call may error in a number of ways:
   *
   * - [x] Request stream itself emits an error.
   * - [x] Any of the request stream values fails validation.
   * - [x] Pre-call checks fail.
   * - [x] Pre-call request buffer is overflown.
   * - [x] Due to inactivity timeout.
   */
  public createCall<K extends keyof P>(name: K, ctx: Ctx): Call<ProcedureReq<P[K]>, ProcedureRes<P[K]>> {
    type Req = ProcedureReq<P[K]>;
    type Res = ProcedureRes<P[K]>;
    const req$ = new Subject<Req>();
    const reqUnsubscribe$ = new Subject<null>();
    const stop$ = new Subject<null>();
    try {
      // This throws when Reactive-RPC method does not exist.
      const method = this.getMethodStrict(name as string);

      // When Reactive-RPC method is "static".
      if (!method.rx) {
        const response$: Observable<Res> = from(
          (async () => {
            const request = await firstValueFrom(req$.pipe(first()));
            return await this.call(name, request as any, ctx);
          })(),
        );
        const res$ = new Subject<Res>();
        response$.subscribe(res$);

        // Format errors using custom error formatter.
        const $resWithErrorsFormatted = res$.pipe(
          catchError((error) => {
            if (RpcError.isRpcError(error)) throw error;
            throw this.wrapInternalError(error);
          }),
        );

        return new Call(req$, reqUnsubscribe$, stop$, $resWithErrorsFormatted.pipe(takeUntil(stop$)));
      }

      // Here we are sure the call will be streaming.
      const methodStreaming = method as {} as RxProcedure;

      // Validate all incoming stream requests.
      const requestValidated$ = req$.pipe(
        tap((request) => {
          this.validate(methodStreaming, request);
        }),
      );

      // Buffer incoming requests while pre-call checks are executed.
      const bufferSize = methodStreaming.preCallBufferSize || this.preCallBufferSize;
      const requestBuffered$ = new BufferSubject<unknown>(bufferSize);
      // requestBuffered$.subscribe({error: () => {}});

      // Error signal (only emits errors), merged with response stream.
      // Used for pre-call buffer overflow and timeout errors.
      const error$ = new Subject<never>();

      // Keep track of buffering errors, such as buffer overflow.
      requestBuffered$.subscribe({
        error: (error) => {
          error$.error(error);
        },
        // complete: () => { error$.complete(); },
      });
      requestValidated$.subscribe(requestBuffered$);

      // Main call execution.
      const result$ = requestBuffered$.pipe(
        // First, execute pre-call checks with only the first request.
        take(1),
        switchMap((request) => {
          return methodStreaming.preCall
            ? (from(methodStreaming.preCall(ctx, request)) as Observable<ProcedureReq<P[K]>>)
            : from([0]);
        }),
        // Execute the actual RPC call and flush request buffer.
        switchMap(() => {
          Promise.resolve().then(() => {
            requestBuffered$.flush();
          });
          return method.call$(requestBuffered$, ctx).pipe(
            finalize(() => {
              error$.complete();
            }),
          );
        }),
        // Make sure we don't call method implementation more than once.
        share(),
        // Make sure external errors are captured.
        mergeWith(error$),
      );

      // Format errors using custom error formatter.
      const $resWithErrorsFormatted = result$.pipe(
        finalize(() => {
          error$.complete();
        }),
        catchError((error) => {
          if (RpcError.isRpcError(error)) throw error;
          throw this.wrapInternalError(error);
        }),
      );

      return new Call(req$, reqUnsubscribe$, stop$, $resWithErrorsFormatted.pipe(takeUntil(stop$)));
    } catch (error) {
      req$.error(error);
      const res$ = new Subject<ProcedureRes<P[K]>>();
      res$.error(error);
      return new Call(req$, reqUnsubscribe$, stop$, res$.pipe(takeUntil(stop$)));
    }
  }

  /** -------------------------------------------------------- {@link Caller} */

  /**
   * "call" executes degenerate version of RPC where both request and response data
   * are simple single value.
   *
   * It is a separate implementation from "call$" for performance and complexity
   * reasons.
   *
   * @param name Method name.
   * @param request Request data.
   * @param ctx Server context object.
   * @returns Response data.
   */
  public async call<K extends keyof P>(name: K, request: ProcedureReq<P[K]>, ctx: Ctx): Promise<ProcedureRes<P[K]>> {
    const method = this.getMethodStrict(name as string);
    this.validate(method, request);
    try {
      const preCall = method.preCall;
      if (preCall) await preCall(ctx, request);
      const data = await method.call(request, ctx);
      return data;
    } catch (error) {
      if (RpcError.isRpcError(error)) throw error;
      throw this.wrapInternalError(error);
    }
  }

  public call$<K extends keyof P>(
    name: K,
    request$: Observable<ProcedureReq<P[K]>>,
    ctx: Ctx,
  ): Observable<ProcedureRes<P[K]>> {
    const call = this.createCall(name, ctx as Ctx);
    // (from(request$) as Observable<ProcedureReq<P[K]>>).subscribe(call.req$);
    request$.subscribe(call.req$);
    return call.res$;
  }

  public async notify<K extends keyof P>(name: K, request: ProcedureReq<P[K]>, ctx: Ctx): Promise<void> {
    const method = this.getMethodStrict(name as string);
    this.validate(method, request);
    try {
      if (method.preCall) await method.preCall(ctx, request);
      await method.call(request, ctx);
    } catch (error) {
      if (RpcError.isRpcError(error)) throw error;
      throw this.wrapInternalError(error);
    }
  }

  /** ----------------------------------------------------- {@link Printable} */

  public toString(tab = ''): string {
    return (
      `${this.constructor.name}` +
      printTree(
        tab,
        [...Object.entries(this.procedures)]
          .filter((x) => x[1] instanceof Procedure)
          .map(
            ([name, method]) =>
              () =>
                `${name}${method.rx ? ' (Rx)' : ''}`,
          ),
      )
    );
  }
}
