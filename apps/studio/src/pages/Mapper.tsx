import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Tube,
  getTubeLayoutLogicalLedCount,
  getTubeLayoutPhysicalLedCount,
  loadTubeLayout,
  saveTubeLayout,
} from '../lib/mapper';

export function Mapper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tubes, setTubes] = useState<Tube[]>(loadTubeLayout);
  const [dragState, setDragState] = useState<{ tubeId: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedTube, setSelectedTube] = useState<string | null>(null);

  useEffect(() => {
    saveTubeLayout(tubes);
  }, [tubes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(0, 245, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    for (const tube of tubes) {
      ctx.save();
      ctx.translate(tube.x + tube.width / 2, tube.y + tube.height / 2);
      ctx.rotate((tube.rotation * Math.PI) / 180);

      const isSelected = selectedTube === tube.id;
      ctx.fillStyle = isSelected ? 'rgba(0, 245, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = isSelected ? '#00F5FF' : 'rgba(0, 245, 255, 0.3)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(-tube.width / 2, -tube.height / 2, tube.width, tube.height, 4);
      ctx.fill();
      ctx.stroke();

      const dotSpacing = tube.width / Math.max(1, tube.ledCount);
      for (let i = 0; i < tube.ledCount; i++) {
        const dx = -tube.width / 2 + dotSpacing * i + dotSpacing / 2;
        ctx.fillStyle = isSelected ? '#00F5FF' : 'rgba(0, 245, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(dx, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#888';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${tube.ledCount} LEDs (${tube.ledStart}–${tube.ledStart + tube.ledCount - 1})`, 0, tube.height / 2 + 14);
      ctx.restore();
    }
  }, [selectedTube, tubes]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      draw();
    });

    ro.observe(parent);
    return () => ro.disconnect();
  }, [draw]);

  const updateTube = useCallback((tubeId: string, updater: (tube: Tube) => Tube) => {
    setTubes((prev) => prev.map((tube) => tube.id === tubeId ? updater(tube) : tube));
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    for (let i = tubes.length - 1; i >= 0; i--) {
      const t = tubes[i];
      if (mx >= t.x && mx <= t.x + t.width && my >= t.y && my <= t.y + t.height) {
        setDragState({ tubeId: t.id, offsetX: mx - t.x, offsetY: my - t.y });
        setSelectedTube(t.id);
        return;
      }
    }

    setSelectedTube(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    updateTube(dragState.tubeId, (tube) => ({
      ...tube,
      x: mx - dragState.offsetX,
      y: my - dragState.offsetY,
    }));
  };

  const addTube = () => {
    const physicalCount = getTubeLayoutPhysicalLedCount(tubes);
    const newTube: Tube = {
      id: `tube-${Date.now()}`,
      x: 100,
      y: 100 + tubes.length * 80,
      width: 400,
      height: 20,
      ledStart: physicalCount,
      ledCount: 25,
      rotation: 0,
    };
    setTubes((prev) => [...prev, newTube]);
    setSelectedTube(newTube.id);
  };

  const removeTube = () => {
    if (!selectedTube) return;
    setTubes((prev) => prev.filter((tube) => tube.id !== selectedTube));
    setSelectedTube(null);
  };

  const selected = tubes.find((tube) => tube.id === selectedTube) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 144px)' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2>Pixel Mapper</h2>
          <p className="text-sm text-muted-foreground">
            Layout now affects override rendering order. Logical LEDs flow tube-by-tube into physical start indices.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="action-btn" onClick={addTube}>+ Add Tube</button>
          {selectedTube && (
            <button className="action-btn stop" onClick={removeTube}>Remove</button>
          )}
        </div>
      </div>

      <div className="flex gap-4" style={{ flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: '100%', cursor: dragState ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setDragState(null)}
            onMouseLeave={() => setDragState(null)}
          />
        </div>

        <div className="dashboard-card" style={{ width: '320px', overflowY: 'auto' }}>
          <div className="card-label">Layout Summary</div>
          <div className="flex items-center gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
            <div className="stat-block">
              <span className="stat-value text-primary">{tubes.length}</span>
              <span className="stat-label">Tubes</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{getTubeLayoutLogicalLedCount(tubes)}</span>
              <span className="stat-label">Logical LEDs</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{getTubeLayoutPhysicalLedCount(tubes)}</span>
              <span className="stat-label">Physical Span</span>
            </div>
          </div>

          {selected ? (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card-label">Selected Tube</div>
              <label className="font-mono text-xs text-muted-foreground">
                LED Start
                <input
                  type="number"
                  className="terminal-input w-full mt-1"
                  value={selected.ledStart}
                  min={0}
                  onChange={(e) => updateTube(selected.id, (tube) => ({ ...tube, ledStart: Math.max(0, parseInt(e.target.value || '0', 10)) }))}
                />
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                LED Count
                <input
                  type="number"
                  className="terminal-input w-full mt-1"
                  value={selected.ledCount}
                  min={1}
                  onChange={(e) => updateTube(selected.id, (tube) => ({ ...tube, ledCount: Math.max(1, parseInt(e.target.value || '1', 10)) }))}
                />
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                Rotation
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={selected.rotation}
                  className="brightness-slider w-full mt-1"
                  onChange={(e) => updateTube(selected.id, (tube) => ({ ...tube, rotation: parseInt(e.target.value, 10) }))}
                />
                <span className="font-mono text-primary">{selected.rotation}°</span>
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                Width
                <input
                  type="range"
                  min={80}
                  max={800}
                  value={selected.width}
                  className="brightness-slider w-full mt-1"
                  onChange={(e) => updateTube(selected.id, (tube) => ({ ...tube, width: parseInt(e.target.value, 10) }))}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                The mapper currently remaps linear effect output into these physical LED ranges. Spatial XY/rotation are now persisted and ready for future spatial effects.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" style={{ marginTop: '1.25rem' }}>
              Select a tube to edit its LED range, rotation, and display width.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
