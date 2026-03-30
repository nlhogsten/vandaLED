import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';
import { StatusBadge, Knob, FrequencyBar } from '@vandaled/ui-components';
import type { ConnectionStatus } from '@vandaled/ui-components';
import { useThrottledStream } from '../hooks/useThrottledStream';
import {
  DEFAULT_OVERRIDE_EFFECT,
  EffectId,
  OVERRIDE_EFFECT_EVENT,
  OverrideEffectConfig,
  PRESET_ACTIVATED_EVENT,
  loadOverrideEffectConfig,
  saveOverrideEffectConfig,
} from '../lib/override-state';
import {
  TUBE_LAYOUT_EVENT,
  getTubeLayoutLogicalLedCount,
  getTubeLayoutPhysicalLedCount,
  loadTubeLayout,
  remapPixelsToTubeLayout,
  Tube,
} from '../lib/mapper';

type EffectFn = (ledCount: number, t: number, config: EffectConfig) => Uint8Array;

interface EffectConfig {
  speed: number;
  intensity: number;
  color1: [number, number, number];
  color2: [number, number, number];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const EFFECTS: Record<EffectId, { label: string; fn: EffectFn }> = {
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
    },
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
    },
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
    },
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
          const fade = 1 - dist / width;
          px[i * 3] = Math.round(cfg.color1[0] * fade + cfg.color2[0] * (1 - fade));
          px[i * 3 + 1] = Math.round(cfg.color1[1] * fade + cfg.color2[1] * (1 - fade));
          px[i * 3 + 2] = Math.round(cfg.color1[2] * fade + cfg.color2[2] * (1 - fade));
        }
      }
      return px;
    },
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
    },
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
    },
  },
  fire: {
    label: 'Fire',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 25;
      for (let i = 0; i < count; i++) {
        const flicker = Math.random() * 0.4 + 0.6;
        const wave = (Math.sin(i * 0.3 + t * speed * 0.1) + 1) / 2;
        const heat = flicker * wave * (cfg.intensity / 100);
        px[i * 3] = Math.round(255 * heat);
        px[i * 3 + 1] = Math.round(100 * heat * heat);
        px[i * 3 + 2] = Math.round(20 * heat * heat * heat);
      }
      return px;
    },
  },
  ocean: {
    label: 'Ocean Wave',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const speed = cfg.speed / 30;
      for (let i = 0; i < count; i++) {
        const wave1 = (Math.sin(i * 0.15 + t * speed * 0.08) + 1) / 2;
        const wave2 = (Math.sin(i * 0.08 - t * speed * 0.05) + 1) / 2;
        const combined = wave1 * 0.6 + wave2 * 0.4;
        px[i * 3] = 0;
        px[i * 3 + 1] = Math.round(150 * combined + 50);
        px[i * 3 + 2] = Math.round(255 * combined);
      }
      return px;
    },
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function Control() {
  const { status, driverState, fps, setMode, send } = useDriver();
  const [activeTab, setActiveTab] = useState<'status' | 'effects' | 'audio'>('status');
  const [effectConfig, setEffectConfig] = useState<OverrideEffectConfig>(loadOverrideEffectConfig);
  const [tubes, setTubes] = useState<Tube[]>(loadTubeLayout);
  const logicalLedCount = tubes.length > 0
    ? getTubeLayoutLogicalLedCount(tubes)
    : driverState?.ledCount ?? 100;
  const physicalLedCount = Math.max(
    driverState?.ledCount ?? 100,
    tubes.length > 0 ? getTubeLayoutPhysicalLedCount(tubes) : 0
  );
  const { pushFrame, currentPixels } = useThrottledStream(effectConfig.targetFps);
  const hwStatus: ConnectionStatus = status !== 'connected'
    ? 'disconnected'
    : driverState?.transport === 'emulator'
      ? 'emulating'
      : driverState?.isHardwareConnected
        ? 'connected'
        : 'disconnected';
  const brightness = driverState?.brightness ?? 255;
  const activeMode = driverState?.activeMode ?? 'idle';

  const stopAudioRef = useRef<() => void>(() => {});
  const stopEffectRef = useRef<() => void>(() => {});

  useEffect(() => {
    saveOverrideEffectConfig(effectConfig);
  }, [effectConfig]);

  useEffect(() => {
    const handleLayoutChange = (event: Event) => {
      const detail = (event as CustomEvent<Tube[]>).detail;
      setTubes(Array.isArray(detail) ? detail : loadTubeLayout());
    };
    const handleEffectChange = (event: Event) => {
      const detail = (event as CustomEvent<OverrideEffectConfig>).detail;
      setEffectConfig(detail ?? loadOverrideEffectConfig());
    };
    const handlePresetActivation = () => {
      setActiveTab('effects');
    };

    window.addEventListener(TUBE_LAYOUT_EVENT, handleLayoutChange);
    window.addEventListener(OVERRIDE_EFFECT_EVENT, handleEffectChange);
    window.addEventListener(PRESET_ACTIVATED_EVENT, handlePresetActivation);

    return () => {
      window.removeEventListener(TUBE_LAYOUT_EVENT, handleLayoutChange);
      window.removeEventListener(OVERRIDE_EFFECT_EVENT, handleEffectChange);
      window.removeEventListener(PRESET_ACTIVATED_EVENT, handlePresetActivation);
    };
  }, []);

  const pushMappedFrame = useCallback((pixels: Uint8Array) => {
    const mapped = remapPixelsToTubeLayout(pixels, tubes, physicalLedCount);
    pushFrame(mapped);
  }, [physicalLedCount, pushFrame, tubes]);

  const handleTabChange = (tab: 'status' | 'effects' | 'audio') => {
    setActiveTab(tab);
    if (tab !== 'effects') stopEffectRef.current();
    if (tab !== 'audio') stopAudioRef.current();
  };

  const previewLeds = [];
  if (currentPixels) {
    const previewCount = Math.floor(currentPixels.length / 3);
    for (let i = 0; i < previewCount; i++) {
      previewLeds.push({
        r: currentPixels[i * 3],
        g: currentPixels[i * 3 + 1],
        b: currentPixels[i * 3 + 2],
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h2>Control Center</h2>
          <p className="mb-0 text-sm text-muted-foreground">
            Standalone WLED stays on hardware. Override modes stream custom visuals from the laptop.
          </p>
        </div>
        <div className="flex bg-surface border rounded p-1">
          <button className={`mode-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => handleTabChange('status')}>Status</button>
          <button className={`mode-btn ${activeTab === 'effects' ? 'active' : ''}`} onClick={() => handleTabChange('effects')}>Effects</button>
          <button className={`mode-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => handleTabChange('audio')}>Audio</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {activeTab === 'status' && (
          <StatusTab
            driverState={driverState}
            hwStatus={hwStatus}
            fps={fps}
            brightness={brightness}
            send={send}
            setMode={setMode}
            activeMode={activeMode}
            logicalLedCount={logicalLedCount}
            physicalLedCount={physicalLedCount}
          />
        )}
        {activeTab === 'effects' && (
          <EffectsTab
            logicalLedCount={logicalLedCount}
            pushFrame={pushMappedFrame}
            setMode={setMode}
            stopRef={stopEffectRef}
            config={effectConfig}
            onConfigChange={setEffectConfig}
          />
        )}
        {activeTab === 'audio' && (
          <AudioTab
            logicalLedCount={logicalLedCount}
            pushFrame={pushMappedFrame}
            setMode={setMode}
            stopRef={stopAudioRef}
          />
        )}
      </div>

      <div className="dashboard-card" style={{ marginTop: 'auto' }}>
        <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '12px' }}>
          <div className="card-label mb-0">Live Preview Strip</div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              Logical {logicalLedCount} / Physical {physicalLedCount}
            </span>
            <select
              className="terminal-input"
              style={{ padding: '2px 8px', fontSize: '10px', height: 'auto' }}
              value={effectConfig.targetFps}
              onChange={(e) => setEffectConfig((prev) => ({ ...prev, targetFps: Number(e.target.value) }))}
            >
              <option value={15}>15 FPS (Eco)</option>
              <option value={30}>30 FPS (Standard)</option>
              <option value={60}>60 FPS (Silky)</option>
            </select>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: '4px',
            overflowX: 'hidden',
            padding: '12px',
            background: '#000',
            borderRadius: '4px',
            border: '1px solid rgba(0, 245, 255, 0.1)',
            boxShadow: 'inset 0 0 10px rgba(0,0,0,0.8)',
          }}
        >
          {previewLeds.length > 0 ? previewLeds.map((led, i) => (
            <div
              key={i}
              style={{
                width: `${Math.min(12, 100 / previewLeds.length)}%`,
                minWidth: '4px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: `rgb(${led.r},${led.g},${led.b})`,
                boxShadow: led.r + led.g + led.b > 0 ? `0 0 6px rgba(${led.r},${led.g},${led.b},0.8)` : 'none',
              }}
            />
          )) : (
            <div className="w-full text-center text-xs font-mono text-muted-foreground py-2">No active pixel stream</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatusTabProps {
  activeMode: string;
  brightness: number;
  driverState: ReturnType<typeof useDriver>['driverState'];
  fps: number;
  hwStatus: ConnectionStatus;
  logicalLedCount: number;
  physicalLedCount: number;
  send: ReturnType<typeof useDriver>['send'];
  setMode: ReturnType<typeof useDriver>['setMode'];
}

function StatusTab({
  driverState,
  hwStatus,
  fps,
  brightness,
  send,
  setMode,
  activeMode,
  logicalLedCount,
  physicalLedCount,
}: StatusTabProps) {
  const targetIp = driverState?.targetIp ?? '—';

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
          <div className="stat-block"><span className="stat-value">{logicalLedCount}</span><span className="stat-label">Logical LEDs</span></div>
          <div className="stat-block"><span className="stat-value">{physicalLedCount}</span><span className="stat-label">Physical LEDs</span></div>
        </div>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Runtime Mode</div>
        <div className="mode-selector mt-3">
          {(['idle', 'standalone', 'wled_preset', 'override_effect', 'override_audio'] as const).map((mode) => (
            <button key={mode} className={`mode-btn ${activeMode === mode ? 'active' : ''}`} onClick={() => setMode(mode)}>
              {mode.replace('_', ' ')}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          `standalone` means the controller is using WLED behavior. `override_*` means the laptop is actively driving pixels.
        </p>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Transport</div>
        <div className="stat-block mt-4">
          <span className="stat-value text-primary">{driverState?.transport === 'emulator' ? 'EMULATOR' : 'WLED'}</span>
          <span className="stat-label">Target</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          USB is only for flashing/config. Live override uses local network DDP to reach WLED.
        </p>
      </div>

      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Brightness</div>
        <div className="flex items-center gap-4 mt-4 justify-center">
          <Knob value={brightness} min={0} max={255} onChange={(val) => send('SET_BRIGHTNESS', { brightness: val })} />
          <span className="font-mono text-primary text-lg font-bold">{brightness}</span>
        </div>
        <input
          type="range"
          min={0}
          max={255}
          value={brightness}
          className="brightness-slider w-full mt-4"
          onChange={(e) => send('SET_BRIGHTNESS', { brightness: parseInt(e.target.value, 10) })}
        />
      </div>
    </div>
  );
}

interface EffectsTabProps {
  config: OverrideEffectConfig;
  logicalLedCount: number;
  onConfigChange: React.Dispatch<React.SetStateAction<OverrideEffectConfig>>;
  pushFrame: (pixels: Uint8Array) => void;
  setMode: ReturnType<typeof useDriver>['setMode'];
  stopRef: React.MutableRefObject<() => void>;
}

function EffectsTab({ logicalLedCount, pushFrame, setMode, stopRef, config, onConfigChange }: EffectsTabProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const tickRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const stop = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setMode('standalone');
  }, [setMode]);

  useEffect(() => {
    stopRef.current = stop;
    return stop;
  }, [stop, stopRef]);

  useEffect(() => {
    const applyConfig = (event: Event) => {
      const detail = (event as CustomEvent<OverrideEffectConfig>).detail;
      if (detail) {
        onConfigChange(detail);
        setIsPlaying(true);
      }
    };
    window.addEventListener(OVERRIDE_EFFECT_EVENT, applyConfig);
    return () => window.removeEventListener(OVERRIDE_EFFECT_EVENT, applyConfig);
  }, [onConfigChange]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    setMode('override_effect');
    let running = true;

    const loop = () => {
      if (!running) return;
      const effect = EFFECTS[config.effectId] ?? EFFECTS[DEFAULT_OVERRIDE_EFFECT.effectId];
      const effectConfig: EffectConfig = {
        speed: config.speed,
        intensity: config.intensity,
        color1: hexToRgb(config.color1),
        color2: hexToRgb(config.color2),
      };
      const pixels = effect.fn(logicalLedCount, tickRef.current, effectConfig);
      pushFrame(pixels);
      tickRef.current++;
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      running = false;
    };
  }, [config, isPlaying, logicalLedCount, pushFrame, setMode]);

  return (
    <div className="studio-grid">
      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Select Generator</div>
        <div className="effect-grid">
          {Object.entries(EFFECTS).map(([key, { label }]) => (
            <button
              key={key}
              className={`effect-tile ${config.effectId === key ? 'active' : ''}`}
              onClick={() => onConfigChange((prev) => ({ ...prev, effectId: key as EffectId }))}
            >
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
              <input type="color" value={config.color1} onChange={(e) => onConfigChange((prev) => ({ ...prev, color1: e.target.value }))} className="color-picker" />
              <span className="font-mono text-sm">{config.color1.toUpperCase()}</span>
            </div>
          </div>
          <div className="color-control">
            <label className="font-mono text-sm text-muted-foreground">Secondary</label>
            <div className="color-input-row">
              <input type="color" value={config.color2} onChange={(e) => onConfigChange((prev) => ({ ...prev, color2: e.target.value }))} className="color-picker" />
              <span className="font-mono text-sm">{config.color2.toUpperCase()}</span>
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
              <span className="font-mono text-sm text-primary font-bold">{config.speed}</span>
            </div>
            <input type="range" min={1} max={100} value={config.speed} className="brightness-slider w-full" onChange={(e) => onConfigChange((prev) => ({ ...prev, speed: parseInt(e.target.value, 10) }))} />
          </div>
          <div className="slider-group">
            <div className="flex justify-between w-full">
              <label className="font-mono text-sm text-muted-foreground">Intensity</label>
              <span className="font-mono text-sm text-primary font-bold">{config.intensity}</span>
            </div>
            <input type="range" min={1} max={100} value={config.intensity} className="brightness-slider w-full" onChange={(e) => onConfigChange((prev) => ({ ...prev, intensity: parseInt(e.target.value, 10) }))} />
          </div>

          <button className={`action-btn w-full mt-2 ${isPlaying ? 'stop' : ''}`} onClick={() => setIsPlaying((prev) => !prev)}>
            {isPlaying ? '■ Stop Override' : '▶ Start Override'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AudioTabProps {
  logicalLedCount: number;
  pushFrame: (pixels: Uint8Array) => void;
  setMode: ReturnType<typeof useDriver>['setMode'];
  stopRef: React.MutableRefObject<() => void>;
}

function AudioTab({ logicalLedCount, pushFrame, setMode, stopRef }: AudioTabProps) {
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
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
    navigator.mediaDevices.enumerateDevices().then((all) => {
      const inputs = all
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));
      setDevices([{ deviceId: 'system', label: 'System Audio / Display Capture' }, ...inputs]);
    }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setBands(new Float32Array(bandCount));
    setPeak(0);
    setMode('standalone');
  }, [bandCount, setMode]);

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
      setMode('override_audio');

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(dataArray);
        const newBands = new Float32Array(bandCount);
        const step = Math.floor(analyser.frequencyBinCount / bandCount);
        let peakVal = 0;

        for (let i = 0; i < bandCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j] / 255.0;
          }
          const avg = (sum / step) * gain;
          newBands[i] = Math.min(1, avg);
          if (avg > peakVal) {
            peakVal = avg;
          }
        }

        setBands(newBands);
        setPeak(Math.min(1, peakVal));

        const pixels = new Uint8Array(logicalLedCount * 3);
        const ledsPerBand = Math.max(1, Math.floor(logicalLedCount / bandCount));

        for (let band = 0; band < bandCount; band++) {
          const val = newBands[band];
          const hue = (band / bandCount) * 330;
          const [r, g, b] = hslToRgb(hue, 100, Math.round(val * 50));
          for (let led = 0; led < ledsPerBand; led++) {
            const idx = (band * ledsPerBand + led) * 3;
            if (idx + 2 < pixels.length) {
              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
            }
          }
        }

        pushFrame(pixels);
        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
    } catch (err) {
      console.error('Audio start failed', err);
    }
  };

  return (
    <div className="studio-grid">
      <div className="dashboard-card">
        <div className="card-label">Hardware Input</div>
        <select className="terminal-input w-full mt-3" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
          <option value="" disabled>Select audio source...</option>
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
        <div className="flex items-center gap-4 mt-4 justify-between">
          <StatusBadge status={isListening ? 'connected' : 'disconnected'} />
          <button className={`action-btn ${isListening ? 'stop' : ''}`} onClick={isListening ? stop : start}>
            {isListening ? '■ Stop Laptop Audio' : 'Listen'}
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
        <div className="card-label">Laptop Audio Spectrum</div>
        <div className="frequency-bars mt-4">
          {Array.from(bands).map((value, i) => (
            <FrequencyBar key={i} value={value} className={i === 0 ? 'border border-primary/20' : undefined} />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          This path is browser/USB capture feeding custom visuals. WLED line-in audio remains a separate standalone hardware mode.
        </p>
      </div>
    </div>
  );
}
