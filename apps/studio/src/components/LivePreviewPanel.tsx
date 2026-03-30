import React, { useEffect, useMemo, useState } from 'react';
import { PREVIEW_FRAME_EVENT } from '../hooks/useThrottledStream';

function toLeds(pixels: Uint8Array | null) {
  if (!pixels) return [];
  const count = Math.floor(pixels.length / 3);
  return Array.from({ length: count }, (_, index) => ({
    r: pixels[index * 3] ?? 0,
    g: pixels[index * 3 + 1] ?? 0,
    b: pixels[index * 3 + 2] ?? 0,
  }));
}

export function LivePreviewPanel() {
  const [pixels, setPixels] = useState<Uint8Array | null>(null);

  useEffect(() => {
    const handleFrame = (event: Event) => {
      const detail = (event as CustomEvent<Uint8Array>).detail;
      if (detail instanceof Uint8Array) {
        setPixels(new Uint8Array(detail));
      }
    };

    window.addEventListener(PREVIEW_FRAME_EVENT, handleFrame);
    return () => window.removeEventListener(PREVIEW_FRAME_EVENT, handleFrame);
  }, []);

  const leds = useMemo(() => toLeds(pixels), [pixels]);

  return (
    <div className="dock-panel">
      <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '12px' }}>
        <div className="card-label mb-0">Live Preview Strip</div>
        <span className="font-mono text-xs text-muted-foreground">{leds.length} LEDs</span>
      </div>
      <div className="dock-preview-strip">
        {leds.length > 0 ? leds.map((led, index) => (
          <div
            key={index}
            className="dock-preview-led"
            style={{
              backgroundColor: `rgb(${led.r},${led.g},${led.b})`,
              boxShadow: led.r + led.g + led.b > 0 ? `0 0 8px rgba(${led.r},${led.g},${led.b},0.85)` : 'none',
            }}
          />
        )) : (
          <div className="panel-empty">No active pixel stream</div>
        )}
      </div>
    </div>
  );
}
