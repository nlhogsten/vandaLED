import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FrequencyBar, Knob, StatusBadge } from '@vandaled/ui-components';
import type { ConnectionStatus } from '@vandaled/ui-components';
import { LayoutLedPoint } from '@vandaled/layout-engine';
import { useDriver } from '../context/DriverContext';
import { useThrottledStream } from '../hooks/useThrottledStream';
import {
  DEFAULT_OVERRIDE_EFFECT,
  DEFAULT_REACTIVE_PROGRAM,
  DEFAULT_SPATIAL_EFFECT,
  EffectId,
  OVERRIDE_EFFECT_EVENT,
  PRESET_ACTIVATED_EVENT,
  PROGRAM_DRAFT_EVENT,
  ProgramConfig,
  REACTIVE_PROGRAM_EVENT,
  ReactiveProgramConfig,
  SPATIAL_EFFECT_EVENT,
  SpatialEffectId,
  EffectProgramConfig,
  SpatialProgramConfig,
  loadOverrideEffectConfig,
  loadProgramDraft,
  loadReactiveProgramConfig,
  loadSpatialEffectConfig,
  saveOverrideEffectConfig,
  saveProgramDraft,
  saveReactiveProgramConfig,
  saveSpatialEffectConfig,
} from '../lib/override-state';
import {
  HARDWARE_LAYOUT_EVENT,
  getDerivedLayout,
  loadHardwareLayout,
  remapPixels,
} from '../lib/mapper';

type ControlTab = 'status' | 'static' | 'spatial' | 'audio';
type EffectFn = (ledCount: number, t: number, config: EffectRenderConfig) => Uint8Array;

interface EffectRenderConfig {
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
    label: 'Solid',
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
    label: 'Rainbow',
    fn: (count, t) => {
      const px = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++) {
        const [r, g, b] = hslToRgb(((i / Math.max(count, 1)) * 360 + t * 2) % 360, 100, 50);
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
      const amount = (Math.sin(t * cfg.speed * 0.02) + 1) / 2;
      for (let i = 0; i < count; i++) {
        px[i * 3] = Math.round(cfg.color1[0] * amount);
        px[i * 3 + 1] = Math.round(cfg.color1[1] * amount);
        px[i * 3 + 2] = Math.round(cfg.color1[2] * amount);
      }
      return px;
    },
  },
  chase: {
    label: 'Chase',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const head = Math.floor(t * Math.max(0.4, cfg.speed / 30)) % Math.max(count, 1);
      const width = Math.max(2, Math.floor(Math.max(count, 1) * (cfg.intensity / 100) * 0.35));
      for (let i = 0; i < count; i++) {
        const dist = (i - head + count) % count;
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
    label: 'Gradient',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      const shift = (Math.sin(t * cfg.speed * 0.01) + 1) / 2;
      for (let i = 0; i < count; i++) {
        const mix = ((i / Math.max(count, 1)) + shift) % 1;
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
      for (let i = 0; i < count; i++) {
        if (Math.random() < cfg.intensity / 220) {
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
      for (let i = 0; i < count; i++) {
        const wave = (Math.sin(i * 0.35 + t * cfg.speed * 0.015) + 1) / 2;
        const heat = wave * (cfg.intensity / 100) * (0.65 + Math.random() * 0.35);
        px[i * 3] = Math.round(255 * heat);
        px[i * 3 + 1] = Math.round(110 * heat * heat);
        px[i * 3 + 2] = Math.round(24 * heat * heat * heat);
      }
      return px;
    },
  },
  ocean: {
    label: 'Ocean',
    fn: (count, t, cfg) => {
      const px = new Uint8Array(count * 3);
      for (let i = 0; i < count; i++) {
        const wave1 = (Math.sin(i * 0.15 + t * cfg.speed * 0.01) + 1) / 2;
        const wave2 = (Math.sin(i * 0.08 - t * cfg.speed * 0.007) + 1) / 2;
        const mix = wave1 * 0.55 + wave2 * 0.45;
        px[i * 3] = Math.round(cfg.color1[0] * 0.2 * mix);
        px[i * 3 + 1] = Math.round(cfg.color1[1] * 0.4 * mix + cfg.color2[1] * 0.4);
        px[i * 3 + 2] = Math.round(140 + 115 * mix);
      }
      return px;
    },
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function mixColors(a: [number, number, number], b: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - amount) + b[0] * amount),
    Math.round(a[1] * (1 - amount) + b[1] * amount),
    Math.round(a[2] * (1 - amount) + b[2] * amount),
  ];
}

function getSpatialPixels(points: LayoutLedPoint[], tick: number, config: SpatialProgramConfig) {
  const pixels = new Uint8Array(points.length * 3);
  const c1 = hexToRgb(config.color1);
  const c2 = hexToRgb(config.color2);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusMax = Math.max(1, Math.hypot(maxX - centerX, maxY - centerY));

  points.forEach((point, index) => {
    let amount = 0;
    if (config.effectId === 'radial') {
      amount = Math.hypot(point.x - centerX, point.y - centerY) / radiusMax;
      amount = (amount + (Math.sin(tick * config.speed * 0.01) + 1) * 0.15) % 1;
    } else if (config.effectId === 'orbit') {
      const angle = Math.atan2(point.y - centerY, point.x - centerX);
      amount = ((angle / (Math.PI * 2)) + 0.5 + tick * config.speed * 0.0025) % 1;
    } else {
      amount = ((point.x - minX) / Math.max(1, maxX - minX) + tick * config.speed * 0.003) % 1;
    }

    const shimmer = 0.65 + (config.intensity / 100) * 0.35;
    const [r, g, b] = mixColors(c1, c2, amount);
    pixels[index * 3] = Math.round(r * shimmer);
    pixels[index * 3 + 1] = Math.round(g * shimmer);
    pixels[index * 3 + 2] = Math.round(b * shimmer);
  });

  return pixels;
}

function getSpatialTab(program: ProgramConfig['kind']): ControlTab {
  if (program === 'reactive') return 'audio';
  if (program === 'spatial') return 'spatial';
  return 'static';
}

export function Control() {
  const { status, driverState, fps, setMode, send } = useDriver();
  const [activeTab, setActiveTab] = useState<ControlTab>('status');
  const [effectConfig, setEffectConfig] = useState<EffectProgramConfig>(loadOverrideEffectConfig);
  const [spatialConfig, setSpatialConfig] = useState<SpatialProgramConfig>(loadSpatialEffectConfig);
  const [reactiveConfig, setReactiveConfig] = useState<ReactiveProgramConfig>(loadReactiveProgramConfig);
  const [layout, setLayout] = useState(loadHardwareLayout);
  const derivedLayout = useMemo(() => getDerivedLayout(layout), [layout]);
  const logicalLedCount = derivedLayout.logicalLedCount || driverState?.ledCount || 100;
  const physicalLedCount = Math.max(driverState?.ledCount ?? 100, derivedLayout.physicalLedCount);
  const effectStream = useThrottledStream(effectConfig.targetFps);
  const spatialStream = useThrottledStream(spatialConfig.targetFps);
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
  const stopSpatialRef = useRef<() => void>(() => {});

  useEffect(() => saveOverrideEffectConfig(effectConfig), [effectConfig]);
  useEffect(() => saveSpatialEffectConfig(spatialConfig), [spatialConfig]);
  useEffect(() => saveReactiveProgramConfig(reactiveConfig), [reactiveConfig]);

  useEffect(() => {
    const syncLayout = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setLayout(detail ?? loadHardwareLayout());
    };
    const syncStatic = (event: Event) => setEffectConfig((event as CustomEvent<EffectProgramConfig>).detail ?? loadOverrideEffectConfig());
    const syncSpatial = (event: Event) => setSpatialConfig((event as CustomEvent<SpatialProgramConfig>).detail ?? loadSpatialEffectConfig());
    const syncReactive = (event: Event) => setReactiveConfig((event as CustomEvent<ReactiveProgramConfig>).detail ?? loadReactiveProgramConfig());
    const syncDraft = (event: Event) => {
      const detail = (event as CustomEvent<ProgramConfig>).detail ?? loadProgramDraft();
      setActiveTab(getSpatialTab(detail.kind));
    };
    const syncPresetActivation = (event: Event) => {
      const detail = (event as CustomEvent<{ program: ProgramConfig }>).detail;
      if (detail?.program) {
        setActiveTab(getSpatialTab(detail.program.kind));
      }
    };

    window.addEventListener(HARDWARE_LAYOUT_EVENT, syncLayout);
    window.addEventListener(OVERRIDE_EFFECT_EVENT, syncStatic);
    window.addEventListener(SPATIAL_EFFECT_EVENT, syncSpatial);
    window.addEventListener(REACTIVE_PROGRAM_EVENT, syncReactive);
    window.addEventListener(PROGRAM_DRAFT_EVENT, syncDraft);
    window.addEventListener(PRESET_ACTIVATED_EVENT, syncPresetActivation);

    return () => {
      window.removeEventListener(HARDWARE_LAYOUT_EVENT, syncLayout);
      window.removeEventListener(OVERRIDE_EFFECT_EVENT, syncStatic);
      window.removeEventListener(SPATIAL_EFFECT_EVENT, syncSpatial);
      window.removeEventListener(REACTIVE_PROGRAM_EVENT, syncReactive);
      window.removeEventListener(PROGRAM_DRAFT_EVENT, syncDraft);
      window.removeEventListener(PRESET_ACTIVATED_EVENT, syncPresetActivation);
    };
  }, []);

  const pushMappedFrame = useCallback((pixels: Uint8Array, target: 'static' | 'spatial') => {
    const mapped = remapPixels(pixels, layout, physicalLedCount);
    if (target === 'spatial') {
      spatialStream.pushFrame(mapped);
    } else {
      effectStream.pushFrame(mapped);
    }
  }, [effectStream, layout, physicalLedCount, spatialStream]);

  const activateProgramDraft = useCallback((program: ProgramConfig) => {
    saveProgramDraft(program);
  }, []);

  const handleTabChange = (tab: ControlTab) => {
    setActiveTab(tab);
    if (tab !== 'static') stopEffectRef.current();
    if (tab !== 'spatial') stopSpatialRef.current();
    if (tab !== 'audio') stopAudioRef.current();
  };

  const previewLedPoints = derivedLayout.ledPoints;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h2>Control Center</h2>
          <p className="mb-0 text-sm text-muted-foreground">
            Static patterns, reactive audio, and canvas-spatial programs all stream through the same mapped hardware chain.
          </p>
        </div>
        <div className="flex bg-surface border rounded p-1">
          <button className={`mode-btn ${activeTab === 'status' ? 'active' : ''}`} onClick={() => handleTabChange('status')}>Status</button>
          <button className={`mode-btn ${activeTab === 'static' ? 'active' : ''}`} onClick={() => handleTabChange('static')}>Static</button>
          <button className={`mode-btn ${activeTab === 'spatial' ? 'active' : ''}`} onClick={() => handleTabChange('spatial')}>Spatial</button>
          <button className={`mode-btn ${activeTab === 'audio' ? 'active' : ''}`} onClick={() => handleTabChange('audio')}>Reactive</button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {activeTab === 'status' && (
          <StatusTab
            activeMode={activeMode}
            brightness={brightness}
            driverState={driverState}
            fps={fps}
            hwStatus={hwStatus}
            logicalLedCount={logicalLedCount}
            physicalLedCount={physicalLedCount}
            issueCount={derivedLayout.issues.length}
            send={send}
            setMode={setMode}
          />
        )}
        {activeTab === 'static' && (
          <StaticTab
            config={effectConfig}
            logicalLedCount={logicalLedCount}
            onConfigChange={(next) => {
              setEffectConfig(next);
              activateProgramDraft({ kind: 'static', config: next });
            }}
            pushFrame={(pixels) => pushMappedFrame(pixels, 'static')}
            setMode={setMode}
            stopRef={stopEffectRef}
          />
        )}
        {activeTab === 'spatial' && (
          <SpatialTab
            config={spatialConfig}
            ledPoints={previewLedPoints.length > 0 ? previewLedPoints : fallbackPoints(logicalLedCount)}
            onConfigChange={(next) => {
              setSpatialConfig(next);
              activateProgramDraft({ kind: 'spatial', config: next });
            }}
            pushFrame={(pixels) => pushMappedFrame(pixels, 'spatial')}
            setMode={setMode}
            stopRef={stopSpatialRef}
          />
        )}
        {activeTab === 'audio' && (
          <AudioTab
            config={reactiveConfig}
            logicalLedCount={logicalLedCount}
            onConfigChange={(next) => {
              setReactiveConfig(next);
              activateProgramDraft({ kind: 'reactive', config: next });
            }}
            pushFrame={(pixels) => pushMappedFrame(pixels, 'static')}
            setMode={setMode}
            stopRef={stopAudioRef}
          />
        )}
      </div>

    </div>
  );
}

function fallbackPoints(count: number): LayoutLedPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    nodeId: 'fallback',
    label: 'Linear Strip',
    logicalIndex: index,
    physicalIndex: index,
    localIndex: index,
    x: index * 14,
    y: 0,
  }));
}

interface StatusTabProps {
  activeMode: string;
  brightness: number;
  driverState: ReturnType<typeof useDriver>['driverState'];
  fps: number;
  hwStatus: ConnectionStatus;
  logicalLedCount: number;
  physicalLedCount: number;
  issueCount: number;
  send: ReturnType<typeof useDriver>['send'];
  setMode: ReturnType<typeof useDriver>['setMode'];
}

function StatusTab({
  activeMode,
  brightness,
  driverState,
  fps,
  hwStatus,
  logicalLedCount,
  physicalLedCount,
  issueCount,
  send,
  setMode,
}: StatusTabProps) {
  return (
    <div className="studio-grid">
      <div className="dashboard-card">
        <div className="card-label">Connection</div>
        <div className="flex items-center gap-4 mt-3">
          <StatusBadge status={hwStatus} />
          <span className="font-mono text-sm text-muted-foreground">{driverState?.targetIp ?? '—'}:{driverState?.ddpPort ?? 4048}</span>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="stat-block"><span className="stat-value text-primary">{fps}</span><span className="stat-label">FPS</span></div>
          <div className="stat-block"><span className="stat-value">{logicalLedCount}</span><span className="stat-label">Mapped LEDs</span></div>
          <div className="stat-block"><span className="stat-value">{issueCount}</span><span className="stat-label">Layout Issues</span></div>
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
          Override modes now assume the mapper defines the active LED order and emulator geometry.
        </p>
      </div>

      <div className="dashboard-card">
        <div className="card-label">Transport</div>
        <div className="stat-block mt-4">
          <span className="stat-value text-primary">{driverState?.transport === 'emulator' ? 'EMULATOR' : 'WLED'}</span>
          <span className="stat-label">Target</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Physical span currently resolves to {physicalLedCount} LEDs after layout chaining.
        </p>
      </div>

      <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
        <div className="card-label">Brightness</div>
        <div className="flex items-center gap-4 mt-4 justify-center">
          <Knob value={brightness} min={0} max={255} onChange={(value) => send('SET_BRIGHTNESS', { brightness: value })} />
          <span className="font-mono text-primary text-lg font-bold">{brightness}</span>
        </div>
        <input
          type="range"
          min={0}
          max={255}
          value={brightness}
          className="brightness-slider w-full mt-4"
          onChange={(event) => send('SET_BRIGHTNESS', { brightness: parseInt(event.target.value, 10) })}
        />
      </div>
    </div>
  );
}

interface StaticTabProps {
  config: EffectProgramConfig;
  logicalLedCount: number;
  onConfigChange: (config: EffectProgramConfig) => void;
  pushFrame: (pixels: Uint8Array) => void;
  setMode: ReturnType<typeof useDriver>['setMode'];
  stopRef: React.MutableRefObject<() => void>;
}

function StaticTab({ config, logicalLedCount, onConfigChange, pushFrame, setMode, stopRef }: StaticTabProps) {
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
    if (!isPlaying) return;
    setMode('override_effect');
    let running = true;

    const loop = () => {
      if (!running) return;
      const pixels = (EFFECTS[config.effectId] ?? EFFECTS[DEFAULT_OVERRIDE_EFFECT.effectId]).fn(logicalLedCount, tickRef.current, {
        speed: config.speed,
        intensity: config.intensity,
        color1: hexToRgb(config.color1),
        color2: hexToRgb(config.color2),
      });
      pushFrame(pixels);
      tickRef.current += 1;
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      running = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [config, isPlaying, logicalLedCount, pushFrame, setMode]);

  return (
    <div className="studio-grid">
      <ProgramPaletteCard
        color1={config.color1}
        color2={config.color2}
        onColor1Change={(value) => onConfigChange({ ...config, color1: value })}
        onColor2Change={(value) => onConfigChange({ ...config, color2: value })}
      />

      <div className="dashboard-card">
        <div className="card-label">Static Generator</div>
        <div className="effect-grid">
          {Object.entries(EFFECTS).map(([key, value]) => (
            <button key={key} className={`effect-tile ${config.effectId === key ? 'active' : ''}`} onClick={() => onConfigChange({ ...config, effectId: key as EffectId })}>
              {value.label}
            </button>
          ))}
        </div>
        <ParameterControls
          speed={config.speed}
          intensity={config.intensity}
          fps={config.targetFps}
          onSpeedChange={(value) => onConfigChange({ ...config, speed: value })}
          onIntensityChange={(value) => onConfigChange({ ...config, intensity: value })}
          onFpsChange={(value) => onConfigChange({ ...config, targetFps: value })}
        />
        <button className={`action-btn w-full mt-2 ${isPlaying ? 'stop' : ''}`} onClick={() => setIsPlaying((prev) => !prev)}>
          {isPlaying ? '■ Stop Static Program' : '▶ Start Static Program'}
        </button>
      </div>
    </div>
  );
}

interface SpatialTabProps {
  config: SpatialProgramConfig;
  ledPoints: LayoutLedPoint[];
  onConfigChange: (config: SpatialProgramConfig) => void;
  pushFrame: (pixels: Uint8Array) => void;
  setMode: ReturnType<typeof useDriver>['setMode'];
  stopRef: React.MutableRefObject<() => void>;
}

function SpatialTab({ config, ledPoints, onConfigChange, pushFrame, setMode, stopRef }: SpatialTabProps) {
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
    if (!isPlaying) return;
    setMode('override_effect');
    let running = true;

    const loop = () => {
      if (!running) return;
      pushFrame(getSpatialPixels(ledPoints, tickRef.current, config));
      tickRef.current += 1;
      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      running = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [config, isPlaying, ledPoints, pushFrame, setMode]);

  return (
    <div className="studio-grid">
      <ProgramPaletteCard
        color1={config.color1}
        color2={config.color2}
        onColor1Change={(value) => onConfigChange({ ...config, color1: value })}
        onColor2Change={(value) => onConfigChange({ ...config, color2: value })}
      />

      <div className="dashboard-card">
        <div className="card-label">Spatial Generator</div>
        <div className="effect-grid">
          {[
            ['linear', 'Linear Sweep'],
            ['radial', 'Radial Bloom'],
            ['orbit', 'Orbit'],
          ].map(([key, label]) => (
            <button key={key} className={`effect-tile ${config.effectId === key ? 'active' : ''}`} onClick={() => onConfigChange({ ...config, effectId: key as SpatialEffectId })}>
              {label}
            </button>
          ))}
        </div>
        <ParameterControls
          speed={config.speed}
          intensity={config.intensity}
          fps={config.targetFps}
          onSpeedChange={(value) => onConfigChange({ ...config, speed: value })}
          onIntensityChange={(value) => onConfigChange({ ...config, intensity: value })}
          onFpsChange={(value) => onConfigChange({ ...config, targetFps: value })}
        />
        <p className="text-xs text-muted-foreground">Spatial programs read LED coordinates from the mapper canvas rather than assuming a straight strip.</p>
        <button className={`action-btn w-full mt-2 ${isPlaying ? 'stop' : ''}`} onClick={() => setIsPlaying((prev) => !prev)}>
          {isPlaying ? '■ Stop Spatial Program' : '▶ Start Spatial Program'}
        </button>
      </div>
    </div>
  );
}

interface AudioTabProps {
  config: ReactiveProgramConfig;
  logicalLedCount: number;
  onConfigChange: (config: ReactiveProgramConfig) => void;
  pushFrame: (pixels: Uint8Array) => void;
  setMode: ReturnType<typeof useDriver>['setMode'];
  stopRef: React.MutableRefObject<() => void>;
}

function AudioTab({ config, logicalLedCount, onConfigChange, pushFrame, setMode, stopRef }: AudioTabProps) {
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [bands, setBands] = useState<Float32Array>(new Float32Array(16));
  const [peak, setPeak] = useState(0);
  const bandCount = 16;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devicesList) => {
      const inputs = devicesList
        .filter((device) => device.kind === 'audioinput')
        .map((device) => ({ deviceId: device.deviceId, label: device.label || `Mic ${device.deviceId.slice(0, 6)}` }));
      setDevices([{ deviceId: 'system', label: 'System Audio / Display Capture' }, ...inputs]);
    }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioCtxRef.current?.close();
    analyserRef.current = null;
    audioCtxRef.current = null;
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

  const start = useCallback(async () => {
    stop();
    const stream = selectedDevice === 'system'
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true });

    streamRef.current = stream;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.85;
    analyserRef.current = analyser;
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    setIsListening(true);
    setMode('override_audio');

    const loop = () => {
      analyser.getByteFrequencyData(buffer);
      const values = new Float32Array(bandCount);
      const stride = Math.floor(buffer.length / bandCount);
      let maxValue = 0;

      for (let band = 0; band < bandCount; band++) {
        let total = 0;
        for (let i = 0; i < stride; i++) {
          total += buffer[band * stride + i] ?? 0;
        }
        const value = Math.min(1, ((total / Math.max(stride, 1)) / 255) * config.gain);
        values[band] = value;
        maxValue = Math.max(maxValue, value);
      }

      setBands(values);
      setPeak(maxValue);

      const pixels = new Uint8Array(logicalLedCount * 3);
      const c1 = hexToRgb(config.color1);
      const c2 = hexToRgb(config.color2);
      for (let i = 0; i < logicalLedCount; i++) {
        const band = values[Math.min(bandCount - 1, Math.floor((i / Math.max(logicalLedCount, 1)) * bandCount))] ?? 0;
        const [r, g, b] = mixColors(c2, c1, band);
        pixels[i * 3] = r;
        pixels[i * 3 + 1] = g;
        pixels[i * 3 + 2] = b;
      }
      pushFrame(pixels);

      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
  }, [bandCount, config.color1, config.color2, config.gain, logicalLedCount, pushFrame, selectedDevice, setMode, stop]);

  return (
    <div className="studio-grid">
      <ProgramPaletteCard
        color1={config.color1}
        color2={config.color2}
        onColor1Change={(value) => onConfigChange({ ...config, color1: value })}
        onColor2Change={(value) => onConfigChange({ ...config, color2: value })}
      />

      <div className="dashboard-card">
        <div className="card-label">Reactive Input</div>
        <div className="flex flex-col gap-4 mt-4">
          <label className="font-mono text-sm text-muted-foreground">
            Source
            <select className="terminal-input w-full mt-1" value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)}>
              <option value="">Default Input</option>
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </label>
          <div className="slider-group">
            <div className="flex justify-between w-full">
              <label className="font-mono text-sm text-muted-foreground">Gain</label>
              <span className="font-mono text-sm text-primary font-bold">{config.gain.toFixed(1)}x</span>
            </div>
            <input type="range" min={0.5} max={4} step={0.1} value={config.gain} className="brightness-slider w-full" onChange={(event) => onConfigChange({ ...config, gain: parseFloat(event.target.value) })} />
          </div>
          <div className="frequency-visualizer">
            {Array.from({ length: bands.length }).map((_, index) => (
              <div key={index} className="freq-bar-wrapper">
                <FrequencyBar value={bands[index] ?? 0} />
              </div>
            ))}
          </div>
          <div className="mapper-readout">
            <span>Peak</span>
            <strong>{Math.round(peak * 100)}%</strong>
          </div>
          <button className={`action-btn w-full ${isListening ? 'stop' : ''}`} onClick={() => (isListening ? stop() : start())}>
            {isListening ? '■ Stop Reactive Program' : '▶ Start Reactive Program'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProgramPaletteCardProps {
  color1: string;
  color2: string;
  onColor1Change: (value: string) => void;
  onColor2Change: (value: string) => void;
}

function ProgramPaletteCard({ color1, color2, onColor1Change, onColor2Change }: ProgramPaletteCardProps) {
  return (
    <div className="dashboard-card">
      <div className="card-label">Palette</div>
      <div className="flex flex-col gap-4 mt-3">
        <div className="color-control">
          <label className="font-mono text-sm text-muted-foreground">Primary</label>
          <div className="color-input-row">
            <input type="color" value={color1} onChange={(event) => onColor1Change(event.target.value)} className="color-picker" />
            <span className="font-mono text-sm">{color1.toUpperCase()}</span>
          </div>
        </div>
        <div className="color-control">
          <label className="font-mono text-sm text-muted-foreground">Secondary</label>
          <div className="color-input-row">
            <input type="color" value={color2} onChange={(event) => onColor2Change(event.target.value)} className="color-picker" />
            <span className="font-mono text-sm">{color2.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ParameterControlsProps {
  speed: number;
  intensity: number;
  fps: number;
  onSpeedChange: (value: number) => void;
  onIntensityChange: (value: number) => void;
  onFpsChange: (value: number) => void;
}

function ParameterControls({ speed, intensity, fps, onSpeedChange, onIntensityChange, onFpsChange }: ParameterControlsProps) {
  return (
    <div className="flex flex-col gap-5 mt-4">
      <div className="slider-group">
        <div className="flex justify-between w-full">
          <label className="font-mono text-sm text-muted-foreground">Speed</label>
          <span className="font-mono text-sm text-primary font-bold">{speed}</span>
        </div>
        <input type="range" min={1} max={100} value={speed} className="brightness-slider w-full" onChange={(event) => onSpeedChange(parseInt(event.target.value, 10))} />
      </div>
      <div className="slider-group">
        <div className="flex justify-between w-full">
          <label className="font-mono text-sm text-muted-foreground">Intensity</label>
          <span className="font-mono text-sm text-primary font-bold">{intensity}</span>
        </div>
        <input type="range" min={1} max={100} value={intensity} className="brightness-slider w-full" onChange={(event) => onIntensityChange(parseInt(event.target.value, 10))} />
      </div>
      <label className="font-mono text-sm text-muted-foreground">
        Target FPS
        <select className="terminal-input w-full mt-1" value={fps} onChange={(event) => onFpsChange(parseInt(event.target.value, 10))}>
          <option value={15}>15 FPS</option>
          <option value={30}>30 FPS</option>
          <option value={60}>60 FPS</option>
        </select>
      </label>
    </div>
  );
}
