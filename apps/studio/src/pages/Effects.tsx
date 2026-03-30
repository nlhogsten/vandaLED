import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDriver } from '../context/DriverContext';

// ── Built-in effect generators ──────────────────────────────────────
type EffectFn = (ledCount: number, t: number, config: EffectConfig) => Uint8Array;

interface EffectConfig {
  speed: number;       // 1–100 
  intensity: number;   // 1–100
  color1: [number, number, number];
  color2: [number, number, number];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const EFFECTS: Record<string, { label: string; fn: EffectFn }> = {
  solid: {
    label: 'Solid Color',
    fn: (count, _t, cfg) => {
      const px = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++) {
        px[i * 3] = cfg.color1[0];
        px[i * 3 + 1] = cfg.color1[1];
        px[i * 3 + 2] = cfg.color1[2];
      }
      return px;
    }
  },
  rainbow: {
    label: 'Rainbow Cycle',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 20;
      for (let i = 0; i < count; i++) {
        const hue = ((i / count) * 360 + t * speed) % 360;
        const [r, g, b] = hslToRgb(hue, 100, 50);
        px[i * 3] = r;
        px[i * 3 + 1] = g;
        px[i * 3 + 2] = b;
      }
      return px;
    }
  },
  pulse: {
    label: 'Pulse',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 30;
      const intensity = (Math.sin(t * speed * 0.1) + 1) / 2;
      for (let i = 0; i < count; i++) {
        px[i * 3] = Math.round(cfg.color1[0] * intensity);
        px[i * 3 + 1] = Math.round(cfg.color1[1] * intensity);
        px[i * 3 + 2] = Math.round(cfg.color1[2] * intensity);
      }
      return px;
    }
  },
  chase: {
    label: 'Color Chase',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 10;
      const width = Math.max(2, Math.floor(count * (cfg.intensity / 100) * 0.5));
      const pos = Math.floor(t * speed) % count;
      for (let i = 0; i < count; i++) {
        const dist = (i - pos + count) % count;
        if (dist < width) {
          const fade = 1 - (dist / width);
          px[i * 3] = Math.round(cfg.color1[0] * fade + cfg.color2[0] * (1 - fade));
          px[i * 3 + 1] = Math.round(cfg.color1[1] * fade + cfg.color2[1] * (1 - fade));
          px[i * 3 + 2] = Math.round(cfg.color1[2] * fade + cfg.color2[2] * (1 - fade));
        }
      }
      return px;
    }
  },
  gradient: {
    label: 'Dual Gradient',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 50;
      const shift = (Math.sin(t * speed * 0.05) + 1) / 2;
      for (let i = 0; i < count; i++) {
        const mix = (i / count + shift) % 1;
        px[i * 3] = Math.round(cfg.color1[0] * (1 - mix) + cfg.color2[0] * mix);
        px[i * 3 + 1] = Math.round(cfg.color1[1] * (1 - mix) + cfg.color2[1] * mix);
        px[i * 3 + 2] = Math.round(cfg.color1[2] * (1 - mix) + cfg.color2[2] * mix);
      }
      return px;
    }
  },
  sparkle: {
    label: 'Sparkle',
    fn: (count, _t, cfg) => {
      const px = new Uint8Array(count * 3);
      const density = cfg.intensity / 100;
      for (let i = 0; i < count; i++) {
        if (Math.random() < density * 0.3) {
          px[i * 3] = cfg.color1[0];
          px[i * 3 + 1] = cfg.color1[1];
          px[i * 3 + 2] = cfg.color1[2];
        }
      }
      return px;
    }
  },
  fire: {
    label: 'Fire',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 25;
      for (let i = 0; i < count; i++) {
        const flicker = Math.random() * 0.4 + 0.6;
        const wave = (Math.sin((i * 0.3) + t * speed * 0.1) + 1) / 2;
        const heat = flicker * wave * (cfg.intensity / 100);
        // Fire: red → orange → yellow
        px[i * 3] = Math.round(255 * heat);
        px[i * 3 + 1] = Math.round(100 * heat * heat);
        px[i * 3 + 2] = Math.round(20 * heat * heat * heat);
      }
      return px;
    }
  },
  ocean: {
    label: 'Ocean Wave',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 30;
      for (let i = 0; i < count; i++) {
        const wave1 = (Math.sin((i * 0.15) + t * speed * 0.08) + 1) / 2;
        const wave2 = (Math.sin((i * 0.08) - t * speed * 0.05) + 1) / 2;
        const combined = wave1 * 0.6 + wave2 * 0.4;
        px[i * 3] = Math.round(0 * combined);
        px[i * 3 + 1] = Math.round(150 * combined + 50);
        px[i * 3 + 2] = Math.round(255 * combined);
      }
      return px;
    }
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

export function Effects() {
  const { send, driverState, setMode } = useDriver();
  const ledCount = driverState?.ledCount ?? 100;

  const [activeEffect, setActiveEffect] = useState('rainbow');
  const [speed, setSpeed] = useState(50);
  const [intensity, setIntensity] = useState(50);
  const [color1, setColor1] = useState('#00F5FF');
  const [color2, setColor2] = useState('#39FF14');
  const [isPlaying, setIsPlaying] = useState(false);

  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const sendFrame = useCallback(() => {
    const effect = EFFECTS[activeEffect];
    if (!effect) return;

    const cfg: EffectConfig = {
      speed,
      intensity,
      color1: hexToRgb(color1),
      color2: hexToRgb(color2),
    };

    const pixels = effect.fn(ledCount, tickRef.current, cfg);
    send('PIXEL_FRAME', {
      pixels: Array.from(pixels),
      offset: 0,
      timestamp: Date.now(),
    });
    tickRef.current++;
  }, [activeEffect, speed, intensity, color1, color2, ledCount, send]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    setMode('stream');
    let running = true;
    const loop = () => {
      if (!running) return;
      sendFrame();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, sendFrame, setMode]);

  return (
    <div>
      <h2>Effects</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>Select and preview visual effects in real time</p>

      <div className="studio-grid">
        {/* Effect Selector */}
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-label">Effect</div>
          <div className="effect-grid">
            {Object.entries(EFFECTS).map(([key, { label }]) => (
              <button
                key={key}
                className={`effect-tile ${activeEffect === key ? 'active' : ''}`}
                onClick={() => setActiveEffect(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Color Controls */}
        <div className="dashboard-card">
          <div className="card-label">Colors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div className="color-control">
              <label className="font-mono text-sm text-muted-foreground">Primary</label>
              <div className="color-input-row">
                <input
                  type="color"
                  value={color1}
                  onChange={(e) => setColor1(e.target.value)}
                  className="color-picker"
                />
                <span className="font-mono text-sm">{color1.toUpperCase()}</span>
              </div>
            </div>
            <div className="color-control">
              <label className="font-mono text-sm text-muted-foreground">Secondary</label>
              <div className="color-input-row">
                <input
                  type="color"
                  value={color2}
                  onChange={(e) => setColor2(e.target.value)}
                  className="color-picker"
                />
                <span className="font-mono text-sm">{color2.toUpperCase()}</span>
              </div>
            </div>

            {/* Color presets */}
            <div className="card-label" style={{ marginTop: '8px' }}>Presets</div>
            <div className="quick-colors">
              {[
                '#00F5FF', '#39FF14', '#FF0055', '#FFA000',
                '#8A2BE2', '#FF1493', '#00FF88', '#FFD700',
              ].map((hex) => (
                <button
                  key={hex}
                  className="color-swatch small"
                  style={{
                    backgroundColor: hex,
                    boxShadow: `0 0 8px ${hex}66`,
                  }}
                  onClick={() => setColor1(hex)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Speed & Intensity */}
        <div className="dashboard-card">
          <div className="card-label">Parameters</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
            <div className="slider-group">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <label className="font-mono text-sm text-muted-foreground">Speed</label>
                <span className="font-mono text-sm text-primary font-bold">{speed}</span>
              </div>
              <input
                type="range" min={1} max={100} value={speed}
                className="brightness-slider"
                onChange={(e) => setSpeed(parseInt(e.target.value))}
              />
            </div>
            <div className="slider-group">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <label className="font-mono text-sm text-muted-foreground">Intensity</label>
                <span className="font-mono text-sm text-primary font-bold">{intensity}</span>
              </div>
              <input
                type="range" min={1} max={100} value={intensity}
                className="brightness-slider"
                onChange={(e) => setIntensity(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Play/Stop */}
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="flex items-center gap-4" style={{ justifyContent: 'space-between' }}>
            <div className="flex items-center gap-4">
              <div className={`play-indicator ${isPlaying ? 'live' : ''}`} />
              <span className="font-mono text-sm">
                {isPlaying ? 'STREAMING' : 'STOPPED'} — {EFFECTS[activeEffect]?.label}
              </span>
            </div>
            <button
              className={`action-btn ${isPlaying ? 'stop' : ''}`}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '■ Stop' : '▶ Stream'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
