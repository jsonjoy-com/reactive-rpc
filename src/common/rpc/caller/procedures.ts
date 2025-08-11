import {firstValueFrom, from, of, switchMap, take, type Observable, isObservable} from "rxjs";

export abstract class Procedure<Req = unknown, Res = unknown, Ctx = unknown> {
  public static readonly new = <Req = unknown, Res = unknown, Ctx = unknown>(
    fn: Res | ((request: Req, ctx: Ctx) => Res | Promise<Res> | Observable<Res>),
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ) => {
    if (typeof fn !== 'function')
      return Procedure.unary(async () => (fn as Res), validate, preCall);
    const streamingCall = (req: Observable<Req>, ctx: Ctx) => {
      return req.pipe(
        take(1),
        switchMap(r => {
          const res = (fn as ((request: Req, ctx: Ctx) => Res | Promise<Res> | Observable<Res>))(r, ctx);
          if (isObservable(res)) return res;
          if (res instanceof Promise) return res;
          return Promise.resolve(res);
        })
      );
    };
    return new RxProcedure<Req, Res, Ctx>(streamingCall, validate, preCall);
  };

  public static readonly unary = <Req = unknown, Res = unknown, Ctx = unknown>(
    fn: (request: Req, ctx: Ctx) => Promise<Res>,
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ): UnaryProcedure<Req, Res, Ctx> =>
    new UnaryProcedure<Req, Res, Ctx>(fn, validate, preCall);

  public static readonly rx = <Req = unknown, Res = unknown, Ctx = unknown>(
    fn: (request$: Observable<Req>, ctx: Ctx) => Observable<Res>,
    validate: ((request: Req) => void) | undefined = undefined,
    preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined = undefined,
  ): RxProcedure<Req, Res, Ctx> =>
    new RxProcedure<Req, Res, Ctx>(fn, validate, preCall);

  /**
   * Specifies if request or response of the method could be a stream.
   */
  rx: boolean = false;

  /**
   * Whether to pretty print the response.
   */
  pretty: boolean = false;

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
   *     streaming request.
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
    private readonly fn: (request: Req, ctx: Ctx) => Promise<Res>,
    public readonly validate: ((request: Req) => void) | undefined,
    public readonly preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined,
  ) {
    super();
  }

  async call(request: Req, ctx: Ctx): Promise<Res> {
    return await this.fn(request, ctx);
  }

  call$(request$: Observable<Req>, ctx: Ctx): Observable<Res> {
    return from((async () => this.call(await firstValueFrom(request$), ctx))());
  }
}

/**
 * Procedure which receives a stream of request values and returns a stream of
 * response values.
 */
export class RxProcedure<Req = unknown, Res = unknown, Ctx = unknown> extends Procedure<Req, Res, Ctx> {
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
    private readonly fn: (request$: Observable<Req>, ctx: Ctx) => Observable<Res>,
    public readonly validate: ((request: Req) => void) | undefined,
    public readonly preCall: ((ctx: Ctx, request: Req) => Promise<void>) | undefined,
  ) {
    super();
  }

  async call(request: Req, ctx: Ctx): Promise<Res> {
    return await firstValueFrom(this.fn(of(request), ctx));
  }

  call$(request$: Observable<Req>, ctx: Ctx): Observable<Res> {
    return this.fn(request$, ctx);
  }
}
