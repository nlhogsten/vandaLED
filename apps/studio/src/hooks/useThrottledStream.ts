import { useState, useCallback, useRef } from 'react';
import { useDriver } from '../context/DriverContext';

export function useThrottledStream(targetFps = 30) {
  const { sendPixelFrame } = useDriver();
  const [currentPixels, setCurrentPixels] = useState<Uint8Array | null>(null);
  const lastSendTime = useRef(0);
  
  const pushFrame = useCallback((pixels: Uint8Array) => {
    const now = performance.now();
    const interval = 1000 / targetFps;
    
    if (now - lastSendTime.current >= interval) {
      sendPixelFrame(pixels, 0);
      setCurrentPixels(new Uint8Array(pixels)); // Copy for react state
      lastSendTime.current = now;
    }
  }, [sendPixelFrame, targetFps]);

  return { pushFrame, currentPixels, setCurrentPixels };
}
