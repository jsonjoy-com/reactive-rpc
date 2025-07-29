import {t, type Type} from "@jsonjoy.com/json-type";
import {firstValueFrom, from, of, switchMap, take, type Observable, isObservable} from "rxjs";

const defaultType = t.any;

export abstract class Procedure<Req = unknown, Res = unknown, Ctx = unknown> {
  public static readonly new = <Req = unknown, Res = unknown, Ctx = unknown>(
    call: (request: Req, ctx: Ctx) => Res | Promise<Res> | Observable<Res>,
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ): StreamingProcedure<Req, Res, Ctx> => {
    const streamingCall = (req: Observable<Req>, ctx: Ctx) => req.pipe(
      take(1),
      switchMap(r => {
        const res = call(r, ctx);
        if (isObservable(res)) return res;
        if (res instanceof Promise) return res;
        return Promise.resolve(res);
      })
    );
    return new StreamingProcedure<Req, Res, Ctx>(streamingCall, validate, preCall);
  };

  public static readonly unary = <Req = unknown, Res = unknown, Ctx = unknown>(
    call: (request: Req, ctx: Ctx) => Promise<Res>,
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ): UnaryProcedure<Req, Res, Ctx> =>
    new UnaryProcedure<Req, Res, Ctx>(call, validate, preCall);

  public static readonly streaming = <Req = unknown, Res = unknown, Ctx = unknown>(
    _call$: (request$: Observable<Req>, ctx: Ctx) => Observable<Res>,
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ): StreamingProcedure<Req, Res, Ctx> =>
    new StreamingProcedure<Req, Res, Ctx>(_call$, validate, preCall);

  /**
   * Specifies if request or response of the method could be a stream.
   */
  rx: boolean = false;

  /**
   * Whether to pretty print the response.
   */
  pretty: boolean = false;

  /**
   * JSON Type of the request.
   */
  req: Type = defaultType;

  /**
   * JSON Type of the response.
   */
  res: Type = defaultType;

  /**
   * Validation logic. Should throw if request is invalid, not throw otherwise.
   * In case request is a stream, validation method is executed for every
   * emitted value.
   */
  abstract validate: ((request: Req) => void) | undefined;

  /**
   * Method which is executed before an actual call to an RPC method. Pre-call
   * checks should execute all necessary checks (such as authentication,
   * authorization, throttling, etc.) before allowing the real method to
   * proceed. Pre-call checks should throw, if for any reason the call should
   * not proceed. Return void to allow execution of the actual call.
   *
   * @param ctx Request context object.
   * @param request Request payload, the first emitted value in case of
   *                streaming request.
   */
  abstract preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined;

  /**
   * Method which is executed to perform the actual call. When request is a
   * single and response is a single value.
   *
   * @param request Request payload.
   * @param ctx Request context object.
   * @return Response data.
   */
  abstract call(request: Req, ctx: Ctx): Promise<Res>;

  /**
   * Method which is executed to perform the actual call. When request is a
   * stream and response is a stream.
   *
   * @param request$ Request payload as an observable.
   * @param ctx Request context object.
   * @return Response data as an observable.
   */
  abstract call$(request$: Observable<Req>, ctx: Ctx): Observable<Res>;
}

/**
 * Procedure which receives a single request value, executes asynchronously
 * and returns a single response value.
 */
export class UnaryProcedure<Req = unknown, Res = unknown, Ctx = unknown> extends Procedure<Req, Res, Ctx> {
  rx: boolean = false;

  constructor(
    private readonly _call: (request: Req, ctx: Ctx) => Promise<Res>,
    public readonly validate: ((request: Req) => void) | undefined,
    public readonly preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined,
  ) {
    super();
  }

  call(request: Req, ctx: Ctx): Promise<Res> {
    return this._call(request, ctx);
  }

  call$(request$: Observable<Req>, ctx: Ctx): Observable<Res> {
    return from((async () => this.call(await firstValueFrom(request$), ctx))());
  }
}

/**
 * Procedure which receives a stream of request values and returns a stream of
 * response values.
 */
export class StreamingProcedure<Req = unknown, Res = unknown, Ctx = unknown> extends Procedure<Req, Res, Ctx> {
  rx: boolean = true;

  /**
   * When call `request$` is a multi-value observable and request data is coming
   * in while pre-call check is still being executed, this property determines
   * how many `request$` values to buffer in memory before raising an error
   * and stopping the streaming call. Defaults to the `preCallBufferSize` param
   * set on the `RpcServer`.
   */
  preCallBufferSize: number = 0;

  constructor(
    private readonly _call$: (request$: Observable<Req>, ctx: Ctx) => Observable<Res>,
    public readonly validate: ((request: Req) => void) | undefined,
    public readonly preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined,
  ) {
    super();
  }

  call(request: Req, ctx: Ctx): Promise<Res> {
    return firstValueFrom(this._call$(of(request), ctx))
  }

  call$(request$: Observable<Req>, ctx: Ctx): Observable<Res> {
    return this._call$(request$, ctx);
  }
}
