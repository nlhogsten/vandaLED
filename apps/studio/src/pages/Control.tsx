import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';
import { StatusBadge, Knob, FrequencyBar, PixelDot } from '@vandaled/ui-components';
import { useThrottledStream } from '../hooks/useThrottledStream';

// --- EFFECTS ENGINE ---
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

export function Control() {
  const { status, driverState, fps, setMode, send } = useDriver();
  
  // Consolidation State
  const [activeTab, setActiveTab] = useState<'status' | 'effects' | 'audio'>('status');
  const [targetFps, setTargetFps] = useState(30);
  const { pushFrame, currentPixels, setCurrentPixels } = useThrottledStream(targetFps);
  const ledCount = driverState?.ledCount ?? 100;
  const hwStatus = status !== 'connected' ? 'disconnected' : driverState?.isHardwareConnected ? 'connected' : 'emulating';
  const brightness = driverState?.brightness ?? 255;
  const activeMode = driverState?.activeMode ?? 'idle';

  // Reference for stopping previous logic when switching tabs
  const stopAudioRef = useRef<() => void>();
  const stopEffectRef = useRef<() => void>();

  const handleTabChange = (tab: 'status' | 'effects' | 'audio') => {
    setActiveTab(tab);
    if (tab !== 'effects' && stopEffectRef.current) stopEffectRef.current();
    if (tab !== 'audio' && stopAudioRef.current) stopAudioRef.current();
  };

  // --- PREVIEW RENDER ---
  const previewLeds = [];
  if (currentPixels) {
    const previewCount = Math.floor(currentPixels.length / 3);
    for (let i = 0; i < previewCount; i++) {
      previewLeds.push({ r: currentPixels[i*3], g: currentPixels[i*3+1], b: currentPixels[i*3+2] });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h2>Control Center</h2>
          <p className="mb-0 text-sm text-muted-foreground">Manage modes, effects, and audio reactivity</p>
        </div>
        <div className="flex bg-surface border rounded p-1">
          <button className={`mode-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => handleTabChange('status')}>Status</button>
          <button className={`mode-btn ${activeTab === 'effects' ? 'active' : ''}`} onClick={() => handleTabChange('effects')}>Effects</button>
          <button className={`mode-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => handleTabChange('audio')}>Audio</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {activeTab === 'status' && (
          <StatusTab driverState={driverState} hwStatus={hwStatus} fps={fps} brightness={brightness} send={send} setMode={setMode} activeMode={activeMode} />
        )}
        {activeTab === 'effects' && (
          <EffectsTab ledCount={ledCount} pushFrame={pushFrame} setMode={setMode} stopRef={stopEffectRef} />
        )}
        {activeTab === 'audio' && (
          <AudioTab ledCount={ledCount} pushFrame={pushFrame} setMode={setMode} stopRef={stopAudioRef} />
        )}
      </div>

      {/* Live Preview Strip */}
      <div className="dashboard-card" style={{ marginTop: 'auto' }}>
        <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="card-label mb-0">Live Preview Strip</div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Target FPS:</span>
            <select className="terminal-input" style={{ padding: '2px 8px', fontSize: '10px', height: 'auto' }} value={targetFps} onChange={e => setTargetFps(Number(e.target.value))}>
              <option value={15}>15 FPS (Eco)</option>
              <option value={30}>30 FPS (Standard)</option>
              <option value={60}>60 FPS (Silky)</option>
            </select>
          </div>
        </div>
        <div style={{ 
          display: 'flex', gap: '4px', overflowX: 'hidden', padding: '12px', background: '#000', borderRadius: '4px', 
          border: '1px solid rgba(0, 245, 255, 0.1)', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)'
        }}>
          {previewLeds.length > 0 ? previewLeds.map((led, i) => (
            <div key={i} style={{ 
              width: `${Math.min(12, 100 / previewLeds.length)}%`, minWidth: '4px', height: '12px', borderRadius: '2px',
              backgroundColor: `rgb(${led.r},${led.g},${led.b})`,
              boxShadow: (led.r + led.g + led.b > 0) ? `0 0 6px rgba(${led.r},${led.g},${led.b},0.8)` : 'none'
            }} />
          )) : (
            <div className="w-full text-center text-xs font-mono text-muted-foreground py-2">No active pixel stream</div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- TAB COMPONENTS ---

function StatusTab({ driverState, hwStatus, fps, brightness, send, setMode, activeMode }: any) {
  const targetIp = driverState?.targetIp ?? '—';
  const ledCount = driverState?.ledCount ?? 100;
  
  return (
    <div className="studio-grid">
      <div className="dashboard-card">
        <div className="card-label">Connection</div>
        <div className="flex items-center gap-4 mt-3">
          <StatusBadge status={hwStatus} />
          <span className="font-mono text-sm text-muted-foreground">{targetIp}:{driverState?.ddpPort ?? 4048}</span>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="stat-block"><span className="stat-value text-primary">{fps}</span><span className="stat-label">FPS</span></div>
          <div className="stat-block"><span className="stat-value">{ledCount}</span><span className="stat-label">LEDs</span></div>
          <div className="stat-block"><span className="stat-value">{Math.round((brightness / 255) * 100)}%</span><span className="stat-label">Brightness</span></div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Active Mode</div>
        <div className="mode-selector mt-3">
          {(['idle', 'stream', 'audio', 'preset'] as const).map((mode) => (
            <button key={mode} className={`mode-btn ${activeMode === mode ? 'active' : ''}`} onClick={() => setMode(mode)}>{mode}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">Hardware mode fallback behavior. Use Effects/Audio tabs to override with laptop.</p>
      </div>

      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Brightness</div>
        <div className="flex items-center gap-4 mt-4 justify-center">
          <Knob value={brightness} min={0} max={255} onChange={(val) => send('SET_BRIGHTNESS', { brightness: val })} />
          <span className="font-mono text-primary text-lg font-bold">{brightness}</span>
        </div>
        <input type="range" min={0} max={255} value={brightness} className="brightness-slider w-full mt-4" onChange={(e) => send('SET_BRIGHTNESS', { brightness: parseInt(e.target.value) })} />
      </div>
    </div>
  );
}

function EffectsTab({ ledCount, pushFrame, setMode, stopRef }: any) {
  const [activeEffect, setActiveEffect] = useState('rainbow');
  const [speed, setSpeed] = useState(50);
  const [intensity, setIntensity] = useState(50);
  const [color1, setColor1] = useState('#00F5FF');
  const [color2, setColor2] = useState('#39FF14');
  const [isPlaying, setIsPlaying] = useState(false);

  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    stopRef.current = stop;
    return stop;
  }, [stop, stopRef]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    setMode('stream');
    let running = true;
    
    const loop = () => {
      if (!running) return;
      
      const effect = EFFECTS[activeEffect];
      if (effect) {
        const cfg: EffectConfig = { speed, intensity, color1: hexToRgb(color1), color2: hexToRgb(color2) };
        const pixels = effect.fn(ledCount, tickRef.current, cfg);
        pushFrame(pixels);
        tickRef.current++;
      }
      
      rafRef.current = requestAnimationFrame(loop);
    };
    
    loop();
    return () => { running = false; };
  }, [isPlaying, activeEffect, speed, intensity, color1, color2, ledCount, pushFrame, setMode]);

  return (
    <div className="studio-grid">
      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Select Generator</div>
        <div className="effect-grid">
          {Object.entries(EFFECTS).map(([key, { label }]) => (
            <button key={key} className={`effect-tile ${activeEffect === key ? 'active' : ''}`} onClick={() => setActiveEffect(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Palette</div>
        <div className="flex flex-col gap-4 mt-3">
          <div className="color-control">
            <label className="font-mono text-sm text-muted-foreground">Primary</label>
            <div className="color-input-row">
              <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} className="color-picker" />
              <span className="font-mono text-sm">{color1.toUpperCase()}</span>
            </div>
          </div>
          <div className="color-control">
            <label className="font-mono text-sm text-muted-foreground">Secondary</label>
            <div className="color-input-row">
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} className="color-picker" />
              <span className="font-mono text-sm">{color2.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Parameters</div>
        <div className="flex flex-col gap-5 mt-4">
          <div className="slider-group">
            <div className="flex justify-between w-full">
              <label className="font-mono text-sm text-muted-foreground">Speed</label>
              <span className="font-mono text-sm text-primary font-bold">{speed}</span>
            </div>
            <input type="range" min={1} max={100} value={speed} className="brightness-slider w-full" onChange={(e) => setSpeed(parseInt(e.target.value))} />
          </div>
          <div className="slider-group">
            <div className="flex justify-between w-full">
              <label className="font-mono text-sm text-muted-foreground">Intensity</label>
              <span className="font-mono text-sm text-primary font-bold">{intensity}</span>
            </div>
            <input type="range" min={1} max={100} value={intensity} className="brightness-slider w-full" onChange={(e) => setIntensity(parseInt(e.target.value))} />
          </div>
          
          <button className={`action-btn w-full mt-2 ${isPlaying ? 'stop' : ''}`} onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? '■ Stop Stream' : '▶ Start Stream'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AudioTab({ ledCount, pushFrame, setMode, stopRef }: any) {
  const [devices, setDevices] = useState<{deviceId: string, label: string}[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [bands, setBands] = useState<Float32Array>(new Float32Array(16));
  const [peak, setPeak] = useState(0);
  const [gain, setGain] = useState(1.5);
  const bandCount = 16;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(all => {
      const inputs = all.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));
      setDevices([{ deviceId: 'system', label: '🖥️ System Audio / Display Capture' }, ...inputs]);
    }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setBands(new Float32Array(bandCount));
    setPeak(0);
  }, [bandCount]);

  useEffect(() => {
    stopRef.current = stop;
    return stop;
  }, [stop, stopRef]);

  const start = async () => {
    if (!selectedDevice) return;
    try {
      let stream: MediaStream;
      if (selectedDevice === 'system') {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: selectedDevice } } });
      }
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;
      source.connect(analyser);

      setIsListening(true);
      setMode('audio');

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        const newBands = new Float32Array(bandCount);
        const step = Math.floor(analyser.frequencyBinCount / bandCount);
        let peakVal = 0;

        for (let i = 0; i < bandCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) { sum += dataArray[i * step + j] / 255.0; }
          const avg = (sum / step) * gain;
          newBands[i] = Math.min(1, avg);
          if (avg > peakVal) peakVal = avg;
        }

        setBands(newBands);
        setPeak(Math.min(1, peakVal));

        const pixels = new Uint8Array(ledCount * 3);
        const ledsPerBand = Math.floor(ledCount / bandCount);

        for (let band = 0; band < bandCount; band++) {
          const val = newBands[band];
          const hue = (band / bandCount) * 330;
          const [r, g, b] = hslToRgb(hue, 100, Math.round(val * 50));
          for (let led = 0; led < ledsPerBand; led++) {
            const idx = (band * ledsPerBand + led) * 3;
            if (idx + 2 < pixels.length) { pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; }
          }
        }

        pushFrame(pixels);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (err) { console.error('Audio start failed', err); }
  };

  return (
    <div className="studio-grid">
      <div className="dashboard-card">
        <div className="card-label">Hardware Input</div>
        <select className="terminal-input w-full mt-3" value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)}>
          <option value="" disabled>Select audio source...</option>
          {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
        <div className="flex items-center gap-4 mt-4 justify-between">
          <StatusBadge status={isListening ? 'connected' : 'disconnected'} />
          <button className={`action-btn ${isListening ? 'stop' : ''}`} onClick={isListening ? stop : start}>
            {isListening ? '■ Stop Audio' : '🎤 Listen'}
          </button>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Gain</div>
        <div className="flex items-center gap-4 mt-4">
          <input type="range" min={0.5} max={5} step={0.1} value={gain} className="brightness-slider flex-1" onChange={(e) => setGain(parseFloat(e.target.value))} />
          <span className="font-mono text-primary font-bold">{gain.toFixed(1)}x</span>
        </div>
        <div className="stat-block mt-4">
          <span className="stat-value text-primary">{Math.round(peak * 100)}%</span>
          <span className="stat-label">Peak Level</span>
        </div>
      </div>

      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Frequency Spectrum</div>
        <div className="frequency-visualizer">
          {Array.from(bands).map((val, i) => (
            <div key={i} className="freq-bar-wrapper">
              <FrequencyBar value={val} />
              <span className="font-mono text-xs text-muted-foreground mt-1 text-center">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
