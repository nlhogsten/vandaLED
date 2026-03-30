import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDriver } from '../context/DriverContext';
import { FrequencyBar, StatusBadge } from '@vandaled/ui-components';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function Audio() {
  const { send, driverState, setMode } = useDriver();
  const ledCount = driverState?.ledCount ?? 100;

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isListening, setIsListening] = useState(false);
  const [bands, setBands] = useState<Float32Array>(new Float32Array(16));
  const [peak, setPeak] = useState(0);
  const [gain, setGain] = useState(1.5);
  const [bandCount] = useState(16);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Enumerate audio devices
  useEffect(() => {
    async function getDevices() {
      try {
        // Request permission first
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop()));
        const all = await navigator.mediaDevices.enumerateDevices();
        const inputs = all
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` }));
        setDevices(inputs);
        if (inputs.length > 0 && !selectedDevice) {
          setSelectedDevice(inputs[0].deviceId);
        }
      } catch {
        // Permission denied or no devices
      }
    }
    getDevices();
  }, []);

  const stopAudio = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setBands(new Float32Array(bandCount));
    setPeak(0);
  }, [bandCount]);

  const startAudio = useCallback(async () => {
    if (!selectedDevice) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDevice === 'default' ? true : { deviceId: { exact: selectedDevice } }
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -100;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      source.connect(analyser);
      setIsListening(true);
      setMode('audio');

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const loop = () => {
        analyser.getByteFrequencyData(dataArray);

        const newBands = new Float32Array(bandCount);
        const step = Math.floor(bufferLength / bandCount);
        let peakVal = 0;

        for (let i = 0; i < bandCount; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j] / 255.0;
          }
          const avg = (sum / step) * gain;
          newBands[i] = Math.min(1, avg);
          if (avg > peakVal) peakVal = avg;
        }

        setBands(new Float32Array(newBands));
        setPeak(Math.min(1, peakVal));

        // Map to pixels and send
        const pixels = new Uint8Array(ledCount * 3);
        const ledsPerBand = Math.floor(ledCount / bandCount);

        for (let band = 0; band < bandCount; band++) {
          const val = newBands[band];
          const hue = (band / bandCount) * 330;
          const [r, g, b] = hslToRgb(hue, 100, Math.round(val * 50));
          for (let led = 0; led < ledsPerBand; led++) {
            const idx = (band * ledsPerBand + led) * 3;
            if (idx + 2 < pixels.length) {
              pixels[idx] = r;
              pixels[idx + 1] = g;
              pixels[idx + 2] = b;
            }
          }
        }

        send('PIXEL_FRAME', {
          pixels: Array.from(pixels),
          offset: 0,
          timestamp: Date.now(),
        });

        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
    } catch (err) {
      console.error('Failed to start audio', err);
    }
  }, [selectedDevice, gain, bandCount, ledCount, send, setMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopAudio();
  }, [stopAudio]);

  return (
    <div>
      <h2>Audio</h2>
      <p className="mb-1 text-lg" style={{ marginBottom: '2rem' }}>Real-time frequency analysis and LED mapping</p>

      <div className="studio-grid">
        {/* Device Selector */}
        <div className="dashboard-card">
          <div className="card-label">Audio Input</div>
          <select
            className="terminal-input"
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{ marginTop: '12px', width: '100%' }}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-4" style={{ marginTop: '16px', justifyContent: 'space-between' }}>
            <StatusBadge status={isListening ? 'connected' : 'disconnected'} />
            <button
              className={`action-btn ${isListening ? 'stop' : ''}`}
              onClick={() => { isListening ? stopAudio() : startAudio(); }}
            >
              {isListening ? '■ Stop' : '🎤 Listen'}
            </button>
          </div>
        </div>

        {/* Gain Control */}
        <div className="dashboard-card">
          <div className="card-label">Gain</div>
          <div className="flex items-center gap-4" style={{ marginTop: '16px' }}>
            <input
              type="range" min={0.5} max={5} step={0.1} value={gain}
              className="brightness-slider"
              onChange={(e) => setGain(parseFloat(e.target.value))}
              style={{ flex: 1 }}
            />
            <span className="font-mono text-primary font-bold">{gain.toFixed(1)}x</span>
          </div>
          <div className="stat-block" style={{ marginTop: '16px' }}>
            <span className="stat-value text-primary">{Math.round(peak * 100)}%</span>
            <span className="stat-label">Peak Level</span>
          </div>
        </div>

        {/* Frequency Visualizer */}
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="card-label">Frequency Spectrum</div>
          <div className="frequency-visualizer">
            {Array.from(bands).map((val, i) => (
              <div key={i} className="freq-bar-wrapper">
                <FrequencyBar value={val} />
                <span className="font-mono text-xs text-muted-foreground" style={{ textAlign: 'center', marginTop: '4px' }}>
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
