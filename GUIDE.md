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

The **Control** page is where all the action happens. It consists of three tabs, and a **Live Preview Strip** at the bottom. Only one tab (Effects or Audio) can be actively streaming pixels to the hardware at a time. Switching tabs automatically stops the previous stream.

### 1. Status Tab
This tab gives you a high-level overview of the driver's connection to the physical (or emulated) hardware.
- **Connection**: Shows the IP address of your WLED controller. If it says `127.0.0.1:4048`, it is talking to the **Emulator**.
- **FPS**: How fast the driver is currently pushing frames to the hardware.
- **LEDs / Brightness**: Global constraints. Use the knob here to quickly turn up or dim the entire system.
- **Active Mode**: Shows you what mode is currently instructing the hardware logic (`idle`, `stream`, etc.). Use these buttons manually to force modes if the UI goes out of sync.

### 2. Effects Tab
The Effects engine dynamically generates colorful, animated pixel data directly in your browser.
- **Select Generator**: Click a tile to choose the animation style (e.g. Rainbow, Fire, Ocean).
- **Palette**: Define a Primary and Secondary color. Some effects (like Solid or Pulse) only use Primary. Others (like Chase or Gradient) mix between both.
- **Start Stream**: Click the `Start Stream` button at the bottom. You should see the **Live Preview Strip** instantly light up and animate!

### 3. Audio Tab
The Audio engine runs real-time Fast Fourier Transforms (FFT) on your microphone or system output, turning sound frequencies directly into light.
- **Hardware Input**: Select your microphone or "System Audio/Display Capture".
  - *Tip: For the best results when DJing locally, use a virtual audio cable (like VB-Cable or BlackHole) or capture your System Audio.*
- **Listen**: Click `Listen`. A prompt may ask for permission.
- **Gain**: If the audio is too quiet (the bars aren't jumping much), drag the Gain slider up until the Peak Level hovers around 60-90% during loud parts of the song.
- **Frequency Spectrum**: Watch the visualizer respond to the audio in real-time. The higher a frequency bar gets, the brighter the corresponding LED segment on the live preview strip will illuminate.

### The Live Preview Strip
Located horizontally across the bottom of the Control page. **If this strip is animating, the system is working perfectly.** Whatever is displayed here is exactly what is being sent to the WLED hardware or Emulator.

---

## 🗺️ Pixel Mapper

The real world comes with constraints—your LED strips aren't just one long straight line; they are broken up into distinct tubes or frames.

In the Mapper:
1. Drag the digital tubes to match how they are physically laid out in the room.
2. Select a tube and update its **Start Index** and **LED count**.
3. All changes auto-save local to your browser!

*Note: Future updates will enable the Driver to reshape effects based on these spatial positions, but currently it's for keeping track of your indices.*

---

## 💾 Presets

Presets save your favorite configurations so you don't have to keep dialing them in.

1. Once you have an effect you like, head to the **Presets** page.
2. Type a name and click **Save**.
3. The preset will be added to the list. You can trigger it by clicking the '▶' icon on the preset row.
4. **Syncing**: Because browser data can be reset, click **Export JSON** to download your presets. Store these in the `/firmware/presets.json` file inside the repository so they are immortalized in git!

---

## 🛠️ The Terminal Drawer

Notice the `↑ Open Terminal` button hovering at the very bottom right of the Studio? Click it at any time to pull up the raw WebSocket log.

- **Purpose**: It displays the raw JSON communication between the Studio and the Driver. If something isn't working, check the terminal for `error` logs.
- **Sending Commands**: You can type manual JSON commands into the input bar. For example, to ping the driver, type: `{"type":"PING"}` and hit Send.
- **Clean Interface**: It specifically hides `PIXEL_FRAME` messages to prevent flooding your console, making it easy to identify state changes.

---

## 🚑 Troubleshooting

**"I told it to listen to Audio, but the lights aren't doing anything!"**
Make sure:
1. You selected the correct microphone/interface in the Audio tab dropdown.
2. The Gain slider isn't turned all the way down.
3. You didn't switch to the Effects tab afterward (switching to Effects will auto-stop Audio).
4. Look at the **Live Preview Strip**—is it moving? If yes, but your *physical* lights aren't moving, verify your `WLED_IP` in `.env` matches your QuinLED's true Wi-Fi IP address.

**"My CPU utilization is massive"**
On the Control page, check the dropdown next to "Target FPS" above the Live Preview Strip. Bring it down from `60 FPS` to `30 FPS`. Audio FFT polling is lightweight, but transferring byte arrays 60 times a second drains battery. 30 FPS is usually sufficient for standard smooth visuals.
