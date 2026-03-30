import React, { useState, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';

interface Preset {
  id: string;
  name: string;
  effect: string;
  color1: string;
  color2: string;
  speed: number;
  intensity: number;
  createdAt: number;
}

const STORAGE_KEY = 'vandaled-presets';

function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: Preset[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function Presets() {
  const { send, driverState } = useDriver();
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    const preset: Preset = {
      id: editId ?? crypto.randomUUID(),
      name: name.trim(),
      effect: 'solid',
      color1: '#00F5FF',
      color2: '#39FF14',
      speed: 50,
      intensity: 50,
      createdAt: Date.now(),
    };

    const updated = editId
      ? presets.map(p => p.id === editId ? preset : p)
      : [...presets, preset];

    setPresets(updated);
    savePresets(updated);
    setName('');
    setEditId(null);
  }, [name, editId, presets]);

  const handleDelete = useCallback((id: string) => {
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    savePresets(updated);
  }, [presets]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'presets.json';
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
        const imported = JSON.parse(text);
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

  const handleActivate = useCallback((preset: Preset) => {
    // Send solid color from preset to demonstrate activation
    const hex = preset.color1.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const count = driverState?.ledCount ?? 100;
    const pixels = new Uint8Array(count * 3);
    for (let i = 0; i < count; i++) {
      pixels[i * 3] = r;
      pixels[i * 3 + 1] = g;
      pixels[i * 3 + 2] = b;
    }
    send('PIXEL_FRAME', {
      pixels: Array.from(pixels),
      offset: 0,
      timestamp: Date.now(),
    });
  }, [send, driverState]);

  return (
    <div>
      <h2>Presets</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>Save, load, and manage lighting presets</p>

      <div className="studio-grid">
        {/* Create / Edit */}
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

        {/* Import / Export */}
        <div className="dashboard-card">
          <div className="card-label">Sync</div>
          <div className="flex gap-4" style={{ marginTop: '12px' }}>
            <button className="action-btn" onClick={handleExport}>↓ Export JSON</button>
            <button className="action-btn" onClick={handleImport}>↑ Import JSON</button>
          </div>
          <p className="text-sm text-muted-foreground" style={{ marginTop: '12px' }}>
            Export to <code className="font-mono text-primary">firmware/presets.json</code> for version control.
          </p>
        </div>

        {/* Preset List */}
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-label">Saved Presets ({presets.length})</div>
          {presets.length === 0 ? (
            <p className="text-muted-foreground" style={{ marginTop: '12px' }}>No presets saved yet. Create your first one above.</p>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => (
                <div key={preset.id} className="preset-item">
                  <div className="flex items-center gap-4">
                    <div
                      className="color-swatch small"
                      style={{ backgroundColor: preset.color1, boxShadow: `0 0 8px ${preset.color1}66` }}
                    />
                    <div>
                      <div className="font-bold">{preset.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {new Date(preset.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="action-btn" onClick={() => handleActivate(preset)}>▶</button>
                    <button className="action-btn" onClick={() => { setEditId(preset.id); setName(preset.name); }}>✎</button>
                    <button className="action-btn stop" onClick={() => handleDelete(preset.id)}>✕</button>
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
