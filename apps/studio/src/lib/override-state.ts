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

export interface OverrideEffectConfig {
  effectId: EffectId;
  color1: string;
  color2: string;
  speed: number;
  intensity: number;
  targetFps: number;
}

export const DEFAULT_OVERRIDE_EFFECT: OverrideEffectConfig = {
  effectId: 'rainbow',
  color1: '#00F5FF',
  color2: '#39FF14',
  speed: 50,
  intensity: 50,
  targetFps: 30,
};

export const OVERRIDE_EFFECT_STORAGE_KEY = 'vandaled-override-effect';
export const OVERRIDE_EFFECT_EVENT = 'vandaled:override-effect-changed';

export function loadOverrideEffectConfig(): OverrideEffectConfig {
  try {
    const saved = localStorage.getItem(OVERRIDE_EFFECT_STORAGE_KEY);
    return saved
      ? { ...DEFAULT_OVERRIDE_EFFECT, ...(JSON.parse(saved) as Partial<OverrideEffectConfig>) }
      : DEFAULT_OVERRIDE_EFFECT;
  } catch {
    return DEFAULT_OVERRIDE_EFFECT;
  }
}

export function saveOverrideEffectConfig(config: OverrideEffectConfig) {
  localStorage.setItem(OVERRIDE_EFFECT_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent(OVERRIDE_EFFECT_EVENT, { detail: config }));
}

export interface LightingPreset {
  id: string;
  name: string;
  mode: 'override_effect';
  effect: OverrideEffectConfig;
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
  saveOverrideEffectConfig(preset.effect);
  window.dispatchEvent(new CustomEvent(PRESET_ACTIVATED_EVENT, { detail: preset }));
}
