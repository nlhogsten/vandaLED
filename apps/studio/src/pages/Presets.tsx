import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  LightingPreset,
  activatePreset,
  loadPresets,
  loadProgramDraft,
  savePresets,
} from '../lib/override-state';
import { HARDWARE_LAYOUT_EVENT, getDerivedLayout, loadHardwareLayout } from '../lib/mapper';

function getProgramSummary(preset: LightingPreset) {
  if (preset.program.kind === 'reactive') {
    return `reactive • gain ${preset.program.config.gain.toFixed(1)}x`;
  }
  if (preset.program.kind === 'spatial') {
    return `spatial • ${preset.program.config.effectId} • speed ${preset.program.config.speed}`;
  }
  return `static • ${preset.program.config.effectId} • speed ${preset.program.config.speed}`;
}

export function Presets() {
  const [presets, setPresets] = useState<LightingPreset[]>(loadPresets);
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [layout, setLayout] = useState(loadHardwareLayout);
  const derived = useMemo(() => getDerivedLayout(layout), [layout]);

  useEffect(() => {
    const syncLayout = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setLayout(detail ?? loadHardwareLayout());
    };

    window.addEventListener(HARDWARE_LAYOUT_EVENT, syncLayout);
    return () => window.removeEventListener(HARDWARE_LAYOUT_EVENT, syncLayout);
  }, []);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;

    const currentProgram = loadProgramDraft();
    const now = Date.now();
    const existing = presets.find((preset) => preset.id === editId);
    const preset: LightingPreset = {
      id: editId ?? crypto.randomUUID(),
      name: name.trim(),
      program: currentProgram,
      layoutVersion: layout.version,
      layoutNodeCount: derived.nodes.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const updated = editId
      ? presets.map((entry) => entry.id === editId ? preset : entry)
      : [preset, ...presets];

    setPresets(updated);
    savePresets(updated);
    setName('');
    setEditId(null);
  }, [derived.nodes.length, editId, layout.version, name, presets]);

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
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text) as LightingPreset[];
        if (Array.isArray(imported)) {
          setPresets(imported);
          savePresets(imported);
        }
      } catch {
        // Ignore invalid input
      }
    };
    input.click();
  }, []);

  const startEdit = useCallback((preset: LightingPreset) => {
    setEditId(preset.id);
    setName(preset.name);
  }, []);

  const currentProgram = loadProgramDraft();

  return (
    <div>
      <h2>Presets</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>
        Save the current Studio program, including static, reactive, and spatial configurations against your mapped hardware layout.
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
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleSave(); }}
            />
            <p className="text-xs text-muted-foreground">
              Saving snapshots the current <strong>{currentProgram.kind}</strong> program and tags it to layout v{layout.version} ({derived.nodes.length} segments).
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
            Presets remain Studio-side artifacts. WLED firmware presets still live in <code className="font-mono text-primary">firmware/presets.json</code>.
          </p>
        </div>

        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-label">Saved Presets ({presets.length})</div>
          {presets.length === 0 ? (
            <p className="text-muted-foreground" style={{ marginTop: '12px' }}>
              No presets saved yet. Build a static, reactive, or spatial program on Control, then save it here.
            </p>
          ) : (
            <div className="preset-list">
              {presets.map((preset) => {
                const layoutMismatch = preset.layoutVersion !== layout.version || preset.layoutNodeCount !== derived.nodes.length;
                return (
                  <div key={preset.id} className="preset-item">
                    <div className="flex items-center gap-4">
                      <div className={`preset-kind-badge ${preset.program.kind}`}>{preset.program.kind}</div>
                      <div>
                        <div className="font-bold">{preset.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {getProgramSummary(preset)} • layout v{preset.layoutVersion}
                        </div>
                        {layoutMismatch && (
                          <div className="font-mono text-xs" style={{ color: '#FFB703', marginTop: '4px' }}>
                            Current mapper differs from the layout this preset was saved against.
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="action-btn" onClick={() => activatePreset(preset)}>Activate</button>
                      <button className="action-btn" onClick={() => startEdit(preset)}>Edit</button>
                      <button className="action-btn stop" onClick={() => handleDelete(preset.id)}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
