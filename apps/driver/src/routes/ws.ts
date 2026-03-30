import { ServerWebSocket } from 'bun';
import { state } from '../state';

export interface WsMessage {
  type: 'PIXEL_FRAME' | 'WLED_STATE' | 'SET_MODE' | 'PING';
  payload?: any;
}

export function handleWsMessage(ws: ServerWebSocket<any>, message: string | Buffer) {
  try {
    const msg: WsMessage = JSON.parse(message.toString());
    switch (msg.type) {
      case 'PIXEL_FRAME':
        // Handle pixel frame
        break;
      case 'WLED_STATE':
        // Forward to WLED JSON API proxy
        break;
      case 'SET_MODE':
        if (msg.payload && ['stream', 'audio', 'preset', 'idle'].includes(msg.payload.mode)) {
          state.activeMode = msg.payload.mode;
        }
        break;
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG', status: state }));
        break;
    }
  } catch (err) {
    console.error('Failed to parse WS message', err);
  }
}
