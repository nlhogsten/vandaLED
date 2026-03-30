import React, { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@vandaled/ui-components';
import { DEFAULT_LAYOUT, HardwareLayout, deriveHardwareLayout } from '@vandaled/layout-engine';

const DRIVER_WS_URL = 'ws://localhost:3000';
const EMULATOR_WS_URL = 'ws://localhost:4049';

export default function App() {
  const [pixels, setPixels] = useState<Uint8Array>(new Uint8Array(300));
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [layout, setLayout] = useState<HardwareLayout>(DEFAULT_LAYOUT);

  useEffect(() => {
    let ws: WebSocket;

    function connect() {
      ws = new WebSocket(EMULATOR_WS_URL);

      ws.onopen = () => setStatus('connected');
      ws.onclose = () => {
        setStatus('disconnected');
        setTimeout(connect, 2000);
      };

      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === 'FPS') {
            setFps(data.fps);
          } else if (data.type === 'FRAME') {
            const arr = new Uint8Array(data.frame.pixels);
            setPixels((prev) => {
              const next = new Uint8Array(Math.max(prev.length, (data.frame.offset * 3) + arr.length));
              next.set(prev);
              next.set(arr, data.frame.offset * 3);
              return next;
            });
          }
        } catch {
          // Ignore bad data
        }
      };
    }

    connect();
    return () => ws?.close();
  }, []);

  useEffect(() => {
    const ws = new WebSocket(DRIVER_WS_URL);
    ws.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'STATE' && data.payload?.hardwareLayout) {
          setLayout(data.payload.hardwareLayout);
        }
        if (data.type === 'LAYOUT_SYNC' && data.payload?.nodes) {
          setLayout(data.payload);
        }
      } catch {
        // Ignore bad data
      }
    };
    return () => ws.close();
  }, []);

  const derived = useMemo(() => deriveHardwareLayout(layout), [layout]);
  const points = derived.ledPoints;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  return (
    <div className="main-content emulator-page">
      <div className="glass-panel w-full" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 className="glow-text text-center">vandaLED Emulator</h2>
        <div className="flex gap-4 justify-center items-center mb-1" style={{ marginBottom: '2rem' }}>
          <StatusBadge status={status === 'connected' ? 'emulating' : 'disconnected'} />
          <span className="font-mono text-muted-foreground">FPS: <span className="text-primary font-bold">{fps}</span></span>
          <span className="font-mono text-muted-foreground">Segments: <span className="text-white font-bold">{derived.nodes.length}</span></span>
          <span className="font-mono text-muted-foreground">LEDs: <span className="text-white font-bold">{Math.max(derived.physicalLedCount, Math.floor(pixels.length / 3))}</span></span>
        </div>

        <div className="emulator-stage">
          {derived.nodes.map((node) => (
            <div key={node.id} className="emulator-label" style={{ left: `${((node.x - minX) / width) * 100}%`, top: `${((node.y - minY) / height) * 100}%` }}>
              <strong>{node.label}</strong>
              <span className="font-mono text-xs">#{node.physicalStart}-{node.physicalEnd}</span>
            </div>
          ))}
          {points.map((point, index) => {
            const r = pixels[point.physicalIndex * 3] ?? 0;
            const g = pixels[point.physicalIndex * 3 + 1] ?? 0;
            const b = pixels[point.physicalIndex * 3 + 2] ?? 0;
            return (
              <div
                key={`${point.nodeId}-${point.localIndex}`}
                className="layout-preview-led emulator-led"
                title={`${point.label} • physical #${point.physicalIndex}`}
                style={{
                  left: `${((point.x - minX) / width) * 100}%`,
                  top: `${height <= 1 ? 50 : ((point.y - minY) / height) * 100}%`,
                  backgroundColor: `rgb(${r},${g},${b})`,
                  boxShadow: r + g + b > 0 ? `0 0 12px rgba(${r},${g},${b},0.9)` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
