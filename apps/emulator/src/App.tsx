import React, { useEffect, useState, useRef } from 'react';
import { PixelDot, StatusBadge } from '@vandaled/ui-components';

export default function App() {
  const [pixels, setPixels] = useState<Uint8Array>(new Uint8Array(300)); // 100 LEDs
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    let ws: WebSocket;
    
    function connect() {
      ws = new WebSocket('ws://localhost:4049');
      
      ws.onopen = () => setStatus('connected');
      ws.onclose = () => {
        setStatus('disconnected');
        setTimeout(connect, 2000);
      };
      
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.type === 'FPS') setFps(data.fps);
          else if (data.type === 'FRAME') {
            const arr = new Uint8Array(data.frame.pixels);
            setPixels((prev) => {
              const next = new Uint8Array(prev);
              next.set(arr, data.frame.offset * 3);
              return next;
            });
          }
        } catch (e) {}
      };
    }

    connect();
    return () => ws?.close();
  }, []);

  const ledCount = Math.floor(pixels.length / 3);
  const leds = [];
  for (let i = 0; i < ledCount; i++) {
    leds.push({ r: pixels[i*3], g: pixels[i*3+1], b: pixels[i*3+2] });
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>vandaLED Emulator</h1>
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px' }}>
        <StatusBadge status={status === 'connected' ? 'emulating' : 'disconnected'} />
        <span>FPS: {fps}</span>
        <span>LED Context: {ledCount}</span>
      </div>
      
      {/* 10 x 10 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 16px)', gap: '4px' }}>
        {leds.map((led, i) => (
          <PixelDot key={i} r={led.r} g={led.g} b={led.b} size={16} />
        ))}
      </div>
    </div>
  );
}
