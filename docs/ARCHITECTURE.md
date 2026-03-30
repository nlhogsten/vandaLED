# Architecture

> How the v.andal system is structured, how data flows through it, and why each technology was chosen.

---

## The 3-Tier Model

```
┌─────────────────────────────────────────────────────────────────┐
│  TIER 1 — HARDWARE                                              │
│  QuinLED-Dig-Uno (ESP32) + WS2815 LED strips                   │
│  Firmware: WLED                                                 │
│  Role: Receive pixel data and drive LEDs. Nothing else.         │
└─────────────────────────┬───────────────────────────────────────┘
                          │  DDP (UDP port 4048) — raw pixel arrays
                          │  WLED JSON API (HTTP) — state/preset control
┌─────────────────────────▼───────────────────────────────────────┐
│  TIER 2 — DRIVER (apps/driver)                                  │
│  Bun + Hono                                                     │
│  Role: Process audio, pack DDP packets, bridge UI to hardware.  │
│  Runs on: Laptop (interactive) or Raspberry Pi (permanent)      │
└─────────────────────────┬───────────────────────────────────────┘
                          │  WebSockets — pixel frames & state
                          │  REST (Hono) — commands & presets
┌─────────────────────────▼───────────────────────────────────────┐
│  TIER 3 — STUDIO (apps/studio)                                  │
│  React + Vite                                                   │
│  Role: Visual design, preset management, terminal control.      │
│  Accessible from: Laptop browser or phone browser               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Operational Modes

The system has two distinct modes that transition automatically.

### Standalone Mode (No Laptop)

When only the controller is powered:

1. The QuinLED-Dig-Uno boots and WLED starts
2. WLED loads the configured "Power On" preset
3. If a PCM1808 Line-In module is wired, WLED enters audio-reactive mode
4. The LEDs respond to audio from your DJ controller via the physical 3.5mm input
5. No network required. No software required. Fully self-contained.

```
DJ Controller ──(3.5mm RCA)──► PCM1808 ──(I2S)──► QuinLED ──► LED Tubes
```

### Override Mode (Laptop Connected)

When your laptop is on the same Wi-Fi network and the driver is running:

1. The driver (`apps/driver`) begins broadcasting DDP packets to `WLED_IP:4048`
2. WLED detects the incoming data stream and **immediately overrides** its internal pattern
3. The LEDs now display exactly what the driver is sending — your custom visuals
4. When the driver stops (laptop closes, process killed), WLED automatically reverts to standalone mode

```
Studio UI ──(WebSocket)──► Driver ──(DDP/UDP)──► QuinLED ──► LED Tubes
                              │
                    (FFT from Web Audio API
                     or system audio capture)
```

This transition is seamless and requires no configuration change on the hardware side.

---

## Data Flow: A Single Frame

Here is how a single frame of pixel data travels from creative intent to physical light:

```
1. INTENT
   User moves a color slider in Studio UI
           │
           ▼
2. ENCODE (apps/studio)
   RGB values are packed into a PixelFrame object
   { pixels: Uint8Array(300), timestamp: number }
           │  WebSocket message
           ▼
3. RECEIVE (apps/driver)
   Hono WS handler receives the PixelFrame
           │
           ▼
4. PACK (packages/ddp-engine)
   PixelFrame is wrapped in a DDP header:
   [flags, type, id, offset_hi, offset_lo, len_hi, len_lo, ...RGB]
           │
           ▼
5. DISPATCH (apps/driver — node:dgram)
   UDP packet sent to WLED_IP:4048
           │  ~0.1ms over local Wi-Fi
           ▼
6. RECEIVE (QuinLED-Dig-Uno — WLED firmware)
   ESP32 parses DDP header, extracts RGB data
           │
           ▼
7. OUTPUT
   WS2815 strip updates — physical light changes
```

Total latency: typically 1–5ms over local Wi-Fi. Imperceptible.

---

## Why These Technologies

### Bun (not Node.js)
- Native UDP socket support via `node:dgram` (compatible API)
- Significantly faster startup and TypeScript execution than Node
- Bun Workspaces allows sharing the `ddp-engine` and `audio-engine` packages across all apps with zero build steps
- Single runtime for dev, test, and production

### Hono (not Express/Fastify)
- Extremely lightweight (~14kb) — important since the driver process will be running alongside audio processing
- First-class TypeScript support and typed RPC makes the Studio ↔ Driver interface type-safe
- WebSocket support built-in

### React + Vite (not Next.js)
- Next.js strengths (SSR, SEO, file-based routing) are irrelevant for a local hardware controller UI
- Vite's HMR is faster for iterative visual design work
- The Studio is a single-page app — there is no server-side rendering requirement
- Expo can be added later for a native mobile remote without changing the driver API

### DDP (not Art-Net or E1.31)
- Art-Net and E1.31 are limited by 512-channel "universes" — managing multiple universes adds complexity
- DDP sends raw pixel data in a single flat packet with minimal overhead
- No universe math. LED #0 is byte 0. LED #299 is bytes 897–899.
- WLED supports DDP natively with no additional configuration beyond enabling it

### WS2815 (not WS2812B)
- 12V architecture prevents voltage drop (the "warm yellow at the end of the strip" problem)
- Dual data line: if one LED dies, the rest of the strip continues to function
- Higher voltage means lower current draw, which reduces heat and allows longer runs without signal amplifiers

### WLED (not custom firmware)
- Mature, battle-tested open-source firmware with an active community
- Built-in JSON API that is well-documented and stable
- Handles the low-level timing signals required for addressable LEDs (this is non-trivial to implement correctly)
- DDP receiver is built in — no custom firmware patches needed
- Config and presets are exportable as JSON, making them version-controllable

---

## The Emulator

The emulator (`apps/emulator`) is a software replica of the hardware layer. It:

- Runs a small Bun UDP server on `localhost:4048`
- Parses incoming DDP packets using the same `ddp-engine` package the real hardware uses
- Forwards parsed pixel data to a React frontend via WebSocket
- Renders pixels as a grid of `div` elements (or a canvas) styled with the actual RGB values

```
apps/driver ──(DDP/UDP localhost:4048)──► apps/emulator (Bun UDP server)
                                                   │  WebSocket
                                          React canvas (renders pixels)
```

The driver code is **identical** whether targeting the emulator or real hardware. The only difference is the value of `WLED_IP` in the environment. This means 100% of visual logic developed against the emulator will work on the physical strip without modification.

---

## Shared Packages

### `packages/ddp-engine`

Core DDP logic shared between the driver (sends packets) and the emulator (receives packets).

Key exports:
```typescript
// Pack a PixelFrame into a DDP-compliant UDP Buffer
packDDP(frame: PixelFrame): Buffer

// Parse a raw UDP Buffer into a PixelFrame
parseDDP(buf: Buffer): PixelFrame

// Types
interface PixelFrame {
  pixels: Uint8Array  // RGB triplets, length = LED_COUNT * 3
  offset: number      // Starting LED index (for segmented sends)
  timestamp: number
}

interface DDPHeader {
  flags: number
  type: number
  id: number
  offset: number
  dataLength: number
}
```

### `packages/audio-engine`

FFT analysis and frequency band mapping. Designed to run in the driver and output a `FrequencyFrame` that can be mapped to pixel arrays.

Key exports:
```typescript
interface FrequencyFrame {
  bands: Float32Array   // 16–64 frequency bands, 0.0–1.0 normalized
  peak: number          // Overall peak level
  bpm: number           // Detected BPM (optional, expensive)
  timestamp: number
}

// Map a FrequencyFrame to a PixelFrame for a given LED count
mapFrequencyToPixels(frame: FrequencyFrame, ledCount: number, config: MappingConfig): PixelFrame
```

---

## Scaling Up

The current architecture is intentionally single-controller. If you eventually want to run multiple controllers (e.g., several rooms, a stage setup), the driver can be extended to:

1. Maintain a registry of `{ name, ip, ledCount }` objects
2. Broadcast the same DDP packet to multiple UDP targets simultaneously
3. Expose a "group" concept in the Studio UI for synchronized control

This requires no hardware changes — just driver-side additions.
