import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DerivedLayoutNode } from '@vandaled/layout-engine';
import {
  HardwareLayout,
  LayoutNode,
  createHardwareNode,
  getDerivedLayout,
  loadHardwareLayout,
  removeHardwareNode,
  saveHardwareLayout,
  updateHardwareNode,
} from '../lib/mapper';

interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

interface DragState {
  type: 'pan' | 'node';
  pointerId: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  nodeId?: string;
}

const DEFAULT_VIEWPORT: ViewportState = { x: 80, y: 80, scale: 1 };

function getNodeStyle(node: DerivedLayoutNode) {
  return {
    width: `${node.length}px`,
    height: `${node.thickness}px`,
    transform: `translate(${node.x}px, ${node.y}px) rotate(${node.rotation}deg)`,
  };
}

function getBounds(nodes: LayoutNode[]) {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  }

  const xs = nodes.map((node) => node.x);
  const ys = nodes.map((node) => node.y);
  const maxXs = nodes.map((node) => node.x + node.length);
  const maxYs = nodes.map((node) => node.y + node.thickness);

  return {
    minX: Math.min(...xs) - 200,
    minY: Math.min(...ys) - 200,
    maxX: Math.max(...maxXs) + 200,
    maxY: Math.max(...maxYs) + 200,
  };
}

export function Mapper() {
  const [layout, setLayout] = useState<HardwareLayout>(loadHardwareLayout);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(layout.nodes[0]?.id ?? null);
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    saveHardwareLayout(layout);
  }, [layout]);

  const derived = useMemo(() => getDerivedLayout(layout), [layout]);
  const selected = layout.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedDerived = derived.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const worldBounds = useMemo(() => getBounds(layout.nodes), [layout.nodes]);

  const fitToContent = React.useCallback(() => {
    const host = canvasRef.current;
    if (!host) return;

    const contentWidth = worldBounds.maxX - worldBounds.minX;
    const contentHeight = worldBounds.maxY - worldBounds.minY;
    const scale = Math.max(0.35, Math.min(1.5, Math.min(host.clientWidth / contentWidth, host.clientHeight / contentHeight)));
    setViewport({
      scale,
      x: (host.clientWidth - contentWidth * scale) / 2 - worldBounds.minX * scale,
      y: (host.clientHeight - contentHeight * scale) / 2 - worldBounds.minY * scale,
    });
  }, [worldBounds]);

  useEffect(() => {
    fitToContent();
  }, [fitToContent]);

  const commitLayout = (next: HardwareLayout) => {
    setLayout(next);
  };

  const updateNode = (nodeId: string, updater: (node: LayoutNode) => LayoutNode) => {
    commitLayout(updateHardwareNode(layout, nodeId, updater));
  };

  const addNode = () => {
    const node = createHardwareNode(layout);
    commitLayout({
      version: layout.version + 1,
      nodes: [...layout.nodes, node],
    });
    setSelectedNodeId(node.id);
  };

  const deleteNode = () => {
    if (!selectedNodeId) return;
    commitLayout(removeHardwareNode(layout, selectedNodeId));
    setSelectedNodeId(layout.nodes.find((node) => node.id !== selectedNodeId)?.id ?? null);
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setSelectedNodeId(null);
    setDragState({
      type: 'pan',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const beginNodeDrag = (event: React.PointerEvent<HTMLButtonElement>, nodeId: string) => {
    event.stopPropagation();
    setSelectedNodeId(nodeId);
    setDragState({
      type: 'node',
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: layout.nodes.find((node) => node.id === nodeId)?.x ?? 0,
      originY: layout.nodes.find((node) => node.id === nodeId)?.y ?? 0,
      nodeId,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragState.startClientX;
    const dy = event.clientY - dragState.startClientY;

    if (dragState.type === 'pan') {
      setViewport((prev) => ({ ...prev, x: dragState.originX + dx, y: dragState.originY + dy }));
      return;
    }

    if (dragState.type === 'node' && dragState.nodeId) {
      const scale = viewport.scale || 1;
      updateNode(dragState.nodeId, (node) => ({
        ...node,
        x: Math.round(dragState.originX + dx / scale),
        y: Math.round(dragState.originY + dy / scale),
      }));
    }
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    setDragState(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const host = canvasRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const factor = event.deltaY > 0 ? 0.92 : 1.08;

    setViewport((prev) => {
      const nextScale = Math.max(0.3, Math.min(2.5, prev.scale * factor));
      const worldX = (cursorX - prev.x) / prev.scale;
      const worldY = (cursorY - prev.y) / prev.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2>Pixel Mapper</h2>
          <p className="text-sm text-muted-foreground">
            This canvas defines the real hardware chain. The emulator and spatial presets now read from the same layout metadata.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="action-btn" onClick={addNode}>+ Add Segment</button>
          <button className="action-btn" onClick={fitToContent}>Fit View</button>
          <button className="action-btn" onClick={() => setViewport(DEFAULT_VIEWPORT)}>Reset View</button>
          {selectedNodeId && (
            <button className="action-btn stop" onClick={deleteNode}>Remove</button>
          )}
        </div>
      </div>

      <div className="flex gap-4" style={{ flex: 1, minHeight: 0 }}>
        <div className="mapper-shell" style={{ flex: 1, minHeight: 0 }}>
          <div className="mapper-toolbar">
            <span className="font-mono text-xs text-muted-foreground">Pan drag background. Wheel zoom. Drag segments to reposition.</span>
            <span className="font-mono text-xs text-primary">Zoom {Math.round(viewport.scale * 100)}%</span>
          </div>
          <div
            ref={canvasRef}
            className="mapper-canvas"
            onPointerDown={beginPan}
            onPointerMove={handlePointerMove}
            onPointerUp={endPointer}
            onPointerLeave={endPointer}
            onWheel={handleWheel}
          >
            <div
              className="mapper-world"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: '0 0',
              }}
            >
              <svg className="mapper-links">
                {derived.nodes.map((node) => {
                  if (!node.inputNodeId) return null;
                  const upstream = derived.nodes.find((candidate) => candidate.id === node.inputNodeId);
                  if (!upstream) return null;
                  const x1 = upstream.x + upstream.length;
                  const y1 = upstream.y + upstream.thickness / 2;
                  const x2 = node.x;
                  const y2 = node.y + node.thickness / 2;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path
                      key={`${upstream.id}-${node.id}`}
                      d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="rgba(0,245,255,0.35)"
                      strokeWidth="4"
                      strokeDasharray="10 10"
                    />
                  );
                })}
              </svg>

              {derived.nodes.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className={`mapper-node ${selectedNodeId === node.id ? 'selected' : ''}`}
                  style={getNodeStyle(node)}
                  onPointerDown={(event) => beginNodeDrag(event, node.id)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                >
                  <div className="mapper-node-title">
                    <span>{node.label}</span>
                    <span className="font-mono text-xs">#{node.physicalStart}-{node.physicalEnd}</span>
                  </div>
                  <div className="mapper-node-dots">
                    {Array.from({ length: Math.min(node.ledCount, 24) }).map((_, index) => (
                      <span key={index} className="mapper-node-dot" />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-card mapper-sidebar">
          <div className="card-label">Layout Summary</div>
          <div className="flex items-center gap-4 mt-4" style={{ flexWrap: 'wrap' }}>
            <div className="stat-block">
              <span className="stat-value text-primary">{layout.nodes.length}</span>
              <span className="stat-label">Segments</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{derived.logicalLedCount}</span>
              <span className="stat-label">LEDs</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{derived.issues.filter((issue) => issue.severity === 'error').length}</span>
              <span className="stat-label">Errors</span>
            </div>
          </div>

          {derived.issues.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="card-label">Topology Checks</div>
              {derived.issues.map((issue) => (
                <div key={`${issue.nodeId}-${issue.message}`} className={`mapper-issue ${issue.severity}`}>
                  <strong>{issue.severity.toUpperCase()}</strong> {issue.message}
                </div>
              ))}
            </div>
          )}

          {selected && selectedDerived ? (
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="card-label">Selected Segment</div>
              <label className="font-mono text-xs text-muted-foreground">
                Label
                <input
                  type="text"
                  className="terminal-input w-full mt-1"
                  value={selected.label}
                  onChange={(event) => updateNode(selected.id, (node) => ({ ...node, label: event.target.value || node.label }))}
                />
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                Upstream Segment
                <select
                  className="terminal-input w-full mt-1"
                  value={selected.inputNodeId ?? ''}
                  onChange={(event) => updateNode(selected.id, (node) => ({ ...node, inputNodeId: event.target.value || null }))}
                >
                  <option value="">Chain Root</option>
                  {layout.nodes.filter((node) => node.id !== selected.id).map((node) => (
                    <option key={node.id} value={node.id}>{node.label}</option>
                  ))}
                </select>
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                LED Count
                <input
                  type="number"
                  className="terminal-input w-full mt-1"
                  value={selected.ledCount}
                  min={1}
                  onChange={(event) => updateNode(selected.id, (node) => ({ ...node, ledCount: Math.max(1, parseInt(event.target.value || '1', 10)) }))}
                />
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                Length
                <input
                  type="range"
                  min={120}
                  max={900}
                  value={selected.length}
                  className="brightness-slider w-full mt-1"
                  onChange={(event) => updateNode(selected.id, (node) => ({ ...node, length: parseInt(event.target.value, 10) }))}
                />
                <span className="font-mono text-primary">{selected.length}px</span>
              </label>
              <label className="font-mono text-xs text-muted-foreground">
                Rotation
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={selected.rotation}
                  className="brightness-slider w-full mt-1"
                  onChange={(event) => updateNode(selected.id, (node) => ({ ...node, rotation: parseInt(event.target.value, 10) }))}
                />
                <span className="font-mono text-primary">{selected.rotation}°</span>
              </label>
              <div className="mapper-readout">
                <span>Physical Span</span>
                <strong>#{selectedDerived.physicalStart} to #{selectedDerived.physicalEnd}</strong>
              </div>
              <div className="mapper-readout">
                <span>Downstream</span>
                <strong>{selectedDerived.outputNodeId ? layout.nodes.find((node) => node.id === selectedDerived.outputNodeId)?.label ?? selectedDerived.outputNodeId : 'Terminal Segment'}</strong>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" style={{ marginTop: '1.25rem' }}>
              Select a segment to edit its label, LED count, position, and inline data connection.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
