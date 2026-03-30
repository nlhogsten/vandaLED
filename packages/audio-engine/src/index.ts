import { PixelFrame, solidColor } from '@vandaled/ddp-engine';

export interface FrequencyFrame {
  bands: Float32Array;  // Normalized 0.0–1.0 per frequency band
  raw: Uint8Array;      // Raw FFT bins 0–255
  peak: number;         // RMS peak 0.0–1.0
  timestamp: number;
}

export interface AnalyserConfig {
  fftSize?: number;         // 512 | 1024 | 2048 | 4096 (default 2048)
  bandCount?: number;       // Output band count (default 16)
  smoothing?: number;       // 0.0–1.0 (default 0.8)
  minDecibels?: number;     // (default -100)
  maxDecibels?: number;     // (default -10)
}

export interface AudioAnalyser {
  getFrame(): FrequencyFrame;
  getInputStream(): MediaStream;
  destroy(): void;
}

export async function createAnalyserFromDevice(deviceId: string, config?: AnalyserConfig): Promise<AudioAnalyser> {
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const stream = await navigator.mediaDevices.getUserMedia({ 
    audio: deviceId === "default" ? true : { deviceId: { exact: deviceId } } 
  });
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();

  analyser.fftSize = config?.fftSize ?? 2048;
  analyser.smoothingTimeConstant = config?.smoothing ?? 0.8;
  analyser.minDecibels = config?.minDecibels ?? -100;
  analyser.maxDecibels = config?.maxDecibels ?? -10;

  source.connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const bandCount = config?.bandCount ?? 16;
  
  return {
    getFrame(): FrequencyFrame {
      analyser.getByteFrequencyData(dataArray);
      
      const bands = new Float32Array(bandCount);
      const step = Math.floor(bufferLength / bandCount);
      let peak = 0;

      for (let i = 0; i < bandCount; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          const val = dataArray[i * step + j] / 255.0;
          sum += val;
        }
        const avg = sum / step;
        bands[i] = avg;
        if (avg > peak) peak = avg;
      }

      return {
        bands,
        raw: dataArray,
        peak,
        timestamp: Date.now()
      };
    },
    getInputStream() {
      return stream;
    },
    destroy() {
      source.disconnect();
      stream.getTracks().forEach(t => t.stop());
      audioCtx.close();
    }
  };
}

export async function createSystemAudioAnalyser(config?: AnalyserConfig): Promise<AudioAnalyser> {
  return createAnalyserFromDevice("default", config);
}

export interface FrequencyMappingConfig {
  colorMode: 'hue-shift' | 'solid' | 'dual-color';
  baseColor?: [number, number, number];
  accentColor?: [number, number, number];
  mirror?: boolean;
  gain?: number;           // Amplification factor (default 1.0)
  gamma?: number;          // Gamma correction (default 1.0)
}

// Map a FrequencyFrame to a PixelFrame given a LED count
export function mapFrequencyToPixels(
  frame: FrequencyFrame,
  ledCount: number,
  config?: FrequencyMappingConfig
): PixelFrame {
  const pixels = new Uint8Array(ledCount * 3);
  const gain = config?.gain ?? 1.0;
  
  const intensity = Math.min(1.0, frame.peak * gain);
  const r = (config?.baseColor?.[0] ?? 255) * intensity;
  const g = (config?.baseColor?.[1] ?? 0) * intensity;
  const b = (config?.baseColor?.[2] ?? 0) * intensity;
  
  for (let i = 0; i < ledCount; i++) {
    pixels[i * 3] = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  
  return {
    pixels,
    offset: 0,
    timestamp: Date.now()
  };
}
