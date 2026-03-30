export type OverrideMode = 'idle' | 'standalone' | 'wled_preset' | 'override_effect' | 'override_audio';

export type EffectId =
  | 'solid'
  | 'rainbow'
  | 'pulse'
  | 'chase'
  | 'gradient'
  | 'sparkle'
  | 'fire'
  | 'ocean';

export type SpatialEffectId = 'linear' | 'radial' | 'orbit';

export interface EffectProgramConfig {
  effectId: EffectId;
  color1: string;
  color2: string;
  speed: number;
  intensity: number;
  targetFps: number;
}

export interface SpatialProgramConfig {
  effectId: SpatialEffectId;
  color1: string;
  color2: string;
  speed: number;
  intensity: number;
  targetFps: number;
}

export interface ReactiveProgramConfig {
  gain: number;
  color1: string;
  color2: string;
}

export type ProgramConfig =
  | { kind: 'static'; config: EffectProgramConfig }
  | { kind: 'reactive'; config: ReactiveProgramConfig }
  | { kind: 'spatial'; config: SpatialProgramConfig };

export const DEFAULT_OVERRIDE_EFFECT: EffectProgramConfig = {
  effectId: 'rainbow',
  color1: '#00F5FF',
  color2: '#39FF14',
  speed: 50,
  intensity: 50,
  targetFps: 30,
};

export const DEFAULT_SPATIAL_EFFECT: SpatialProgramConfig = {
  effectId: 'linear',
  color1: '#00F5FF',
  color2: '#FFB703',
  speed: 40,
  intensity: 55,
  targetFps: 30,
};

export const DEFAULT_REACTIVE_PROGRAM: ReactiveProgramConfig = {
  gain: 1.5,
  color1: '#39FF14',
  color2: '#00F5FF',
};

export const OVERRIDE_EFFECT_STORAGE_KEY = 'vandaled-override-effect';
export const OVERRIDE_EFFECT_EVENT = 'vandaled:override-effect-changed';
export const SPATIAL_EFFECT_STORAGE_KEY = 'vandaled-spatial-effect';
export const SPATIAL_EFFECT_EVENT = 'vandaled:spatial-effect-changed';
export const REACTIVE_PROGRAM_STORAGE_KEY = 'vandaled-reactive-program';
export const REACTIVE_PROGRAM_EVENT = 'vandaled:reactive-program-changed';
export const PROGRAM_DRAFT_STORAGE_KEY = 'vandaled-program-draft';
export const PROGRAM_DRAFT_EVENT = 'vandaled:program-draft-changed';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? { ...fallback, ...(JSON.parse(saved) as Partial<T>) } : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, eventName: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(eventName, { detail: value }));
}

export function loadOverrideEffectConfig(): EffectProgramConfig {
  return readStorage(OVERRIDE_EFFECT_STORAGE_KEY, DEFAULT_OVERRIDE_EFFECT);
}

export function saveOverrideEffectConfig(config: EffectProgramConfig) {
  writeStorage(OVERRIDE_EFFECT_STORAGE_KEY, OVERRIDE_EFFECT_EVENT, config);
}

export function loadSpatialEffectConfig(): SpatialProgramConfig {
  return readStorage(SPATIAL_EFFECT_STORAGE_KEY, DEFAULT_SPATIAL_EFFECT);
}

export function saveSpatialEffectConfig(config: SpatialProgramConfig) {
  writeStorage(SPATIAL_EFFECT_STORAGE_KEY, SPATIAL_EFFECT_EVENT, config);
}

export function loadReactiveProgramConfig(): ReactiveProgramConfig {
  return readStorage(REACTIVE_PROGRAM_STORAGE_KEY, DEFAULT_REACTIVE_PROGRAM);
}

export function saveReactiveProgramConfig(config: ReactiveProgramConfig) {
  writeStorage(REACTIVE_PROGRAM_STORAGE_KEY, REACTIVE_PROGRAM_EVENT, config);
}

export function loadProgramDraft(): ProgramConfig {
  try {
    const saved = localStorage.getItem(PROGRAM_DRAFT_STORAGE_KEY);
    if (!saved) {
      return { kind: 'static', config: loadOverrideEffectConfig() };
    }
    const parsed = JSON.parse(saved) as ProgramConfig;
    if (parsed.kind === 'reactive') {
      return { kind: 'reactive', config: { ...DEFAULT_REACTIVE_PROGRAM, ...parsed.config } };
    }
    if (parsed.kind === 'spatial') {
      return { kind: 'spatial', config: { ...DEFAULT_SPATIAL_EFFECT, ...parsed.config } };
    }
    return { kind: 'static', config: { ...DEFAULT_OVERRIDE_EFFECT, ...parsed.config } };
  } catch {
    return { kind: 'static', config: loadOverrideEffectConfig() };
  }
}

export function saveProgramDraft(program: ProgramConfig) {
  writeStorage(PROGRAM_DRAFT_STORAGE_KEY, PROGRAM_DRAFT_EVENT, program);
}

export interface LightingPreset {
  id: string;
  name: string;
  program: ProgramConfig;
  layoutVersion: number;
  layoutNodeCount: number;
  createdAt: number;
  updatedAt: number;
}

export const PRESETS_STORAGE_KEY = 'vandaled-presets';
export const PRESET_ACTIVATED_EVENT = 'vandaled:preset-activated';

export function loadPresets(): LightingPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as LightingPreset[] : [];
  } catch {
    return [];
  }
}

export function savePresets(presets: LightingPreset[]) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

export function activatePreset(preset: LightingPreset) {
  if (preset.program.kind === 'reactive') {
    saveReactiveProgramConfig(preset.program.config);
  } else if (preset.program.kind === 'spatial') {
    saveSpatialEffectConfig(preset.program.config);
  } else {
    saveOverrideEffectConfig(preset.program.config);
  }
  saveProgramDraft(preset.program);
  window.dispatchEvent(new CustomEvent(PRESET_ACTIVATED_EVENT, { detail: preset }));
}
