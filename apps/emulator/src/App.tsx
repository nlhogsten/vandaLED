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
    <div className="main-content" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="glass-panel w-full" style={{ maxWidth: 800 }}>
        <h2 className="glow-text text-center">vandaLED Emulator</h2>
        <div className="flex gap-4 justify-center items-center mb-1" style={{ marginBottom: '2rem' }}>
          <StatusBadge status={status === 'connected' ? 'emulating' : 'disconnected'} />
          <span className="font-mono text-muted-foreground">FPS: <span className="text-primary font-bold">{fps}</span></span>
          <span className="font-mono text-muted-foreground">Context: <span className="text-white font-bold">{ledCount} LEDs</span></span>
        </div>
        
        {/* LED display grid */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', background: '#000', borderRadius: '8px', border: '1px solid var(--border)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 20px)', gap: '6px' }}>
            {leds.map((led, i) => (
              <PixelDot key={i} r={led.r} g={led.g} b={led.b} size={20} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
