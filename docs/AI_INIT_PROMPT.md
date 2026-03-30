# AI Init Prompt

> Copy the prompt below into Cursor, Windsurf, or any AI code editor agent to scaffold the full vandaLED monorepo. Read the notes first.

---

## Before You Run This

1. **Read `docs/ARCHITECTURE.md`** to understand the 3-tier model before the AI generates anything. If the AI misunderstands the architecture early, it will compound mistakes.
2. **This prompt initializes the real project** — not a toy emulator. The emulator is included as a dev tool, but the full DDP streaming pipeline, audio engine, and pixel mapper should be built from the start.
3. **Run this in agent mode** (Cursor: Cmd+Shift+P > "Enable Agent", Windsurf: Cascade panel). The agent needs to be able to create multiple files and run `bun install`.
4. After scaffolding, run `bun install` from the root, then `bun run dev` to start all apps concurrently.

---

## The Prompt

```
You are a Senior Systems Architect and TypeScript engineer. We are building "vandaLED" — a professional-grade, modular LED lighting system. This is not a prototype or tutorial project. Build it to production standards from the start.

---

## System Overview

The system has three tiers:

1. **Hardware Layer** (not coded here): QuinLED-Dig-Uno (ESP32) running WLED firmware. Receives DDP packets on UDP port 4048 and drives WS2815 LED strips.

2. **Driver Layer** (`apps/driver`): A Bun + Hono server. It:
   - Receives pixel frames from the Studio via WebSocket
   - Processes audio input using the Web Audio API / audio capture
   - Packs pixel data into DDP (Distributed Display Protocol) packets
   - Dispatches DDP packets over UDP to the WLED controller IP
   - Proxies WLED JSON API calls from the Studio
   - Targets `localhost:4048` when `WLED_IP` env var is not set (emulator mode)

3. **Studio Layer** (`apps/studio`): A React + Vite SPA. It:
   - Connects to the Driver via WebSocket
   - Provides a visual pixel mapper (drag tubes on a canvas, their position defines the pixel layout)
   - Provides a color/effect editor with real-time DDP preview
   - Provides a frequency visualizer showing incoming FFT bands
   - Provides a Terminal panel for sending raw JSON commands to the Driver or WLED API
   - Has a Preset Manager that saves/loads JSON files into `firmware/presets.json`
   - Is accessible from a phone browser for remote control (responsive design)

4. **Emulator Layer** (`apps/emulator`): A lightweight React + Vite app. It:
   - Runs a Bun UDP server on port 4048 (localhost)
   - Parses incoming DDP packets
   - Forwards parsed pixel data to a React canvas via WebSocket
   - Renders pixels as a visual grid — this is the software substitute for the physical LED strip during development

---

## Monorepo Structure

Initialize a Bun workspace monorepo with this exact structure:

```
vandaLED/
├── apps/
│   ├── studio/          (React + Vite, TypeScript)
│   ├── driver/          (Bun + Hono, TypeScript)
│   └── emulator/        (React + Vite + Bun UDP server, TypeScript)
├── packages/
│   ├── ddp-engine/      (shared DDP pack/parse logic, no framework deps)
│   ├── audio-engine/    (FFT analysis, frequency band mapping)
│   └── ui-components/   (shared Tailwind + Shadcn components)
├── firmware/
│   ├── presets.json     (empty array initially)
│   └── cfg.json         (empty object initially)
├── scripts/
│   └── send-color.ts    (CLI: bun run scripts/send-color.ts --color #FF0000)
├── docs/                (already written, do not regenerate)
├── .env.example
├── .gitignore
├── package.json         (Bun workspaces root)
├── bunfig.toml
└── tsconfig.base.json
```

---

## Package Details

### `packages/ddp-engine`

Export these TypeScript interfaces and functions:

```typescript
export interface PixelFrame {
  pixels: Uint8Array   // Flat RGB array: [R0,G0,B0, R1,G1,B1, ...]
  offset: number       // Starting LED index (default 0)
  timestamp: number
}

export interface DDPHeader {
  flags: number
  type: number
  id: number
  offset: number
  dataLength: number
}

// Pack a PixelFrame into a DDP-compliant UDP Buffer
export function packDDP(frame: PixelFrame): Buffer

// Parse a raw UDP Buffer into a PixelFrame (for the emulator)
export function parseDDP(buf: Buffer): PixelFrame

// Create a solid-color PixelFrame
export function solidColor(ledCount: number, r: number, g: number, b: number): PixelFrame

// Create a blank (all-off) PixelFrame
export function blankFrame(ledCount: number): PixelFrame
```

The DDP header format:
- Byte 0: Flags (0x41)
- Byte 1: Data type (0x01 = RGB8)
- Byte 2: Destination ID (0x01)
- Byte 3: Reserved (0x00)
- Bytes 4–7: Offset (big-endian uint32)
- Bytes 8–9: Data length in bytes (big-endian uint16)
- Bytes 10+: RGB pixel data

### `packages/audio-engine`

Build on the Web Audio API `AnalyserNode`. Export:

```typescript
export interface FrequencyFrame {
  bands: Float32Array  // Normalized 0.0–1.0 per frequency band
  raw: Uint8Array      // Raw FFT bins 0–255
  peak: number         // RMS peak 0.0–1.0
  timestamp: number
}

export interface AnalyserConfig {
  fftSize?: number         // 512 | 1024 | 2048 | 4096 (default 2048)
  bandCount?: number       // Output band count (default 16)
  smoothing?: number       // 0.0–1.0 (default 0.8)
  minDecibels?: number     // (default -100)
  maxDecibels?: number     // (default -10)
}

export interface AudioAnalyser {
  getFrame(): FrequencyFrame
  getInputStream(): MediaStream
  destroy(): void
}

export async function createAnalyserFromDevice(deviceId: string, config?: AnalyserConfig): Promise<AudioAnalyser>
export async function createSystemAudioAnalyser(config?: AnalyserConfig): Promise<AudioAnalyser>

// Map a FrequencyFrame to a PixelFrame given a LED count
export function mapFrequencyToPixels(
  frame: FrequencyFrame,
  ledCount: number,
  config?: FrequencyMappingConfig
): PixelFrame

export interface FrequencyMappingConfig {
  colorMode: 'hue-shift' | 'solid' | 'dual-color'
  baseColor?: [number, number, number]
  accentColor?: [number, number, number]
  mirror?: boolean
  gain?: number           // Amplification factor (default 1.0)
  gamma?: number          // Gamma correction (default 1.0)
}
```

### `packages/ui-components`

Set up Shadcn with Tailwind. Provide these base components:
- `<Knob>` — circular rotary knob for brightness/speed/intensity values
- `<FrequencyBar>` — single animated bar for use in frequency visualizer
- `<PixelDot>` — single LED dot for use in the emulator grid and pixel mapper
- `<TerminalLine>` — single line in the terminal panel (with timestamp, type, text)
- `<StatusBadge>` — connection status indicator (hardware: connected/disconnected/emulating)

---

## Apps Details

### `apps/driver`

A Bun + Hono server. Architecture:

- `src/index.ts` — entry point, initialises server
- `src/routes/` — Hono route handlers
  - `ws.ts` — WebSocket handler (Studio connection)
  - `api.ts` — REST endpoint for direct commands
  - `wled.ts` — Proxy to WLED JSON API
- `src/services/`
  - `ddp-dispatcher.ts` — UDP socket management, DDP send loop, FPS metering
  - `audio-processor.ts` — Runs audio analysis, emits FrequencyFrames
  - `pixel-pipeline.ts` — Composites pixel sources (stream | audio | preset | idle) and feeds ddp-dispatcher
- `src/state.ts` — Global driver state (current mode, target IP, LED count, etc.)

The driver must handle these WebSocket message types from the Studio:
- `PIXEL_FRAME` — forward to DDP dispatcher immediately
- `WLED_STATE` — forward to WLED JSON API proxy
- `SET_MODE` — change active mode (stream | audio | preset | idle)
- `PING` — respond with `PONG` + hardware status

Environment variables (`.env`):
```
WLED_IP=        # Target IP — if unset, uses 127.0.0.1 (emulator)
DDP_PORT=4048
PORT=3000
LED_COUNT=100   # Default LED count
AUDIO_ENABLED=true
```

### `apps/studio`

React + Vite SPA. Pages/views:
- **Dashboard** (`/`) — Status overview, quick controls (brightness, on/off, active mode)
- **Pixel Mapper** (`/mapper`) — Canvas-based tube layout editor. Tubes can be dragged and positioned. The canvas dimensions map to the LED index space.
- **Effects** (`/effects`) — Color picker, effect selector (uses WLED JSON API), speed/intensity knobs
- **Audio** (`/audio`) — Device selector, real-time frequency visualizer (16+ bars), band-to-segment mapping editor
- **Terminal** (`/terminal`) — Scrollable log of all WebSocket messages + input field for raw JSON commands
- **Presets** (`/presets`) — Save/load named presets. Export syncs to `firmware/presets.json` via a file download.

Design aesthetic:
- Background: near-black (#0a0a0a)
- Primary accent: electric cyan (#00F5FF) or neon green (#39FF14)
- Typography: monospace for technical data, sans-serif for labels
- Texture: subtle noise grain overlay (CSS filter or SVG feTurbulence)
- Borders: 1px solid with low-opacity accent color
- No rounded corners on structural elements (brutalist grid), rounded on interactive controls only

### `apps/emulator`

Split into two parts:

**Bun UDP server** (`server/`):
- Listens on `0.0.0.0:4048` for UDP DDP packets
- Parses packets using `@vandaLED/ddp-engine`
- Broadcasts parsed pixel data to all connected WebSocket clients
- Counts and reports incoming FPS

**React Vite frontend** (`client/`):
- Connects to the emulator WebSocket server
- Renders a grid of `<PixelDot>` components (from `@vandaLED/ui-components`)
- Grid dimensions configurable (default: 10 rows × 10 columns = 100 LEDs)
- Shows FPS counter, LED count, and connection status
- Can be resized to simulate different strip configurations

---

## Scripts

### `scripts/send-color.ts`

CLI utility using `bun`:
```bash
bun run scripts/send-color.ts --color #FF4500 --ip 192.168.1.XX --count 100
```

If `--ip` is not provided, targets localhost (emulator).

---

## Root `package.json`

```json
{
  "name": "vandaLED",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "concurrently \"bun run --cwd apps/driver dev\" \"bun run --cwd apps/studio dev\" \"bun run --cwd apps/emulator dev\"",
    "build": "bun run --cwd packages/ddp-engine build && bun run --cwd packages/audio-engine build && bun run --cwd apps/driver build && bun run --cwd apps/studio build",
    "typecheck": "tsc --build"
  },
  "devDependencies": {
    "concurrently": "latest",
    "typescript": "^5.0.0"
  }
}
```

---

## `.gitignore`

Include: `node_modules`, `dist`, `.env`, `*.local`, `.DS_Store`, `bun.lockb` (or include it — your choice).
Do NOT gitignore `firmware/*.json` — those are version-controlled backups.

---

## Execution Order

1. Create root `package.json` with workspaces
2. Create `bunfig.toml` and `tsconfig.base.json`
3. Scaffold `packages/ddp-engine` with full implementation
4. Scaffold `packages/audio-engine` with full implementation
5. Scaffold `packages/ui-components` with Shadcn setup and the 5 base components
6. Scaffold `apps/driver` with all services and routes stubbed
7. Scaffold `apps/emulator` — UDP server first, then React frontend
8. Scaffold `apps/studio` — routing, layout, and all 6 views (stubbed but navigable)
9. Wire the WebSocket contract between studio ↔ driver
10. Wire the DDP pipeline: driver pixel-pipeline → ddp-dispatcher → UDP → emulator
11. Run `bun install` from root
12. Verify `bun run dev` starts all three apps without errors

Start with step 1 now.
```

---

## Notes on Using This Prompt

- **Context**: Paste the docs from `ARCHITECTURE.md`, `PROTOCOLS.md`, and `AUDIO.md` as additional context in your editor if it supports long context windows. This significantly improves output quality.
- **Iteration**: The prompt scaffolds the full structure. Subsequent prompts can focus on individual features (e.g., "Implement the FrequencyBar component" or "Build the pixel mapper canvas").
- **Types First**: If the AI starts writing app code before finishing the shared packages, stop it. The types in `ddp-engine` and `audio-engine` need to be stable before anything else compiles.
- **Emulator First**: For development without hardware, get the emulator rendering pixels before building Studio features. It's your visual confirmation that the DDP pipeline works end-to-end.
