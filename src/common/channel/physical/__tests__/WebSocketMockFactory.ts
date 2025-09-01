import {ServerConnection} from './ServerConnection';
import {WebSocketMock} from './WebSocketMock';

export interface WebSocketMockParams {
  newConnection: () => ServerConnection;
  url?: string;
  protocol?: string | string[];
}

export class WebSocketMockFactory {
  constructor (public readonly params: WebSocketMockParams) {}

  public create(): [socket: WebSocketMock, connection: ServerConnection] {
    const params = this.params;
    const connection = params.newConnection();
    const socket = new WebSocketMock({connection}, params.url, params.protocol);
    return [socket, connection];
  }
}
