# Protocols

> Every communication protocol used in the vandaLED system, explained for developers.

---

## Overview

The system uses three distinct protocols, each serving a different layer of the stack:

| Protocol | Transport | Used For | Layer |
|---|---|---|---|
| **DDP** | UDP | Streaming pixel data at 60+ FPS | Driver → Hardware |
| **WLED JSON API** | HTTP | State control, presets, config | Driver/Studio → Hardware |
| **WebSocket** | TCP | Real-time pixel data and events | Studio ↔ Driver |

---

## DDP — Distributed Display Protocol

DDP is the core streaming protocol of this system. Think of it as a "video stream for LEDs."

### What Problem It Solves

Traditional DMX (the lighting industry standard) is limited to 512 channels per "universe." For RGB LEDs, each LED takes 3 channels, meaning one universe handles only 170 LEDs. For larger installations, you need to manage multiple universes, which adds complexity.

Art-Net and E1.31 are "DMX over IP" protocols — they inherit this universe limitation.

DDP removes the universe concept entirely. You send a flat array of RGB bytes with an offset header. That's it. One packet, up to ~1400 LEDs per packet (limited only by UDP MTU), no universe math.

### Packet Structure

```
Byte 0:   Flags       (0x41 = standard data packet)
Byte 1:   Data Type   (0x01 = RGB8)
Byte 2:   Destination ID (0x01 = default)
Byte 3:   Reserved    (0x00)
Bytes 4-7: Offset     (which LED to start at — big endian uint32)
Bytes 8-9: Data Length (byte count of the pixel data — big endian uint16)
Bytes 10+: Pixel Data  (R, G, B, R, G, B, ... for each LED)
```

### Example: Send a solid red to 100 LEDs

```typescript
import dgram from 'node:dgram';

const LED_COUNT = 100;
const WLED_IP = '192.168.1.XX';
const DDP_PORT = 4048;

const pixelData = new Uint8Array(LED_COUNT * 3);
// Fill with red (R=255, G=0, B=0)
for (let i = 0; i < LED_COUNT; i++) {
  pixelData[i * 3] = 255;     // R
  pixelData[i * 3 + 1] = 0;   // G
  pixelData[i * 3 + 2] = 0;   // B
}

const dataLength = pixelData.length;
const header = Buffer.from([
  0x41, 0x01, 0x01, 0x00,                       // Flags, Type, ID, Reserved
  0x00, 0x00, 0x00, 0x00,                       // Offset (start at LED 0)
  (dataLength >> 8) & 0xFF, dataLength & 0xFF,  // Data length (big endian)
]);

const packet = Buffer.concat([header, Buffer.from(pixelData)]);

const client = dgram.createSocket('udp4');
client.send(packet, DDP_PORT, WLED_IP);
```

### Key Properties
- **Port**: 4048 (standard DDP port, used by WLED)
- **Protocol**: UDP — fire and forget, no acknowledgement, minimal overhead
- **Framerate**: Easily achieves 60 FPS for 300–500 LEDs over local Wi-Fi
- **Override**: When WLED receives a DDP packet, it immediately overrides whatever internal pattern was running

---

## WLED JSON API

WLED exposes a rich HTTP API for controlling every aspect of the system without needing to stream pixel data. This is used for "set and forget" operations: changing brightness, switching presets, querying state.

### Base URL

```
http://[WLED_IP]/json/
```

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/json/state` | Current state (brightness, effect, color, segments) |
| `POST` | `/json/state` | Update state |
| `GET` | `/json/info` | Device info (version, LED count, free heap) |
| `GET` | `/json/effects` | List of all effect names |
| `GET` | `/json/palettes` | List of all palette names |
| `GET` | `/json/cfg` | Full config dump |
| `POST` | `/json/cfg` | Update config |

### Common State Commands

**Set brightness to 50%:**
```typescript
await fetch(`http://${WLED_IP}/json/state`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bri: 128 })
});
```

**Turn off:**
```typescript
await fetch(`http://${WLED_IP}/json/state`, {
  method: 'POST',
  body: JSON.stringify({ on: false })
});
```

**Set effect and palette on first segment:**
```typescript
await fetch(`http://${WLED_IP}/json/state`, {
  method: 'POST',
  body: JSON.stringify({
    seg: [{ fx: 42, pal: 8, sx: 128, ix: 200 }]
    //       ^effect  ^palette  ^speed  ^intensity
  })
});
```

**Set a static color (segment 0 = orange):**
```typescript
await fetch(`http://${WLED_IP}/json/state`, {
  method: 'POST',
  body: JSON.stringify({
    seg: [{ col: [[255, 80, 0]] }]
  })
});
```

### The `seg` (Segment) Model

WLED lets you divide your LED strip into independent segments, each with its own effect, palette, colors, speed, and brightness. This is how you run different visual zones on the same physical strip.

```typescript
interface WLEDSegment {
  id: number;        // Segment index
  start: number;     // First LED index (inclusive)
  stop: number;      // Last LED index (exclusive)
  len?: number;      // Length (alternative to stop)
  on: boolean;       // Segment on/off
  bri: number;       // Brightness 0–255
  col: number[][];   // Colors [[R,G,B], [R,G,B], [R,G,B]] (primary, secondary, tertiary)
  fx: number;        // Effect ID (see /json/effects for the list)
  sx: number;        // Effect speed 0–255
  ix: number;        // Effect intensity 0–255
  pal: number;       // Palette ID (see /json/palettes)
}
```

### State Shape Reference

```typescript
interface WLEDState {
  on: boolean;          // Power on/off
  bri: number;          // Master brightness 0–255
  transition: number;   // Crossfade time in 100ms units
  ps: number;           // Current preset ID (-1 if none)
  pl: number;           // Current playlist ID (-1 if none)
  nl: {                 // Nightlight config
    on: boolean;
    dur: number;
    mode: number;
    tbri: number;
  };
  udpn: {               // UDP sync settings
    send: boolean;
    recv: boolean;
  };
  seg: WLEDSegment[];   // Segment array
}
```

---

## WebSocket (Studio ↔ Driver)

The Studio UI and the Driver communicate via a persistent WebSocket connection. This is not a standard protocol — it is an internal contract defined in `packages/shared`.

### Why WebSocket and not HTTP

Pixel data can arrive at 60 frames per second. Opening a new HTTP request for each frame would be enormously wasteful. A persistent WebSocket connection has near-zero overhead per message.

### Message Types

All messages are JSON with a `type` discriminator:

```typescript
// Studio → Driver: Send a pixel frame
{
  type: 'PIXEL_FRAME',
  payload: {
    pixels: number[],   // Flat RGB array [R, G, B, R, G, B, ...]
    offset: number      // Starting LED index
  }
}

// Studio → Driver: Set WLED state via JSON API
{
  type: 'WLED_STATE',
  payload: Partial<WLEDState>
}

// Studio → Driver: Change active mode
{
  type: 'SET_MODE',
  payload: { mode: 'stream' | 'preset' | 'audio' | 'idle' }
}

// Driver → Studio: Audio frequency data
{
  type: 'FREQUENCY_FRAME',
  payload: {
    bands: number[],    // 16–64 normalized values 0.0–1.0
    peak: number,
    timestamp: number
  }
}

// Driver → Studio: Hardware status
{
  type: 'HARDWARE_STATUS',
  payload: {
    connected: boolean,
    ip: string,
    ledCount: number,
    fps: number         // Measured outgoing FPS
  }
}
```

### Connection Management

The Driver exposes a WebSocket endpoint at `ws://localhost:3000/ws`. The Studio connects on startup and reconnects automatically if the connection drops. The Emulator connects to the same endpoint.

---

## Protocol Decision Guide

When writing new features, use the right protocol for the job:

| If you want to... | Use |
|---|---|
| Stream a 60 FPS animation to the LEDs | **DDP** (via Driver UDP socket) |
| Turn the lights on/off from the UI | **WLED JSON API** (via Driver HTTP proxy) |
| Switch to a saved WLED preset | **WLED JSON API** |
| Send a pixel frame from the Studio | **WebSocket** (Studio → Driver → DDP) |
| Build a terminal command that sets a color | **WLED JSON API** (direct or via Driver) |
| Broadcast audio frequency data to the UI | **WebSocket** (Driver → Studio) |
| Sync multiple controllers simultaneously | **DDP** (broadcast or multi-target from Driver) |
