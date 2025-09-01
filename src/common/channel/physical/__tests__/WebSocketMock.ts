import {utf8Size} from '@jsonjoy.com/util/lib/strings/utf8';
import {WebSocketState} from '../constants';
import {Subscription} from 'rxjs';
import {toUint8Array} from '@jsonjoy.com/buffers/lib/toUint8Array';
import {ServerConnection} from './ServerConnection';

export interface WebSocketMockParams {
  onClose: (code?: number, reason?: string) => void;
  connection?: ServerConnection;
}

export interface MockWebSocket extends WebSocket {
  readonly _protocol: string | string[];
  _readyState: WebSocketState;
  _bufferedAmount: number;
  _extendParams(newParams: Partial<WebSocketMockParams>): void;
  _open(): void;
  _close(code: number, reason: string, wasClean: boolean): void;
  _error(): void;
  _message(message: string | ArrayBuffer | ArrayBufferView): void;
}

export class WebSocketMock implements MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readonly CONNECTING = 0;
  public readonly OPEN = 1;
  public readonly CLOSING = 2;
  public readonly CLOSED = 3;

  public onclose = null;
  public onerror = null;
  public onmessage = null;
  public onopen = null;

  public binaryType: 'arraybuffer' | 'blob' = 'blob';

  public _readyState: WebSocketState = WebSocketState.CONNECTING;
  public _bufferedAmount = 0;

  public get bufferedAmount(): number {
    return this._bufferedAmount;
  }

  public get extensions(): string {
    return '';
  }

  public get protocol(): string {
    return this._protocol instanceof Array ? this._protocol.join(',') : this._protocol;
  }

  public get readyState(): number {
    return this._readyState;
  }

  public _connectionSub: Subscription | null = null;

  constructor(
    public readonly params: Partial<WebSocketMockParams>,
    public readonly url: string = 'http://127.0.0.1',
    public readonly _protocol: string | string[] = '',
  ) {
    const {connection} = params;
    if (connection) {
      this._connectionSub = connection.outgoing$.subscribe(data => {
        this._message(data);
      });
    }
  }

  public close(code?: number, reason?: string): void {
    this._connectionSub?.unsubscribe();
    if (this.params.connection) {
      this.params.connection.outgoing$.complete();
      this.params.connection.incoming$.complete();
    }
    if (!this.params.onClose) return;
    this.params.onClose(code, reason);
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data === 'string') {
      this._bufferedAmount += utf8Size(data);
    } else if (ArrayBuffer.isView(data)) {
      this._bufferedAmount += data.byteLength;
    } else if (data && typeof data === 'object') {
      if ((data as any).byteLength !== undefined) {
        this._bufferedAmount += Number((data as any).byteLength);
      } else if ((data as unknown as Blob).size !== undefined) {
        this._bufferedAmount += Number((data as unknown as Blob).size);
      }
    }
    if (this.params.connection) {
      if (data instanceof Blob) {
        data.bytes().then(buf => {
          this.params.connection?.incoming$.next(new Uint8Array(buf));
        });
      } else {
        const buf = toUint8Array(data);
        this.params.connection.incoming$.next(buf);
      }
    }
  }

  public addEventListener() {
    throw new Error('not implemented');
  }

  public removeEventListener() {
    throw new Error('not implemented');
  }

  public dispatchEvent(): boolean {
    throw new Error('not implemented');
  }

  public _extendParams(newParams: Partial<WebSocketMockParams>): void {
    Object.assign(this.params, newParams);
  }

  public _open() {
    this._readyState = WebSocketState.OPEN;
    if (typeof this.onopen === 'function') {
      (this.onopen as any).call(this, new Event('open'));
    }
  }

  public _close(code: number, reason: string, wasClean: boolean): void {
    if (this._readyState === WebSocketState.CLOSED) throw new Error('Mock WebSocket already closed.');
    this._readyState = WebSocketState.CLOSED;
    if (!this.onclose) return;
    const event: Pick<CloseEvent, 'code' | 'reason' | 'wasClean'> = {
      code,
      reason,
      wasClean,
    };
    (this.onclose as any).call(this, event);
  }

  public _error() {
    if (!this.onerror) return;
    (this.onerror as any).call(this, new Event('error'));
  }

  public _message(message: string | ArrayBuffer | ArrayBufferView): void {
    if (!this.onmessage) return;
    const event = {data: message};
    (this.onmessage as any).call(this, event);
  }
}
