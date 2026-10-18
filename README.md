# AuraEQ — Google Home & Wireless Speaker Custom Equalizer Studio

AuraEQ is a web application and DSP tuning software engineered for custom equalizer adjustments on Google Home / Nest Audio devices, wireless smart speakers, and DIY audio hardware (Raspberry Pi CamillaDSP, ESP32 smart soundbars).

---

##  How Google Home Equalizer Works Under the Hood

### 1. The Cast Eureka Setup API
Google Home, Google Nest Mini, Nest Audio, and Nest Hub devices run a local HTTP daemon on **port 8008** (and HTTPS on port 8443). The official equalizer settings are managed by the `set_eureka_info` endpoint:

- **Target URL:** `http://<SPEAKER_IP>:8008/setup/set_eureka_info`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Limits:** `-6.0 dB` to `+6.0 dB` (in 0.5 dB increments)

#### Example Payload:
```json
{
  "settings": {
    "system": {
      "audio_eq": {
        "bass": 2.5,
        "treble": -1.0
      }
    }
  }
}
```

### 2. Python `pychromecast` Integration
For automated network control without using the mobile app:
```python
import pychromecast

# Connect by friendly name
chromecasts, browser = pychromecast.get_listed_chromecasts(friendly_names=["Living Room Nest Audio"])
cast = chromecasts[0]
cast.wait()

# Send EQ adjustment directly
cast.set_equalizer(bass=2.5, treble=-1.0)
```

---

##  Features

- **Google Home 2-Band Mode:** Tactile radial rotary dials for Bass & Treble with `-6.0 dB` to `+6.0 dB` range matching the Google Home app.
- **10-Band Studio Graphic EQ:** Pro Biquad peaking filters across standard ISO octave frequencies (31Hz, 63Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz) with $\pm12\text{ dB}$ control.
- **Room Acoustic Boundary Compensation:** Boundary calibration for *Free-standing*, *Near Wall* (+3dB reflection compensation), *In Corner* (-4.5dB low-shelf resonance filter), and *Bookshelf* enclosures.
- **DSP Enhancements:**
  - **Dialogue & Vocal Boost:** 3.0 kHz peaking filter for speech and podcasts.
  - **Dynamic Loudness Bass:** Fletcher-Munson equal-loudness curve compensation for low-volume punch.
  - **Night Mode Compressor:** Dynamic range compression to tame explosive loud spikes while keeping dialogue intelligible.
  - **Stereo Balance:** Smooth Left / Right stereo pan control.
- **Live Real-Time Audio Engine:**
  - Built-in procedural synthesis tracks (*Funk Bass & Drum Groove*, *80s Synthwave*, *Acoustic Warmth*).
  - Acoustic calibration test tones (*Pink Noise*, *Logarithmic 20Hz-20kHz Sine Sweep*).
  - Custom file loader: Drag & drop your own MP3/WAV/FLAC audio to audition filters in real time.
- **Dual Visualizer:** Real-time 60 FPS 1024-bin FFT spectrum bars overlaid with the exact mathematical Biquad filter frequency transfer curve $H(s)$.
- **Multi-Device Manager & Network Push:**
  - Scan local network for Google Cast / Nest speakers.
  - Add custom smart speakers by IP & Port.
  - Live telemetry log showing outbound HTTP/WebSocket requests and response codes.
- **Export Formats:** One-click generation of cURL commands, Google Cast JSON, Python scripts, and CamillaDSP YAML configs.

---

##  Project Architecture & Clean File Structure

```
wirelesseq/
├── index.html                   # Entry HTML with Plus Jakarta Sans & JetBrains Mono
├── package.json                 # Dependencies & build scripts (Vite, React, Lucide)
├── vite.config.js               # Fast Vite configuration
├── README.md                    # Project documentation & API guide
└── src/
    ├── main.jsx                 # React root bootstrap
    ├── App.jsx                  # Main application controller & layout
    ├── index.css                # Global stylesheet entry
    ├── audio/
    │   └── AudioEngine.js       # Web Audio API engine (Biquads, compressor, procedural synth)
    ├── services/
    │   ├── deviceService.js     # Cast Eureka discovery, device list & network telemetry
    │   ├── presetService.js     # Factory presets & localStorage custom profiles
    │   └── exportService.js     # Code generators for cURL, Python, CamillaDSP, and JSON
    ├── components/
    │   ├── Header.jsx           # Top navigation bar with active device, bypass, preset & export triggers
    │   ├── VisualizerCanvas.jsx # 60FPS dual-layer FFT spectrum and frequency curve renderer
    │   ├── DeviceModal.jsx      # Cast speaker discovery & custom IP management modal
    │   ├── PresetManager.jsx    # Sound profile library & custom preset saving
    │   ├── DevIntegrationModal.jsx # Code export & network push dialog
    │   ├── NetworkTelemetry.jsx # Real-time outbound HTTP telemetry console
    │   ├── AcousticSettings.jsx # Room placement calibration & DSP switches
    │   ├── AudioPlayerBar.jsx   # Bottom floating playback dock with volume & track loader
    │   └── EqModes/
    │       ├── ClassicDials.jsx # Google Home 2-dial rotary interface
    │       └── StudioGraphic.jsx# 10-band vertical fader equalizer
    └── styles/
        ├── tokens.css           # CSS design variables (colors, glows, glassmorphism, radii)
        └── components.css       # Clean modular styling for knobs, faders, dock, and modals
```

---

##  Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in your browser
http://localhost:5173
```
