import { ServerWebSocket } from 'bun';
import { state } from '../state';
import { pipeline } from '../services/pixel-pipeline';
import { PixelFrame } from '@vandaled/ddp-engine';
import { normalizeHardwareLayout } from '@vandaled/layout-engine';

export interface WsMessage {
  type: 'PIXEL_FRAME' | 'WLED_STATE' | 'SET_MODE' | 'SET_BRIGHTNESS' | 'PING' | 'STATE' | 'LAYOUT_SYNC';
  payload?: unknown;
}

const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>) {
  clients.add(ws);
  sendState(ws);
}

export function removeClient(ws: ServerWebSocket<unknown>) {
  clients.delete(ws);
}

export function broadcast(msg: unknown) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    ws.send(data);
  }
}

export function sendState(ws: ServerWebSocket<unknown>) {
  ws.send(JSON.stringify({ type: 'STATE', payload: state }));
}

export function broadcastState() {
  broadcast({ type: 'STATE', payload: state });
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

function normalizeMode(mode: unknown) {
  switch (mode) {
    case 'stream':
      return 'override_effect';
    case 'audio':
      return 'override_audio';
    case 'preset':
      return 'wled_preset';
    case 'idle':
    case 'standalone':
    case 'wled_preset':
    case 'override_effect':
    case 'override_audio':
      return mode;
    default:
      return null;
  }
}

export function handleWsMessage(ws: ServerWebSocket<unknown>, message: string | Buffer) {
  try {
    if (typeof message !== 'string') {
      const buf = Buffer.isBuffer(message) ? message : Buffer.from(message);
      if (buf.length >= 3 && buf[0] === 1) {
        const offset = buf.readUInt16LE(1);
        const pixels = new Uint8Array(buf.buffer, buf.byteOffset + 3, buf.length - 3);
        const frame: PixelFrame = {
          pixels,
          offset,
          timestamp: Date.now(),
        };
        pipeline.feed(frame);
        state.lastFrameAt = Date.now();
        frameCount++;
      }
      return;
    }

    const msg: WsMessage = JSON.parse(message.toString());
    switch (msg.type) {
      case 'PIXEL_FRAME': {
        if (msg.payload && typeof msg.payload === 'object' && msg.payload !== null) {
          const payload = msg.payload as { pixels: ArrayLike<number>; offset?: number; timestamp?: number };
          const frame: PixelFrame = {
            pixels: new Uint8Array(payload.pixels),
            offset: payload.offset ?? 0,
            timestamp: payload.timestamp ?? Date.now(),
          };
          pipeline.feed(frame);
          state.lastFrameAt = Date.now();
          frameCount++;
        }
        break;
      }
      case 'WLED_STATE': {
        if (msg.payload && state.targetIp) {
          state.activeMode = 'wled_preset';
          fetch(`http://${state.targetIp}/json/state`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg.payload),
          }).catch(() => {});
          broadcastState();
        }
        break;
      }
      case 'SET_MODE': {
        if (msg.payload && typeof msg.payload === 'object' && msg.payload !== null) {
          const mode = normalizeMode((msg.payload as { mode?: unknown }).mode);
          if (mode) {
            state.activeMode = mode;
            broadcast({ type: 'MODE_CHANGED', mode: state.activeMode });
            broadcastState();
          }
        }
        break;
      }
      case 'SET_BRIGHTNESS': {
        if (msg.payload && typeof msg.payload === 'object' && msg.payload !== null && typeof (msg.payload as { brightness?: unknown }).brightness === 'number') {
          const brightness = (msg.payload as { brightness: number }).brightness;
          state.brightness = Math.max(0, Math.min(255, brightness));
          if (state.targetIp !== '127.0.0.1') {
            fetch(`http://${state.targetIp}/json/state`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bri: state.brightness }),
            }).catch(() => {});
          }
          broadcastState();
        }
        break;
      }
      case 'LAYOUT_SYNC': {
        if (msg.payload && typeof msg.payload === 'object' && msg.payload !== null && Array.isArray((msg.payload as { nodes?: unknown[] }).nodes)) {
          state.hardwareLayout = normalizeHardwareLayout(msg.payload);
          broadcast({ type: 'LAYOUT_SYNC', payload: state.hardwareLayout });
          broadcastState();
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
