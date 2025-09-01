export type RpcSpecifier = RpcSpecifierRx | RpcSpecifierJson2;
type RpcSpecifierRx = `rpc.rx.${'binary' | 'compact'}.${RpcSpecifierEncoding}`;
type RpcSpecifierJson2 = `rpc.json2.verbose.${RpcSpecifierEncoding}`;
type RpcSpecifierEncoding = 'cbor' | 'json' | 'msgpack';

export interface ServerLogger {
  log(msg: unknown): void;
  error(kind: string, error?: Error | unknown | null, meta?: unknown): void;
}

export interface WsConnection {
  closed: boolean;
  onmessage: (data: Uint8Array, isUtf8: boolean) => void;
  // public onfragment: (isLast: boolean, data: Uint8Array, isUtf8: boolean) => void = this.defaultOnFragment;
  // public onping: (data: Uint8Array | null) => void = this.defaultOnPing;
  // public onpong: (data: Uint8Array | null) => void = () => {};
  onclose: (code: number, reason: string) => void;
  close(): void;
  write(buf: Uint8Array): void;
  sendPing(data: Uint8Array | null): void;
  sendPong(data: Uint8Array | null): void;
  sendBinMsg(data: Uint8Array): void;
  sendTxtMsg(txt: string): void;
}
