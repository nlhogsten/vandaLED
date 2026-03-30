import React from 'react';
import { useDriver } from '../context/DriverContext';
import { StatusBadge, Knob } from '@vandaled/ui-components';

export function Dashboard() {
  const { status, driverState, fps, setMode, send } = useDriver();

  const hwStatus: 'connected' | 'disconnected' | 'emulating' =
    status !== 'connected' ? 'disconnected'
    : driverState?.isHardwareConnected ? 'connected'
    : 'emulating';

  const brightness = driverState?.brightness ?? 255;
  const ledCount = driverState?.ledCount ?? 100;
  const activeMode = driverState?.activeMode ?? 'idle';
  const targetIp = driverState?.targetIp ?? '—';

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>System status overview</p>

      <div className="studio-grid">
        {/* Connection Status */}
        <div className="dashboard-card">
          <div className="card-label">Connection</div>
          <div className="flex items-center gap-4" style={{ marginTop: '12px' }}>
            <StatusBadge status={hwStatus} />
            <span className="font-mono text-sm text-muted-foreground">{targetIp}:{driverState?.ddpPort ?? 4048}</span>
          </div>
          <div className="flex items-center gap-4" style={{ marginTop: '16px' }}>
            <div className="stat-block">
              <span className="stat-value text-primary">{fps}</span>
              <span className="stat-label">FPS</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{ledCount}</span>
              <span className="stat-label">LEDs</span>
            </div>
            <div className="stat-block">
              <span className="stat-value">{Math.round((brightness / 255) * 100)}%</span>
              <span className="stat-label">Brightness</span>
            </div>
          </div>
        </div>

        {/* Active Mode */}
        <div className="dashboard-card">
          <div className="card-label">Active Mode</div>
          <div className="mode-selector" style={{ marginTop: '12px' }}>
            {(['idle', 'stream', 'audio', 'preset'] as const).map((mode) => (
              <button
                key={mode}
                className={`mode-btn ${activeMode === mode ? 'active' : ''}`}
                onClick={() => setMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Brightness */}
        <div className="dashboard-card">
          <div className="card-label">Brightness</div>
          <div className="flex items-center gap-4" style={{ marginTop: '16px', justifyContent: 'center' }}>
            <Knob
              value={brightness}
              min={0}
              max={255}
              onChange={(val) => send('SET_BRIGHTNESS', { brightness: val })}
            />
            <span className="font-mono text-primary text-lg font-bold">{brightness}</span>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={brightness}
            className="brightness-slider"
            onChange={(e) => send('SET_BRIGHTNESS', { brightness: parseInt(e.target.value) })}
            style={{ width: '100%', marginTop: '16px' }}
          />
        </div>

        {/* Quick Color Send */}
        <div className="dashboard-card">
          <div className="card-label">Quick Color</div>
          <div className="quick-colors" style={{ marginTop: '12px' }}>
            {[
              { name: 'Cyan', rgb: [0, 245, 255] },
              { name: 'Neon Green', rgb: [57, 255, 20] },
              { name: 'Hot Pink', rgb: [255, 0, 85] },
              { name: 'Amber', rgb: [255, 160, 0] },
              { name: 'Violet', rgb: [138, 43, 226] },
              { name: 'White', rgb: [255, 255, 255] },
              { name: 'Off', rgb: [0, 0, 0] },
            ].map(({ name, rgb }) => (
              <button
                key={name}
                className="color-swatch"
                title={name}
                style={{
                  backgroundColor: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
                  boxShadow: rgb[0] + rgb[1] + rgb[2] > 0
                    ? `0 0 12px rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.5)` : 'none',
                }}
                onClick={() => {
                  const count = ledCount;
                  const pixels = new Uint8Array(count * 3);
                  for (let i = 0; i < count; i++) {
                    pixels[i * 3] = rgb[0];
                    pixels[i * 3 + 1] = rgb[1];
                    pixels[i * 3 + 2] = rgb[2];
                  }
                  send('PIXEL_FRAME', {
                    pixels: Array.from(pixels),
                    offset: 0,
                    timestamp: Date.now(),
                  });
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
