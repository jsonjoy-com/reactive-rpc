import type {WsConnection} from '../types';

/**
 * Mock implementation of WsConnection for testing
 */
export class MockWsConnection implements WsConnection {
  public closed = false;
  public onmessage: (data: Uint8Array, isUtf8: boolean) => void = () => {};
  public onclose: (code: number, reason: string) => void = () => {};

  // For testing - collect sent data
  public sentData: Uint8Array[] = [];

  constructor() {}

  public close(): void {
    this.closed = true;
    this.onclose(1000, 'CLOSE');
  }

  public write(buf: Uint8Array): void {
    if (this.closed) return;
    this.sentData.push(buf);
  }

  public sendPing(data: Uint8Array | null): void {
    // Mock implementation
  }

  public sendPong(data: Uint8Array | null): void {
    // Mock implementation
  }

  public sendBinMsg(data: Uint8Array): void {
    this.write(data);
  }

  public sendTxtMsg(txt: string): void {
    const data = new TextEncoder().encode(txt);
    this.write(data);
  }

  // Test helper methods
  public simulateMessage(data: Uint8Array, isUtf8: boolean = false): void {
    if (!this.closed) {
      this.onmessage(data, isUtf8);
    }
  }

  public getLastSentData(): Uint8Array | undefined {
    return this.sentData[this.sentData.length - 1];
  }

  public getAllSentData(): Uint8Array[] {
    return [...this.sentData];
  }

  public clearSentData(): void {
    this.sentData = [];
  }
}
