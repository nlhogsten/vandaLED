import { ServerWebSocket } from 'bun';
import { state } from '../state';
import { pipeline } from '../services/pixel-pipeline';
import { PixelFrame } from '@vandaled/ddp-engine';

export interface WsMessage {
  type: 'PIXEL_FRAME' | 'WLED_STATE' | 'SET_MODE' | 'SET_BRIGHTNESS' | 'PING';
  payload?: any;
}

// Track connected clients for broadcasting
const clients = new Set<ServerWebSocket<any>>();

export function addClient(ws: ServerWebSocket<any>) {
  clients.add(ws);
}

export function removeClient(ws: ServerWebSocket<any>) {
  clients.delete(ws);
}

export function broadcast(msg: any) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    ws.send(data);
  }
}

let frameCount = 0;
let lastFpsReport = Date.now();

// Report FPS to connected studio clients every second
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - lastFpsReport) / 1000;
  const fps = Math.round(frameCount / elapsed);
  frameCount = 0;
  lastFpsReport = now;
  broadcast({ type: 'FPS', fps });
}, 1000);

export function handleWsMessage(ws: ServerWebSocket<any>, message: string | Buffer) {
  try {
    if (typeof message !== 'string') {
      // Fast path for binary PIXEL_FRAME
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      if (buf.length >= 3 && buf[0] === 1) { // Type 1 = PIXEL_FRAME
        const offset = buf.readUInt16LE(1);
        const pixels = new Uint8Array(buf.buffer, buf.byteOffset + 3, buf.length - 3);
        const frame: PixelFrame = {
          pixels,
          offset,
          timestamp: Date.now(),
        };
        pipeline.feed(frame);
        frameCount++;
      }
      return;
    }

    const msg: WsMessage = JSON.parse(message.toString());
    switch (msg.type) {
      case 'PIXEL_FRAME': {
        // Fallback for old JSON pixel frames
        if (msg.payload) {
          const frame: PixelFrame = {
            pixels: new Uint8Array(msg.payload.pixels),
            offset: msg.payload.offset ?? 0,
            timestamp: msg.payload.timestamp ?? Date.now(),
          };
          pipeline.feed(frame);
          frameCount++;
        }
        break;
      }
      case 'WLED_STATE': {
        // Forward to WLED JSON API proxy
        if (msg.payload && state.targetIp) {
          fetch(`http://${state.targetIp}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.payload),
          }).catch(() => {});
        }
        break;
      }
      case 'SET_MODE': {
        if (msg.payload && ['stream', 'audio', 'preset', 'idle'].includes(msg.payload.mode)) {
          state.activeMode = msg.payload.mode;
          broadcast({ type: 'MODE_CHANGED', mode: state.activeMode });
        }
        break;
      }
      case 'SET_BRIGHTNESS': {
        if (msg.payload && typeof msg.payload.brightness === 'number') {
          state.brightness = Math.max(0, Math.min(255, msg.payload.brightness));
          // Also forward to WLED if available
          if (state.targetIp !== '127.0.0.1') {
            fetch(`http://${state.targetIp}/json/state`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bri: state.brightness }),
            }).catch(() => {});
          }
        }
        break;
      }
      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG', status: state }));
        break;
      }
    }
  } catch (err) {
    console.error('Failed to parse WS message', err);
  }
}
