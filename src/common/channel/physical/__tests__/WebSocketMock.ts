import {utf8Size} from '@jsonjoy.com/util/lib/strings/utf8';
import {WebSocketState} from '../constants';
import {Subscription} from 'rxjs';
import {toUint8Array} from '@jsonjoy.com/buffers/lib/toUint8Array';
import {WebSocketMockServerConnection} from './WebSocketMockServerConnection';
import {EventEmitter} from 'ws';

export class CloseEvent extends Event {
  constructor(
    public readonly code: number,
    public readonly reason: string,
    public readonly wasClean: boolean
  ) {
    super('close');
  }
}

export interface WebSocketMockParams {
  connection?: WebSocketMockServerConnection;
}

export interface MockWebSocket extends WebSocket {
  readonly _protocol: string | string[];
  _readyState: WebSocketState;
  _bufferedAmount: number;
  _extendParams(newParams: Partial<WebSocketMockParams>): void;
  _open(): void;
  _close(code: number, reason: string, wasClean: boolean): void;
  _error(message: string): void;
  _message(message: string | ArrayBuffer | ArrayBufferView): void;
}

export class WebSocketMock extends EventEmitter implements MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;

  public readonly CONNECTING = 0;
  public readonly OPEN = 1;
  public readonly CLOSING = 2;
  public readonly CLOSED = 3;

  public onclose = null;
  public onerror: null | ((event: Event) => void) = null;
  public onmessage = null;
  public onopen: null | ((event: Event) => void) = null;

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
    super();
    const {connection} = params;
    if (connection) {
      this._connectionSub = connection.outgoing$.subscribe(data => {
        this._message(data);
      });
    }
  }

  public _open() {
    this._readyState = WebSocketState.OPEN;
    const event = new Event('open');
    this.onopen?.(event);
    this.emit('open', event);
  }

  public close(code?: number, reason?: string): void {
    this._close(code ?? 0, reason ?? '', true);
  }

  public _close(code: number, reason: string, wasClean: boolean): void {
    this._connectionSub?.unsubscribe();
    if (this.params.connection) {
      this.params.connection.outgoing$.complete();
      this.params.connection.incoming$.complete();
    }
    if (this._readyState === WebSocketState.CLOSED) throw new Error('Mock WebSocket already closed.');
    this._readyState = WebSocketState.CLOSED;
    const event = new CloseEvent(code, reason, wasClean);
    (this.onclose as any).call(this, event);
    this.emit('close', event);
  }

  public _error(message: string) {
    const event = new Event('error');
    this.onerror?.(event);
    this.emit('error', event);
    this._close(1000, message, false);
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

  public _message(message: string | ArrayBuffer | ArrayBufferView): void {
    if (!this.onmessage) return;
    const event = {data: message};
    (this.onmessage as any).call(this, event);
  }
}
