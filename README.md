# v.andal lights

> A professional-grade, modular LED lighting system built for DJs, developers, and installations. Designed to run standalone, react to audio, and be fully programmable from a custom UI or terminal.

---

## What This Is

`v.andal lights` is a full-stack IoT lighting system built around addressable LED strips housed in frosted silicone tubing. It is designed to:

- **Run standalone** — react to audio from a DJ controller via a wired line-in with no laptop required
- **Be overridden wirelessly** — when a laptop is present, stream custom pixel data at 60+ FPS over Wi-Fi via the DDP protocol
- **Be fully programmable** — control visuals from a browser-based Studio UI, a terminal CLI, or raw TypeScript code
- **Be version-controlled** — every preset, config, and piece of visual logic lives in this repo

Think of it as three layers: the **hardware** (LED tubes + ESP32 controller), the **firmware** (WLED running on the controller), and the **software** (this monorepo).

---

## Monorepo Structure

```
vandal-lights/
├── apps/
│   ├── studio/          # React + Vite — Visual design UI & control dashboard
│   ├── driver/          # Bun + Hono — DDP streamer, audio FFT engine, API bridge
│   └── emulator/        # React + Vite — Virtual LED strip for development without hardware
├── packages/
│   ├── ddp-engine/      # Shared DDP packet logic (header packing, UDP dispatch)
│   ├── audio-engine/    # FFT analysis, frequency band mapping, audio pipeline
│   └── ui-components/   # Shared Tailwind/Shadcn component library
├── firmware/
│   ├── presets.json     # WLED preset backups (your saved visual programs)
│   └── cfg.json         # WLED system config (GPIO assignments, LED count, etc.)
├── scripts/             # CLI tools — send colors, trigger presets, query state
├── docs/                # Deep-dive reference docs (see below)
├── .gitignore
├── package.json         # Bun Workspaces root config
├── bunfig.toml
└── README.md
```

---

## Apps Overview

### `apps/driver` — The Brain
The Bun/Hono server that runs on your laptop (or a Raspberry Pi for a permanent install). It:
- Receives pixel data from the Studio UI via WebSockets
- Runs FFT audio analysis on a connected audio source
- Packs pixel arrays into DDP headers and blasts them over UDP to the hardware controller
- Exposes a REST API (via Hono) for state management and preset control
- Falls back gracefully when the hardware is offline (redirects to emulator)

### `apps/studio` — The Studio
A React/Vite single-page app with a dark, high-contrast "v.andal" aesthetic. It provides:
- A **Visual Pixel Mapper** — drag your tubes onto a canvas to match their physical layout
- A **Color & Effect Picker** — design static or animated palettes
- A **Frequency Visualizer** — see real-time FFT bands and map them to LED segments
- A **Terminal Panel** — send raw JSON commands or run scripts directly from the UI
- A **Preset Manager** — save, load, and sync presets to `firmware/presets.json`

### `apps/emulator` — The Virtual Strip
A lightweight React app that acts as a software-rendered LED strip. It listens for the same DDP packet stream the real hardware receives, rendering pixels as a responsive grid on screen. This means you can build and test 100% of your visual logic before the hardware arrives. When it does, you change one IP address.

---

## Docs

| Document | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Full system architecture — the 3-tier model, data flow, standalone vs. override modes |
| [`docs/HARDWARE.md`](./docs/HARDWARE.md) | Bill of materials, wiring diagrams, assembly instructions |
| [`docs/PROTOCOLS.md`](./docs/PROTOCOLS.md) | DDP, WLED JSON API, E1.31/Art-Net — protocols explained for developers |
| [`docs/AUDIO.md`](./docs/AUDIO.md) | Audio pipeline — FFT, frequency band mapping, wired line-in vs. Web Audio API |
| [`docs/AI_INIT_PROMPT.md`](./docs/AI_INIT_PROMPT.md) | The AI agent prompt to scaffold the full project in Cursor/Windsurf |

---

## Quick Start (Software — No Hardware Required)

```bash
# Clone and install
git clone https://github.com/your-org/vandal-lights.git
cd vandal-lights
bun install

# Start everything in dev mode (driver + studio + emulator)
bun run dev

# The emulator will be available at http://localhost:5174
# The studio UI will be available at http://localhost:5173
# The driver API will be available at http://localhost:3000
```

The driver defaults to targeting `localhost:4048` (the emulator) when no `WLED_IP` environment variable is set.

---

## Environment Variables

Create a `.env` file in `apps/driver/`:

```env
# Target IP for DDP output — defaults to localhost (emulator) if not set
WLED_IP=192.168.1.XX

# Port for DDP (WLED default)
DDP_PORT=4048

# Hono server port
PORT=3000

# Enable audio engine
AUDIO_ENABLED=true
```

---

## Hardware

When you're ready to connect physical hardware, see [`docs/HARDWARE.md`](./docs/HARDWARE.md) for the full build guide. The short version:

- **Controller**: QuinLED-Dig-Uno (ESP32-based, pre-assembled with level shifters + fuses)
- **LEDs**: WS2815 (12V addressable strip — dual data line, voltage drop resistant)
- **Diffusion**: Silicone neon flex tubing + Rust-Oleum frosted glass spray
- **Audio In**: PCM1808 I2S ADC module (wired 3.5mm line-in from DJ gear)
- **Power**: 12V 10A DC brick

Flash the controller at [install.wled.me](https://install.wled.me), point it at your Wi-Fi, and update `WLED_IP` in your `.env`.

---

## Firmware Backup

WLED config and presets are backed up in `/firmware`. To restore after flashing a new controller:

1. Flash WLED via [install.wled.me](https://install.wled.me)
2. Connect to its Wi-Fi AP, configure your home Wi-Fi
3. In the WLED UI: `Config > Security > Restore backup` — upload `firmware/cfg.json`
4. In `Presets`: import `firmware/presets.json`

---

## Philosophy

> The hardware is a receiver. The software is the instrument.

This system is intentionally designed so that the hardware is dumb and the software is smart. WLED handles the low-level LED driving. Everything interesting — the audio analysis, the visual mapping, the creative logic — happens in TypeScript, in this repo, version-controlled and portable.
