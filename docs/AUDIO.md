# Audio

> How audio gets into the system, how it's analyzed, and how it drives light.

---

## Two Paths to Audio Reactivity

The system supports two fundamentally different audio sources. They can coexist — wired audio runs in standalone mode, Web Audio API runs when the laptop is present.

### Path 1: Wired Line-In (Standalone)

```
DJ Controller (Booth/Master 2 Out)
        │
    RCA/3.5mm cable
        │
    PCM1808 ADC Module (inside controller box)
        │  I2S digital signal
    QuinLED-Dig-Uno (ESP32)
        │  WLED Sound Reactive engine (FFT runs on-chip)
    LED Tubes
```

**When it's active**: Any time the controller is powered on, with or without a laptop.

**How it works**: The PCM1808 converts the analog audio voltage from your DJ controller into a digital I2S signal. WLED's built-in sound reactive engine reads this signal, runs an FFT (Fast Fourier Transform), and drives built-in audio-reactive effects.

**Pros**: Zero latency, zero configuration, works completely offline.

**Cons**: Limited to WLED's built-in effects. No custom visual logic.

### Path 2: Web Audio API (Laptop Override)

```
DJ Controller (USB Audio Interface or system output)
        │
    Web Audio API (in browser or Bun audio capture)
        │  AnalyserNode (FFT)
    apps/driver (audio-engine package)
        │  FrequencyFrame (via WebSocket)
    apps/studio (visualized + mapped)
        │  PixelFrame (via WebSocket)
    apps/driver (DDP packer)
        │  UDP packet
    QuinLED-Dig-Uno
        │
    LED Tubes
```

**When it's active**: When the driver is running and the Studio has an active audio context.

**How it works**: The Web Audio API reads audio from a connected device (your DJ controller's USB audio, a virtual cable, or system audio capture). The `audio-engine` package runs FFT analysis and emits `FrequencyFrame` objects via WebSocket to the Studio. The Studio maps frequency bands to pixel values and streams the result back to the driver for DDP dispatch.

**Pros**: Fully custom visual logic. You write the mapping. You control how a kick drum, a hi-hat, or a vocal chain manifests in light.

**Cons**: Requires the laptop and driver to be running.

---

## FFT Explained (For Developers)

FFT stands for **Fast Fourier Transform**. It converts a time-domain audio signal (a waveform) into a frequency-domain representation (a spectrum).

In plain terms: given a chunk of audio samples, FFT tells you how much energy is present at each frequency — bass, mid, treble, etc.

```
Time Domain             Frequency Domain
(waveform)              (spectrum)

     /\    /\           Bass   Mid    Hi
    /  \  /  \          ████   ██     █
---/----\/----\---  →   ████   ████   ██
  /            \        ████   ████   ████
```

### The AnalyserNode

In the Web Audio API, `AnalyserNode` does the FFT for you:

```typescript
const audioContext = new AudioContext();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;              // Window size — more = more frequency resolution
analyser.smoothingTimeConstant = 0.8; // Temporal smoothing (0 = none, 1 = infinite)

const source = audioContext.createMediaStreamSource(stream);
source.connect(analyser);

const dataArray = new Uint8Array(analyser.frequencyBinCount); // 1024 bins

function getFrame() {
  analyser.getByteFrequencyData(dataArray);
  // dataArray[0] = sub-bass energy (20Hz)
  // dataArray[512] ≈ high treble energy (~11kHz)
  // Values 0–255
  requestAnimationFrame(getFrame);
}
```

### Frequency Band Mapping

Raw FFT gives you 512–2048 individual frequency bins. For lighting, you typically collapse these into 8–32 "bands" that correspond to perceptually meaningful ranges:

```typescript
const BANDS = [
  { name: 'sub-bass',  min: 20,   max: 60   },
  { name: 'bass',      min: 60,   max: 250  },
  { name: 'low-mid',   min: 250,  max: 500  },
  { name: 'mid',       min: 500,  max: 2000 },
  { name: 'upper-mid', min: 2000, max: 4000 },
  { name: 'presence',  min: 4000, max: 6000 },
  { name: 'brilliance',min: 6000, max: 20000},
];
```

In `packages/audio-engine`, this collapsing is handled by `mapBinsToArray()` which averages the FFT bins within each band's frequency range, normalized to 0.0–1.0.

---

## The `audio-engine` Package

### Key Functions

```typescript
// Create an analyser from a MediaStream (microphone or audio input)
createAnalyser(stream: MediaStream, config?: AnalyserConfig): AudioAnalyser

// Create an analyser from system audio (requires screen capture with audio)
createSystemAudioAnalyser(config?: AnalyserConfig): Promise<AudioAnalyser>

interface AudioAnalyser {
  getFrame(): FrequencyFrame
  destroy(): void
}

interface FrequencyFrame {
  bands: Float32Array    // Normalized 0.0–1.0 per band
  raw: Uint8Array        // Raw FFT bins (0–255)
  peak: number           // RMS peak level 0.0–1.0
  timestamp: number
}

interface AnalyserConfig {
  fftSize: number          // 512 | 1024 | 2048 | 4096 (default: 2048)
  bandCount: number        // Number of output bands (default: 16)
  smoothing: number        // 0.0–1.0 (default: 0.8)
  minDecibels: number      // Lower bound for normalization (default: -100)
  maxDecibels: number      // Upper bound for normalization (default: -10)
}
```

### Mapping Frequency to Pixels

```typescript
import { mapFrequencyToPixels } from '@vandaled/audio-engine';

// Map 16 frequency bands to a 300-LED strip
// Each band controls a proportional segment of LEDs
const pixelFrame = mapFrequencyToPixels(frequencyFrame, 300, {
  colorMode: 'hue-shift',    // Map band index to hue
  mirror: true,              // Mirror the pattern from center
  gain: 1.5                  // Amplify the response
});
```

---

## Connecting Your DJ Controller

### Via USB Audio Interface

Most modern DJ controllers (including the DDJ-FLX4) appear as a USB audio interface when connected to a laptop. In your browser or Node.js code:

```typescript
const devices = await navigator.mediaDevices.enumerateDevices();
const djController = devices.find(d =>
  d.kind === 'audioinput' && d.label.includes('DDJ')
);

const stream = await navigator.mediaDevices.getUserMedia({
  audio: { deviceId: djController.deviceId }
});
```

### Via System Audio / Loopback

To capture your full system audio output (everything playing through your speakers):

```typescript
// This uses screen capture with audio — triggers a browser permission prompt
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true
});

// Use only the audio tracks
const audioStream = new MediaStream(stream.getAudioTracks());
```

This approach captures whatever is playing through your system — useful for non-DJ scenarios.

### Via Virtual Audio Cable (Most Reliable)

For a clean, dedicated routing: install **Blackhole** (macOS) or **VB-Cable** (Windows). Route your DJ software's output to the virtual cable, then select that virtual cable as the audio input in the Studio UI. This prevents feedback loops and gives you a clean, isolated signal.

---

## Audio in Standalone Mode: WLED Sound Reactive

When running without a laptop, WLED's built-in sound reactive effects use the PCM1808 line-in signal. Some notable effects:

| Effect Name | What it does |
|---|---|
| `Freqwave` | Frequency spectrum as a sine wave across the strip |
| `Audiograph` | Classic audio spectrum analyzer (bars) |
| `Ripple Peak` | Sends ripples from center on beat peaks |
| `Noise2D` | 2D Perlin noise modulated by audio amplitude |
| `DJ Light` | Randomized color strobes synced to BPM |

In WLED, each effect exposes `Speed` and `Intensity` sliders that change how responsive and dramatic the effect is. Save your preferred configuration as a preset in `firmware/presets.json`.
