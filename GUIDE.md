# vandaLED System User Guide

Welcome to the **vandaLED Studio**. This guide will walk you through how to use the software, how to verify it's working properly, and how to get the most out of your hardware.

---

## 🚀 Starting the System

To spin up the entire ecosystem (Driver, Studio, and Emulator), open a terminal in the root of the project and run:

```bash
bun install
bun run dev
```

This starts three processes:
1. **Driver API & WebSocket Server** — The bridge between the Studio and the LEDs
2. **Emulator** — A virtual LED strip running locally on your computer
3. **Studio UI** — The browser-based control dashboard

Once running, simply open your browser to **http://localhost:5173**.

---

## 🎛️ The Control Center

The **Control** page is where all the action happens. It consists of four tabs, and a bottom-docked panel area that can show either the **Live Preview Strip** or the **Terminal**. Only one active program stream should be running at a time. Switching tabs automatically stops the previous stream when needed. The key distinction is:
- **Standalone** = WLED on the controller is running its own preset/effect.
- **Override** = the laptop is streaming custom pixels through the driver.

### 1. Status Tab
This tab gives you a high-level overview of the driver's connection to the physical (or emulated) hardware.
- **Connection**: Shows the IP address of your WLED controller. If it says `127.0.0.1:4048`, it is talking to the **Emulator**.
- **FPS**: How fast the driver is currently pushing frames to the hardware.
- **LEDs / Brightness**: Global constraints. Use the knob here to quickly turn up or dim the entire system.
- **Active Mode**: Shows you what mode is currently instructing the hardware logic (`idle`, `override_effect`, `override_audio`, etc.). Use these buttons manually to force modes if the UI goes out of sync.

### 2. Static Tab
The Static engine dynamically generates colorful, animated pixel data directly in your browser using classic strip-based effects.
- **Select Generator**: Click a tile to choose the animation style (e.g. Rainbow, Fire, Ocean).
- **Palette**: Define a Primary and Secondary color. Some effects (like Solid or Pulse) only use Primary. Others (like Chase or Gradient) mix between both.
- **Start Static Program**: Click the start button at the bottom. You should see the **Live Preview Strip** instantly light up and animate.

### 3. Spatial Tab
The Spatial engine uses the coordinates from the Pixel Mapper instead of assuming your LEDs are a straight strip.
- **Select Generator**: Choose a mapper-aware effect such as Linear Sweep, Radial Bloom, or Orbit.
- **Palette / Speed / Intensity**: These behave similarly to the Static tab, but the motion is driven by the LED positions in the mapper canvas.
- **Start Spatial Program**: This streams pixels that are derived from the actual mapped hardware geometry.

### 4. Reactive Tab
The Reactive engine runs real-time Fast Fourier Transforms (FFT) on your microphone or system output, turning sound frequencies directly into light.
- **Hardware Input**: Select your microphone or "System Audio/Display Capture".
  - *Tip: For the best results when DJing locally, use a virtual audio cable (like VB-Cable or BlackHole) or capture your System Audio.*
- **Listen**: Click `Listen`. A prompt may ask for permission.
- **Gain**: If the audio is too quiet (the bars aren't jumping much), drag the Gain slider up until the Peak Level hovers around 60-90% during loud parts of the song.
- **Frequency Spectrum**: Watch the visualizer respond to the audio in real-time. The higher a frequency bar gets, the brighter the corresponding LED segment on the live preview strip will illuminate.

### The Live Preview Strip
The Live Preview is available from the left nav and opens in the bottom dock. **If this strip is animating, the system is working perfectly.** It is intentionally simple: it shows the raw outgoing color pattern as a linear strip, regardless of the mapper layout. Whatever is displayed here is exactly what is being sent to the WLED hardware or Emulator.

---

## 🗺️ Pixel Mapper

The real world comes with constraints—your LED strips aren't just one long straight line; they are broken up into distinct tubes or frames.

In the Mapper:
1. Drag the digital segments to match how they are physically laid out in the room.
2. Pan and zoom the canvas so new segments never get stranded outside the visible area.
3. Select a segment and update its **label**, **LED count**, **rotation**, and **upstream segment**.
4. All changes auto-save local to your browser.

The mapper is now the source of truth for hardware layout. It derives the physical LED chain order from the inline segment connections you define, and both Studio and Emulator use that same layout.

---

## 💾 Presets

Presets save your favorite **Studio program configurations** so you don't have to keep dialing them in.

1. Once you have a static, spatial, or reactive program you like, head to the **Presets** page.
2. Type a name and click **Save**.
3. The preset will be added to the list. You can trigger it by clicking the '▶' icon on the preset row.
4. Presets are tagged to the current mapper layout version, so you can tell when a saved preset was built against an older hardware arrangement.
5. **Syncing**: These presets are separate from WLED firmware presets. Export them as Studio JSON for version control, and keep WLED backups in `/firmware/presets.json`.

## 🛠️ The Bottom Dock

The left nav includes toggles for **Live Preview** and **Terminal**. Either one opens in the bottom dock, and the dock can be closed again without leaving your current page.

### Terminal

- **Purpose**: It displays the raw JSON communication between the Studio and the Driver. If something isn't working, check the terminal for `error` logs.
- **Sending Commands**: You can type manual JSON commands into the input bar. For example, to ping the driver, type: `{"type":"PING"}` and hit Send.
- **Clean Interface**: It specifically hides `PIXEL_FRAME` messages to prevent flooding your console, making it easy to identify state changes.

---

## 🚑 Troubleshooting

**"I told it to listen to Audio, but the lights aren't doing anything!"**
Make sure:
1. You selected the correct microphone/interface in the Audio tab dropdown.
2. The Gain slider isn't turned all the way down.
3. You didn't switch to the Static or Spatial tab afterward (switching programs will auto-stop the current reactive stream).
4. Look at the **Live Preview Strip**—is it moving? If yes, but your *physical* lights aren't moving, verify your `WLED_IP` in `.env` matches your QuinLED's true Wi-Fi IP address.

**"My CPU utilization is massive"**
On the Control page, reduce the target FPS for your Static or Spatial program from `60 FPS` to `30 FPS`. Audio FFT polling is lightweight, but transferring byte arrays 60 times a second drains battery. 30 FPS is usually sufficient for standard smooth visuals.
