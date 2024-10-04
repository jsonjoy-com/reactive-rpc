import type {RpcValue} from '../../../messages/Value';
import type {IRpcError} from './RpcErrorType';

export enum RpcErrorCodes {
  /** Any unknown sever error is wrapped into INTERNAL_ERROR, error 500. */
  INTERNAL_ERROR = 0,

  /** When request is not valid, e.g. when request validation fails, error 400. */
  BAD_REQUEST = 1,

  /**
   * Error thrown when there was no activity on a
   * stream for a long time, and timeout was reached.
   */
  TIMEOUT = 2,

  /** Resource not found, error 404. */
  NOT_FOUND = 3,

  /** When operation cannot be performed due to a conflict, error 409. */
  CONFLICT = 4,

  ID_TAKEN = 5,
  INVALID_METHOD = 6,
  INVALID_METHOD_NAME = 7,
  NO_METHOD_SPECIFIED = 8,
  METHOD_NOT_FOUND = 9,

  STOP = 10,
  DISCONNECT = 11,
  BUFFER_OVERFLOW = 12,
}

export type RpcErrorValue = RpcValue<RpcError>;

export class RpcError extends Error implements IRpcError {
  public static from(error: unknown): RpcError {
    if (error instanceof RpcError) return error;
    return RpcError.internal(error);
  }

  public static fromCode(
    errno: RpcErrorCodes,
    message = '',
    meta: unknown = undefined,
    originalError: unknown = undefined,
  ): RpcError {
    const code = RpcErrorCodes[errno];
    return new RpcError(message || code, code, errno, undefined, meta || undefined, originalError);
  }

  public static internal(originalError: unknown, message = 'Internal Server Error'): RpcError {
    return RpcError.fromCode(RpcErrorCodes.INTERNAL_ERROR, message, undefined, originalError);
  }

  public static badRequest(message = 'Bad Request'): RpcError {
    return RpcError.fromCode(RpcErrorCodes.BAD_REQUEST, message);
  }

  public static notFound(message = 'Not Found'): RpcError {
    return RpcError.fromCode(RpcErrorCodes.NOT_FOUND, message);
  }

  public static validation(message: string, meta?: unknown): RpcError {
    return RpcError.fromCode(RpcErrorCodes.BAD_REQUEST, message, meta);
  }

  public static isRpcError(error: unknown): error is RpcError {
    return error instanceof RpcError;
  }

  constructor(
    public readonly message: string,
    public readonly code: string | undefined,
    public readonly errno: number,
    public readonly errorId: string | undefined,
    public readonly meta: unknown | undefined,
    public readonly originalError: unknown | undefined,
  ) {
    super(message);
    if (message === code) this.code = undefined;
    Object.setPrototypeOf(this, RpcError.prototype);
  }

  public toJson(): IRpcError {
    const err: IRpcError = {message: this.message};
    if (this.code) err.code = this.code;
    if (this.errno) err.errno = this.errno;
    if (this.errorId) err.errorId = this.errorId;
    if (this.meta) err.meta = this.meta;
    return err;
  }
}
