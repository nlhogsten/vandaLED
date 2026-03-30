import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';

interface Tube {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ledStart: number;
  ledCount: number;
  rotation: number; // degrees
}

const DEFAULT_TUBES: Tube[] = [
  { id: 'tube-1', x: 100, y: 100, width: 400, height: 20, ledStart: 0, ledCount: 50, rotation: 0 },
  { id: 'tube-2', x: 100, y: 200, width: 400, height: 20, ledStart: 50, ledCount: 50, rotation: 0 },
];

export function Mapper() {
  const { driverState } = useDriver();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tubes, setTubes] = useState<Tube[]>(DEFAULT_TUBES);
  const [dragState, setDragState] = useState<{ tubeId: string; offsetX: number; offsetY: number } | null>(null);
  const [selectedTube, setSelectedTube] = useState<string | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid
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

    // Draw tubes
    for (const tube of tubes) {
      ctx.save();
      ctx.translate(tube.x + tube.width / 2, tube.y + tube.height / 2);
      ctx.rotate((tube.rotation * Math.PI) / 180);

      const isSelected = selectedTube === tube.id;

      // Tube body
      ctx.fillStyle = isSelected ? 'rgba(0, 245, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = isSelected ? '#00F5FF' : 'rgba(0, 245, 255, 0.3)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(-tube.width / 2, -tube.height / 2, tube.width, tube.height, 4);
      ctx.fill();
      ctx.stroke();

      // LED dots along the tube
      const dotSpacing = tube.width / tube.ledCount;
      for (let i = 0; i < tube.ledCount; i++) {
        const dx = -tube.width / 2 + dotSpacing * i + dotSpacing / 2;
        ctx.fillStyle = isSelected ? '#00F5FF' : 'rgba(0, 245, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(dx, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Label
      ctx.fillStyle = '#888';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${tube.ledCount} LEDs (${tube.ledStart}–${tube.ledStart + tube.ledCount - 1})`, 0, tube.height / 2 + 14);

      ctx.restore();
    }
  }, [tubes, selectedTube]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Resize canvas
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

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Find tube under cursor (reverse order = top first)
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

    setTubes(prev => prev.map(t =>
      t.id === dragState.tubeId
        ? { ...t, x: mx - dragState.offsetX, y: my - dragState.offsetY }
        : t
    ));
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  const addTube = () => {
    const totalLeds = tubes.reduce((sum, t) => sum + t.ledCount, 0);
    const newTube: Tube = {
      id: `tube-${Date.now()}`,
      x: 100,
      y: 100 + tubes.length * 80,
      width: 400,
      height: 20,
      ledStart: totalLeds,
      ledCount: 25,
      rotation: 0,
    };
    setTubes([...tubes, newTube]);
  };

  const removeTube = () => {
    if (selectedTube) {
      setTubes(tubes.filter(t => t.id !== selectedTube));
      setSelectedTube(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 144px)' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ marginBottom: '0.25rem' }}>Pixel Mapper</h2>
          <p className="text-sm text-muted-foreground">Drag tubes to match your physical layout. Click to select.</p>
        </div>
        <div className="flex gap-2">
          <button className="action-btn" onClick={addTube}>+ Add Tube</button>
          {selectedTube && (
            <button className="action-btn stop" onClick={removeTube}>✕ Remove</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: dragState ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Selected Tube Info */}
      {selectedTube && (() => {
        const tube = tubes.find(t => t.id === selectedTube);
        if (!tube) return null;
        return (
          <div className="dashboard-card" style={{ marginTop: '16px' }}>
            <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
              <div className="stat-block">
                <span className="stat-value text-primary">{tube.ledCount}</span>
                <span className="stat-label">LEDs</span>
              </div>
              <div className="stat-block">
                <span className="stat-value">{tube.ledStart}</span>
                <span className="stat-label">Start Index</span>
              </div>
              <div className="stat-block">
                <span className="stat-value">{Math.round(tube.x)}, {Math.round(tube.y)}</span>
                <span className="stat-label">Position</span>
              </div>
              <div className="stat-block">
                <span className="stat-value">{tube.rotation}°</span>
                <span className="stat-label">Rotation</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
