# Hardware

> Bill of materials, wiring guide, and step-by-step assembly for the v.andal LED rig.

---

## Bill of Materials (BOM)

| # | Component | Recommended Part | Purpose | Est. Cost (USD) |
|---|---|---|---|---|
| 1 | **LED Controller** | QuinLED-Dig-Uno v3 (Pre-Assembled) | ESP32 brain with level shifters, fuses, and terminal blocks | ~$32 |
| 2 | **LED Strip** | WS2815 12V, 60 LED/m (5m reel) | Addressable RGB — 12V for voltage stability, dual data line | ~$45 |
| 3 | **Power Supply** | 12V 10A DC Desktop Brick (ALITOVE or similar) | Powers both controller and LEDs | ~$28 |
| 4 | **Diffusion Tubing** | Silicone Neon Flex Tube (approx. 16mm OD) | Houses the LED strip; diffuses and shapes the light | ~$20 |
| 5 | **Audio ADC Module** | PCM1808 I2S ADC Breakout | Converts wired 3.5mm/RCA line-in signal to I2S for the ESP32 | ~$8 |
| 6 | **Connectors** | BTF-Lighting 3-pin Waterproof Pigtails (10-pack) | Makes LED tubes hot-swappable from the controller box | ~$12 |
| 7 | **Enclosure** | ABS Project Box ~115×90×35mm (IP65 rated) | Houses the QuinLED board and power terminals cleanly | ~$12 |
| 8 | **Diffusion Spray** | Rust-Oleum Frosted Glass Spray | Applied to tubes for the grainy, neon-glow aesthetic | ~$10 |
| 9 | **DC Barrel Jack** | 5.5mm×2.1mm Panel Mount Jack | Clean power input for the enclosure | ~$3 |
| 10 | **Misc** | Heat shrink, solder, 18AWG wire | Wiring and connections | ~$10 |
| | | | **Total** | **~$180** |

> **Note:** Prices are estimates. Shipping to Hawaii from mainland suppliers (Amazon, BTF-Lighting direct) typically adds 3–7 days and occasionally a small surcharge. Order the controller and LEDs first — they have the longest lead times and you can begin all software development while waiting.

---

## Understanding the Components

### QuinLED-Dig-Uno
This is not just an ESP32 dev board. It includes:
- **Logic Level Shifter**: Converts the ESP32's 3.3V data signal to the 5V signal that WS2815 LEDs require. Without this, you get flickering or no response.
- **Onboard Fuse**: Protects your strip and power supply from shorts.
- **Screw Terminals**: Clean, solderless connections for power and data.
- **Pre-flashed with WLED** (on newer revisions) or easily flashed via USB-C.

### WS2815 vs WS2812B
Most tutorials use WS2812B. The WS2815 is strictly better for this use case:
- **12V architecture**: At 5V, a strip of 100 LEDs draws ~6A and suffers from voltage drop — the LEDs at the far end appear dimmer and yellower. At 12V, the same strip draws ~2.5A with no visible drop.
- **Backup data line**: A second data wire runs alongside the main one. If a single LED's chip fails, the data signal routes around it and the rest of the strip continues functioning.

### PCM1808 (Audio ADC)
This module converts an analog audio signal (from a 3.5mm or RCA jack) into an I2S digital signal that the ESP32 can process. This is what allows WLED's sound-reactive engine to work with a wired DJ controller output rather than a microphone.

---

## Wiring Guide

### Power Wiring

```
12V Power Brick ──(DC cable)──► DC Barrel Jack (on enclosure)
                                       │
                    ┌──────────────────┤
                    │                  │
              QuinLED VIN           LED Strip +12V
              QuinLED GND           LED Strip GND
```

> Use 18AWG wire for power runs. The LED strip can draw up to 8–9A at full white — undersized wire will get hot.

### LED Data Wiring

The QuinLED-Dig-Uno has labeled output terminals. The WS2815 strip has three wires:
- **+12V** → Power terminal
- **GND** → Ground terminal
- **DAT** (Data) → QuinLED output terminal (e.g., Q1/GPIO 2)
- **BKP** (Backup Data) → Connect to the DAT line as well (or leave floating — the strip handles the fallback internally)

Use the 3-pin waterproof connectors between the controller output and each tube. This gives you hot-swappable, weatherproof connections.

### PCM1808 Audio Module Wiring

Wire the PCM1808 breakout to the QuinLED's GPIO headers:

| PCM1808 Pin | QuinLED GPIO | Notes |
|---|---|---|
| VDD | 3.3V | Module power |
| GND | GND | Ground |
| DOUT (SD) | GPIO 2 | I2S Data |
| LRCK (WS) | GPIO 12 | I2S Word Select (L/R clock) |
| BCK (SCK) | GPIO 15 | I2S Bit Clock |
| FMT | GND | Ties to ground for I2S format mode |
| MD | GND | Sets to slave mode |

Add a 3.5mm stereo panel jack to the enclosure and wire its tip and ring (L+R) to the PCM1808's analog inputs. Run the Booth Out or Master 2 from your DJ controller into this jack.

---

## Assembly: Step by Step

### Phase 1 — Tube Assembly

1. **Cut tubing** to your desired lengths. Consider the physical installation — how will they be mounted, how far are they from the controller?

2. **Apply diffusion spray**: Hold the Rust-Oleum Frosted Glass spray ~30cm from the tube. Apply 2–3 light coats to the exterior. For a grittier, more uneven glow, apply deliberately unevenly. Let cure for 1 hour.

3. **Insert LED strip**: Slide the WS2815 strip into the tube. If it's a tight fit, attach a thin string to the LED strip's end with tape, feed the string through first, then pull. The LEDs should face outward (towards the tube wall).

4. **Seal ends**: Hot glue the end of the strip inside the tube cap. Solder a 3-pin waterproof pigtail connector to the input end (+12V, GND, DAT).

5. **Repeat** for each tube.

### Phase 2 — Controller Box Assembly

1. **Drill the enclosure**: 
   - One hole for the DC barrel jack (power input)
   - One hole for the 3-pin waterproof connector (LED output)
   - One hole for the 3.5mm audio jack (if using PCM1808)
   - One small hole or slot for USB-C access (for firmware updates)

2. **Mount the QuinLED board** inside the box using M3 standoffs. The board should not directly contact the plastic.

3. **Wire power**: DC barrel jack → QuinLED VIN/GND terminals.

4. **Wire the LED output**: QuinLED Q1/GND/12V terminals → 3-pin waterproof socket (to mate with tube pigtails).

5. **Wire the PCM1808** as per the table above. Mount it with a dab of hot glue or a small standoff.

6. **Close the box**. Label the ports.

### Phase 3 — Firmware Setup

1. Connect the QuinLED to your laptop via USB-C.

2. Open [install.wled.me](https://install.wled.me) in Chrome or Edge (required for Web Serial).

3. Select your port and install the latest WLED release (v0.14+).

4. After install, a Wi-Fi access point `WLED-AP` will appear. Connect to it.

5. In the WLED setup page, enter your home Wi-Fi credentials. The controller will join your network.

6. Find its IP address (check your router's device list or use the WLED app).

7. Open `http://[IP]/` in your browser to confirm it's working.

8. **LED Config** (`Config > LED Preferences`):
   - LED type: `WS281x`
   - Color order: `RGB` (test with a single color if wrong, swap to GRB)
   - LED count: your actual count
   - Max brightness: `240`
   - Max current: `8000mA` (stays under the 10A supply with headroom)

9. **Audio Config** (`Config > Sound Settings`):
   - Input: `Generic I2S`
   - SD GPIO: `2`, WS GPIO: `12`, SCK GPIO: `15`

10. **DDP**: Ensure `Sync Interfaces > DDP` is enabled (it is by default in recent WLED versions).

11. **Export your config**: `Config > Security > Create backup`. Save `cfg.json` and `presets.json` into `firmware/` in this repo and commit.

---

## Testing

### Hardware Test (LEDs responding)
In the WLED UI, go to Effects and select `Solid`. Pick a bright color. All LEDs should light up uniformly. If they flicker or show wrong colors, check:
- Color order (RGB vs GRB)
- Data wire connection quality
- Level shifter (QuinLED should handle this automatically)

### Audio Test (Sound reactive)
Play music from your DJ controller through the Booth output into the 3.5mm jack. In WLED, select an audio-reactive effect like `Freqwave` or `Audiograph`. The lights should respond to the music. If there's no response, re-check the PCM1808 GPIO assignments.

### Network Test (DDP streaming)
With the driver running (`bun run dev` in `apps/driver`), the emulator should display pixel data. Change `WLED_IP` in your `.env` to the controller's IP. The physical LEDs should now mirror the emulator.

---

## Enclosure Aesthetic Notes

The project box doesn't have to look like a generic grey plastic box. Options:
- **Spray paint** the exterior black with matte finish. Add a vinyl-cut logo.
- **Laser-cut acrylic panel** as the front face with labeled cutouts for the jacks.
- **3D print** a custom enclosure shaped to your mounting needs (wall mount, clamp, etc.).

The hardware should feel like a finished product, not a prototype.
