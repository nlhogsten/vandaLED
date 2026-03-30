import { useEffect, useRef, useState, useCallback } from 'react';

export type DriverMode = 'stream' | 'audio' | 'preset' | 'idle';

export interface DriverStatus {
  targetIp: string;
  ddpPort: number;
  ledCount: number;
  activeMode: DriverMode;
  isHardwareConnected: boolean;
  brightness: number;
}

export interface UseDriverSocket {
  status: 'connected' | 'disconnected' | 'connecting';
  driverState: DriverStatus | null;
  fps: number;
  send: (type: string, payload?: any) => void;
  sendPixelFrame: (pixels: Uint8Array, offset?: number) => void;
  setMode: (mode: DriverMode) => void;
  onMessage: (handler: (msg: any) => void) => () => void;
}

const DRIVER_WS_URL = 'ws://localhost:3000';
const RECONNECT_DELAY = 2000;
const PING_INTERVAL = 3000;

export function useDriverSocket(): UseDriverSocket {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<(msg: any) => void>>(new Set());
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [driverState, setDriverState] = useState<DriverStatus | null>(null);
  const [fps, setFps] = useState(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(DRIVER_WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      // Start ping loop
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'PING' }));
        }
      }, PING_INTERVAL);
    };

    ws.onclose = () => {
      setStatus('disconnected');
      if (pingRef.current) clearInterval(pingRef.current);
      // Auto-reconnect
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'PONG' && msg.status) {
          setDriverState(msg.status);
        }
        if (msg.type === 'FPS') {
          setFps(msg.fps ?? 0);
        }

        // Broadcast to external handlers
        for (const handler of handlersRef.current) {
          handler(msg);
        }
      } catch {
        // ignore
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload?: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const sendPixelFrame = useCallback((pixels: Uint8Array, offset = 0) => {
    send('PIXEL_FRAME', { pixels: Array.from(pixels), offset, timestamp: Date.now() });
  }, [send]);

  const setMode = useCallback((mode: DriverMode) => {
    send('SET_MODE', { mode });
  }, [send]);

  const onMessage = useCallback((handler: (msg: any) => void) => {
    handlersRef.current.add(handler);
    return () => { handlersRef.current.delete(handler); };
  }, []);

  return { status, driverState, fps, send, sendPixelFrame, setMode, onMessage };
}
