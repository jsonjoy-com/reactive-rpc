import {WebSocketMockServerConnection} from './ServerConnection';
import {WebSocketMock} from './WebSocketMock';

export interface WebSocketMockParams {
  newConnection: () => WebSocketMockServerConnection;
  url?: string;
  protocol?: string | string[];
}

export class WebSocketMockFactory {
  constructor (public readonly params: WebSocketMockParams) {}

  public create(): [socket: WebSocketMock, connection: WebSocketMockServerConnection] {
    const params = this.params;
    const connection = params.newConnection();
    const socket = new WebSocketMock({connection}, params.url, params.protocol);
    return [socket, connection];
  }
}
