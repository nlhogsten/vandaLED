# VandaLED: DIY Assembly & Setup Guide

Welcome to the **vandaLED** build! This guide will take you from a box of electronics to a professional-grade, audio-reactive LED installation. We prioritize a "premium-industrial" aesthetic over a "hacker-prototype" look.

---

## 🛒 Bill of Materials (BOM)

| Component | Recommendation | Purpose | Purchase Link |
|---|---|---|---|
| **LED Controller** | QuinLED-Dig-Uno v3 | ESP32-based brain with power/data protection | [QuinLED Shop](https://quinled.info/pre-assembled-quinled-dig-uno/) |
| **LED Strip** | WS2815 12V (60 LED/m) | 12V Addressable RGB with backup data line | [Amazon / BTF-Lighting](https://www.amazon.com/BTF-LIGHTING-WS2815-Addressable-Flexible-Waterproof/dp/B07LG6X95K) |
| **Power Supply** | 12V 10A DC Brick | Steady juice for the whole rig | [Amazon / ALITOVE](https://www.amazon.com/ALITOVE-100V-240V-Transformer-Adapter-Converter/dp/B01GEA8PQA) |
| **Neon Tubing** | 16mm Silicone Flex | Diffuses individual LEDs into a "solid" glow | [Amazon / BTF-Lighting](https://www.amazon.com/BTF-LIGHTING-Silicone-Flexible-Waterproof-Internal/dp/B08M9M3WRS) |
| **Audio ADC** | PCM1808 Breakout | High-quality analog-to-digital audio conversion | [Amazon / Generic](https://www.amazon.com/HiLetgo-PCM1808-Single-Ended-Analog-Digital/dp/B07R9V7K1H) |
| **Connectors** | 3-pin Waterproof Pigtails | Makes the tubes removable and weatherproof | [Amazon / BTF-Lighting](https://www.amazon.com/BTF-LIGHTING-Plugs-Connectors-Outdoor-Version/dp/B01LCV8PUW) |
| **Enclosure** | ABS Project Box (IP65) | Professional housing for the brain | [Amazon / Generic](https://www.amazon.com/Diymore-Waterproof-Plastic-Enclosure-115x90x55mm/dp/B0828TBNR8) |
| **Frost Spray** | Rust-Oleum Frosted Glass | Adds that "industrial-neon" grain/texture | [Home Depot](https://www.homedepot.com/p/Rust-Oleum-Specialty-11-oz-Frosted-Glass-Clear-Spray-Paint-342555/307404859) |
| **Barrel Jack** | 5.5mm x 2.1mm Mount | Clean power input for the box | [Amazon / Generic](https://www.amazon.com/CenryKay-5-5mm-2-1mm-Socket-Connectors/dp/B07C6143YL) |
| **Audio Jack** | 3.5mm Stereo Panel Mount | Direct line-in for DJ controllers | [Amazon / Generic](https://www.amazon.com/Tcenzen-Replacement-Jack-Stereo-Solder-3-5mm/dp/B08XLP8TNV) |
| **M2 Screws** | M2 Self-Tapping Assortment | For the "Set-Screw" reversible lock method | [Amazon](https://www.amazon.com/M2-Self-Tapping-Screws-Assortment-Kit/dp/B08HMRM8V9) |
| **Zip-Ties** | 4-inch Clear (Thin) | For the "Friction Lock" reversible method | [Amazon](https://www.amazon.com/TR-Industrial-TR88302-Multi-Purpose-Cable/dp/B00S0TXLH4) |
| **Heat-Shrink** | Clear (Non-Adhesive) | For the "Clean-Look" reversible seal | [Amazon](https://www.amazon.com/Glarks-127Pcs-Electrical-Insulation-Tubing/dp/B073R66XWM) |

---

## 🛠 Phase 1: Physical Assembly

### 1. The "Neon" Tubes
1. **Texture**: Lightly spray the exterior of the silicone tubing with the **Frosted Glass Spray**. Hold the can 30cm away and use short bursts. *Don't aim for perfection; a slightly uneven texture looks more organic (and expensive).*
2. **Insertion**: Slide your WS2815 strip into the tube. If it snags, tie a piece of dental floss to a small weight (like a nut), drop it through the tube, then pull the LED strip through using the floss.
3. **Pigtails**: Solder a **3-pin waterproof pigtail** (female side) to the input end of the LED strip. Match the colors consistently:
   - **RED**: +12V
   - **WHITE**: Data (DAT)
   - **BLACK**: Ground (GND)

### 2. Sealing: Permanent vs. Reversible
Depending on whether you want a "set-and-forget" build or a "prototyping" build, choose your sealing method:

#### Option A: Permanent (Best for Weatherproofing)
Apply a bead of **clear silicone sealant** inside the end cap. Push the cap onto the tube and let it cure for 24 hours. This is the most professional-looking and durable method.

#### Option B: Reversible (Best for Maintenance/Modding)
If you want to be able to pull the LED strip back out later for repairs or upgrades without cutting the tube, use this "Mechanical Lock" method:
1. **The Set-Screw Hack**: Slide the end cap onto the tube. Use a tiny drill bit (or a heated needle) to poke a pilot hole through the side of the cap *and* the silicone tube. Drive a tiny **M2 self-tapping screw** into the hole. The screw will bite into the silicone and lock the cap in place.
2. **The Zip-Tie Method**: If you don't want to use screws, you can use a small, thin **clear zip-tie** around the base of the end cap where it meets the tube. Tighten it firmly to create a friction lock.
3. **Clear Heat-Shrink**: Slide a 2-inch piece of **clear heat-shrink tubing** over the joint between the cap and the tube. Shrink it with a heat gun. To remove it later, simply slice it off with a hobby knife.

### 3. The Controller Box
1. **Layout**: Place the **QuinLED-Dig-Uno** inside the ABS box. Mark the holes for mounting screws and external ports.
2. **Drilling**: Use a step-drill bit to create clean holes for the **DC Barrel Jack**, the **3.5mm Audio Jack**, and the **LED Output Pigtail**.
3. **Audio Wiring**: Wire the PCM1808 to the QuinLED's GPIO headers:
   - **VDD** → 3.3V
   - **GND** → GND
   - **DOUT** → GPIO 2
   - **LRCK** → GPIO 12
   - **BCK** → GPIO 15
   - Wire the 3.5mm jack's L/R channels to the PCM1808 analog inputs.
4. **Mounting**: Secure the QuinLED using M3 plastic standoffs to avoid electrical shorts against the case.

---

## 💻 Phase 2: Software Installation

### 1. Flashing the Brain (WLED)
1. Plug the QuinLED into your laptop via USB-C.
2. Go to [install.wled.me](https://install.wled.me) in Chrome/Edge.
3. Click **Install** and select the port. Choose the latest stable release.
4. Once flashed, connect to the `WLED-AP` Wi-Fi and follow the on-screen prompts to connect it to your home/studio Wi-Fi.

### 2. Setting Up the Monorepo
1. **Clone & Install**:
   ```bash
   git clone https://github.com/yourusername/vandaLED.git
   cd vandaLED
   bun install  # We use Bun for high-performance WebSocket handling
   ```
2. **Environment**: Create a `.env` file in `apps/driver`:
   ```env
   WLED_IP=192.168.1.XX  # Your controller's local IP
   PORT=3000
   ```

### 3. Launching the Studio
1. Run the development environment:
   ```bash
   bun run dev
   ```
2. Open [http://localhost:5173](http://localhost:5173) (Studio) and [http://localhost:5174](http://localhost:5174) (Emulator).

---

## 🚦 Phase 3: Integration & Testing

### 1. WLED Calibration
Go to the WLED Web UI (`http://192.168.1.XX`) and configure:
- **LED Preferences**:
  - LED Type: `WS281x`
  - Color Order: `RGB` (or `GRB`, test with a solid color)
  - LED Count: Enter your total pixel count (e.g., 300 for a 5m reel).
- **Sound Settings**:
  - Input: `Generic I2S`
  - Pins: Matching Phase 1 (SD=2, WS=12, SCK=15).

### 2. DDP Connection
VandaLED uses the **DDP (Distributed Display Protocol)** for high-frame-rate streaming.
1. In WLED, ensure **Sync Interfaces > DDP** is checked.
2. In the VandaLED Studio, select a patch and hit **Play**.
3. Your physical hardware should now mirror the Emulator with < 20ms latency.

---

## 💡 Pro-Tips for a Premium Finish
- **Enclosure Styling**: Rub the ABS box with a high-grit sandpaper for a matte finish, or slap a custom "VandaLED" vinyl decal on the front.
- **Cable Management**: Use braided PET cable sleeving for the pigtail runs to give it a professional "cable-mod" look.
- **Mounting**: Use heavy-duty magnetic mounts for the controller box so you can snap it to metal trusses or DJ booths.
