import React, { useState, useCallback } from 'react';
import {
  LightingPreset,
  activatePreset,
  loadOverrideEffectConfig,
  loadPresets,
  savePresets,
} from '../lib/override-state';

export function Presets() {
  const [presets, setPresets] = useState<LightingPreset[]>(loadPresets);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    const currentEffect = loadOverrideEffectConfig();
    const now = Date.now();
    const existing = presets.find((preset) => preset.id === editId);
    const preset: LightingPreset = {
      id: editId ?? crypto.randomUUID(),
      name: name.trim(),
      mode: 'override_effect',
      effect: currentEffect,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const updated = editId
      ? presets.map((p) => p.id === editId ? preset : p)
      : [preset, ...presets];

    setPresets(updated);
    savePresets(updated);
    setName('');
    setEditId(null);
  }, [editId, name, presets]);

  const handleDelete = useCallback((id: string) => {
    const updated = presets.filter((preset) => preset.id !== id);
    setPresets(updated);
    savePresets(updated);
  }, [presets]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'studio-presets.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [presets]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as LightingPreset[];
        if (Array.isArray(imported)) {
          setPresets(imported);
          savePresets(imported);
        }
      } catch {
        // Invalid file
      }
    };
    input.click();
  }, []);

  const startEdit = useCallback((preset: LightingPreset) => {
    setEditId(preset.id);
    setName(preset.name);
  }, []);

  return (
    <div>
      <h2>Presets</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>
        Save and rehydrate full override effect states. These are Studio presets, separate from WLED firmware presets.
      </p>

      <div className="studio-grid">
        <div className="dashboard-card">
          <div className="card-label">{editId ? 'Edit Preset' : 'New Preset'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <input
              type="text"
              className="terminal-input"
              placeholder="Preset name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            <p className="text-xs text-muted-foreground">
              Saving snapshots the current effect, colors, speed, intensity, and target FPS from the Control page.
            </p>
            <div className="flex gap-2">
              <button className="action-btn" onClick={handleSave}>
                {editId ? 'Update' : 'Save'}
              </button>
              {editId && (
                <button className="action-btn" onClick={() => { setEditId(null); setName(''); }}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-label">Sync</div>
          <div className="flex gap-4" style={{ marginTop: '12px' }}>
            <button className="action-btn" onClick={handleExport}>Export JSON</button>
            <button className="action-btn" onClick={handleImport}>Import JSON</button>
          </div>
          <p className="text-sm text-muted-foreground" style={{ marginTop: '12px' }}>
            Studio presets are laptop override snapshots. Keep WLED firmware presets in <code className="font-mono text-primary">firmware/presets.json</code>.
          </p>
        </div>

        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-label">Saved Presets ({presets.length})</div>
          {presets.length === 0 ? (
            <p className="text-muted-foreground" style={{ marginTop: '12px' }}>No presets saved yet. Build an effect on Control, then save it here.</p>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <div key={preset.id} className="preset-item">
                  <div className="flex items-center gap-4">
                    <div className="color-swatch small" style={{ backgroundColor: preset.effect.color1, boxShadow: `0 0 8px ${preset.effect.color1}66` }} />
                    <div>
                      <div className="font-bold">{preset.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {preset.effect.effectId} • speed {preset.effect.speed} • intensity {preset.effect.intensity}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="action-btn" onClick={() => activatePreset(preset)}>Activate</button>
                    <button className="action-btn" onClick={() => startEdit(preset)}>Edit</button>
                    <button className="action-btn stop" onClick={() => handleDelete(preset.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
