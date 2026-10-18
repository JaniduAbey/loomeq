import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  SlidersHorizontal,
  Home,
  Activity,
  Layers,
  Sparkles,
  HelpCircle,
  Radio,
  Check,
} from 'lucide-react';
import { Header } from './components/Header';
import { VisualizerCanvas } from './components/VisualizerCanvas';
import { ClassicDials } from './components/EqModes/ClassicDials';
import { StudioGraphic } from './components/EqModes/StudioGraphic';
import { AcousticSettings } from './components/AcousticSettings';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { DeviceModal } from './components/DeviceModal';
import { PresetManager } from './components/PresetManager';
import { DevIntegrationModal } from './components/DevIntegrationModal';
import { NetworkTelemetry } from './components/NetworkTelemetry';
import { MeterBridge } from './components/MeterBridge';
import { audioEngine, STANDARD_FREQUENCIES_10 } from './audio/AudioEngine';
import { deviceService } from './services/deviceService';
import { presetService, FACTORY_PRESETS } from './services/presetService';

export function App() {
  // Navigation tabs: 'classic' | 'graphic' | 'acoustic' | 'guide'
  const [activeTab, setActiveTab] = useState('classic');

  // EQ states
  const [bass, setBass] = useState(1.5);
  const [treble, setTreble] = useState(1.0);
  const [bands10, setBands10] = useState([1.5, 1.5, 1.0, 0.5, 0, 0, 0.5, 1.0, 1.2, 0.8]);
  const [isBypassed, setIsBypassed] = useState(false);
  const [eqVersion, setEqVersion] = useState(0);

  // Acoustic & DSP states
  const [roomPlacement, setRoomPlacement] = useState('free');
  const [dialogueBoost, setDialogueBoost] = useState(false);
  const [dynamicBass, setDynamicBass] = useState(true);
  const [nightMode, setNightMode] = useState(false);
  const [stereoBalance, setStereoBalance] = useState(0);

  // Studio Console Rack & Visualizer Customization states
  const [tubeDrive, setTubeDrive] = useState(0);
  const [stereoWidth, setStereoWidth] = useState(1.0);
  const [isAutoGain, setIsAutoGain] = useState(true);
  const [visualizerTheme, setVisualizerTheme] = useState('cyber');

  // Device & Presets
  const [activeDevice, setActiveDevice] = useState(deviceService.getActiveDevice());
  const [activePreset, setActivePreset] = useState(FACTORY_PRESETS[1]); // Google Nest signature warm

  // Modals
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Sync with deviceService when real devices are discovered
  useEffect(() => {
    const unsub = deviceService.subscribe(() => {
      const dev = deviceService.getActiveDevice();
      setActiveDevice(dev);

      // If device has real hardware EQ reported, sync it
      if (dev.currentEq && (dev.currentEq.bass !== undefined || dev.currentEq.treble !== undefined)) {
        const b = dev.currentEq.bass ?? 0;
        const t = dev.currentEq.treble ?? 0;
        setBass(b);
        setTreble(t);
        audioEngine.setGoogleHome2Band(b, t);
        setEqVersion((v) => v + 1);
      }
    });
    return unsub;
  }, []);

  // Initialize AudioEngine on first load
  useEffect(() => {
    audioEngine.init();
    audioEngine.setGoogleHome2Band(bass, treble);
    audioEngine.setRoomPlacement(roomPlacement);
    audioEngine.setDialogueBoost(dialogueBoost);
    audioEngine.setDynamicBass(dynamicBass);
    audioEngine.setNightMode(nightMode);
    audioEngine.setStereoBalance(stereoBalance);
  }, []);

  // Update Google Home 2-Band
  const handleBassChange = (newBass) => {
    setBass(newBass);
    audioEngine.setGoogleHome2Band(newBass, treble);
    setEqVersion((v) => v + 1);
    deviceService.pushEqSettings(activeDevice, {
      bass: newBass,
      treble,
      bands: bands10,
      roomPlacement,
      nightMode,
    });
  };

  const handleTrebleChange = (newTreble) => {
    setTreble(newTreble);
    audioEngine.setGoogleHome2Band(bass, newTreble);
    setEqVersion((v) => v + 1);
    deviceService.pushEqSettings(activeDevice, {
      bass,
      treble: newTreble,
      bands: bands10,
      roomPlacement,
      nightMode,
    });
  };

  // Update 10-Band Graphic EQ
  const handleBandChange = (index, gain) => {
    const updated = [...bands10];
    updated[index] = gain;
    setBands10(updated);
    audioEngine.setBandGain(index, gain);
    setEqVersion((v) => v + 1);
    deviceService.pushEqSettings(activeDevice, {
      bass,
      treble,
      bands: updated,
      roomPlacement,
      nightMode,
    });
  };

  const handleResetBands = () => {
    const flat = new Array(10).fill(0);
    setBands10(flat);
    audioEngine.setAllBands(flat);
    setEqVersion((v) => v + 1);
  };

  // Acoustic Controls
  const handleRoomPlacementChange = (placement) => {
    setRoomPlacement(placement);
    audioEngine.setRoomPlacement(placement);
    setEqVersion((v) => v + 1);
    deviceService.log(`Calibrated room acoustic model: ${placement.toUpperCase()} boundary.`);
  };

  const handleToggleDialogue = (enabled) => {
    setDialogueBoost(enabled);
    audioEngine.setDialogueBoost(enabled);
    setEqVersion((v) => v + 1);
    deviceService.log(`Dialogue / vocal presence filter: ${enabled ? 'ENGAGED' : 'OFF'}`);
  };

  const handleToggleDynamicBass = (enabled) => {
    setDynamicBass(enabled);
    audioEngine.setDynamicBass(enabled);
    setEqVersion((v) => v + 1);
    deviceService.log(`Dynamic loudness bass boost: ${enabled ? 'ENGAGED' : 'OFF'}`);
  };

  const handleToggleNightMode = (enabled) => {
    setNightMode(enabled);
    audioEngine.setNightMode(enabled);
    setEqVersion((v) => v + 1);
    deviceService.log(`Night Mode (Dynamic compressor): ${enabled ? 'ACTIVE' : 'OFF'}`);
  };

  const handleStereoBalanceChange = (bal) => {
    setStereoBalance(bal);
    audioEngine.setStereoBalance(bal);
  };

  // A/B Bypass
  const handleToggleBypass = () => {
    const nextBypass = !isBypassed;
    setIsBypassed(nextBypass);
    audioEngine.setBypass(nextBypass);
    setEqVersion((v) => v + 1);
  };

  // Apply Preset
  const handleApplyPreset = (preset) => {
    setActivePreset(preset);
    setBass(preset.bass);
    setTreble(preset.treble);
    if (preset.bands10) {
      setBands10(preset.bands10);
      audioEngine.setAllBands(preset.bands10);
    } else {
      audioEngine.setGoogleHome2Band(preset.bass, preset.treble);
    }

    if (preset.acoustic) {
      setRoomPlacement(preset.acoustic.roomPlacement || 'free');
      audioEngine.setRoomPlacement(preset.acoustic.roomPlacement || 'free');
      setDialogueBoost(preset.acoustic.dialogueBoost || false);
      audioEngine.setDialogueBoost(preset.acoustic.dialogueBoost || false);
      setDynamicBass(preset.acoustic.dynamicBass ?? true);
      audioEngine.setDynamicBass(preset.acoustic.dynamicBass ?? true);
      setNightMode(preset.acoustic.nightMode || false);
      audioEngine.setNightMode(preset.acoustic.nightMode || false);
    }

    setEqVersion((v) => v + 1);
    deviceService.pushEqSettings(activeDevice, {
      bass: preset.bass,
      treble: preset.treble,
      bands: preset.bands10,
    });
    deviceService.log(`Applied preset profile: "${preset.name}"`);
  };

  const handleSelectDevice = (device) => {
    setActiveDevice(device);
    deviceService.setActiveDevice(device.id);
    setIsDeviceConnected(true);
  };

  const [isDeviceConnected, setIsDeviceConnected] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeakerStreaming, setIsSpeakerStreaming] = useState(false);

  // Connect to physical Google Home speaker
  const handleConnectSpeaker = async () => {
    setIsConnecting(true);
    const ok = await deviceService.connectSpeaker(activeDevice);
    setIsConnecting(false);
    if (ok) {
      setIsDeviceConnected(true);
      audioEngine.playLocalConnectChime();
    }
  };

  // Play connect chime on physical Google Home speaker & local browser
  const handlePlayChime = async () => {
    audioEngine.playLocalConnectChime();
    await deviceService.playSpeakerChime(activeDevice);
  };

  // Cast live DSP audio stream (captured tab or player track) to physical speaker
  const handleCastToSpeaker = async () => {
    setIsSpeakerStreaming(true);
    audioEngine.setLiveSpeakerStreaming(true);
    await deviceService.castLiveTabStreamToSpeaker(activeDevice);
  };

  // Disconnect from speaker and stop playback
  const handleDisconnectSpeaker = async () => {
    setIsSpeakerStreaming(false);
    audioEngine.setLiveSpeakerStreaming(false);
    await deviceService.disconnectSpeaker(activeDevice);
    setIsDeviceConnected(false);
  };

  // Stop streaming to speaker
  const handleStopCast = async () => {
    setIsSpeakerStreaming(false);
    audioEngine.setLiveSpeakerStreaming(false);
    await deviceService.disconnectSpeaker(activeDevice);
  };

  const currentEqState = {
    bass,
    treble,
    bands10,
    roomPlacement,
    dialogueBoost,
    dynamicBass,
    nightMode,
    tubeDrive,
    stereoWidth,
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <Header
        activeDevice={activeDevice}
        isDeviceConnected={isDeviceConnected}
        isConnecting={isConnecting}
        onConnect={handleConnectSpeaker}
        onDisconnect={handleDisconnectSpeaker}
        onOpenDeviceModal={() => setIsDeviceModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        isBypassed={isBypassed}
        onToggleBypass={handleToggleBypass}
        activePreset={activePreset}
        onOpenPresetModal={() => setIsPresetModalOpen(true)}
        onPlayChime={handlePlayChime}
      />

      {/* Tabs Bar */}
      <nav className="eq-tabs-bar" aria-label="Equalizer Modes">
        <div className="tab-group">
          <button
            className={`tab-btn ${activeTab === 'classic' ? 'active' : ''}`}
            onClick={() => setActiveTab('classic')}
          >
            <Radio size={16} />
            <span>Google Home (2-Band)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'graphic' ? 'active' : ''}`}
            onClick={() => setActiveTab('graphic')}
          >
            <SlidersHorizontal size={16} />
            <span>Studio Graphic EQ (10-Band)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'acoustic' ? 'active' : ''}`}
            onClick={() => setActiveTab('acoustic')}
          >
            <Home size={16} />
            <span>Room Acoustic & DSP</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveTab('guide')}
          >
            <HelpCircle size={16} />
            <span>Implementation Guide</span>
          </button>
        </div>

        <div className="tab-preset-summary">
          <span>Active Profile:</span>
          <span className="preset-chip">{activePreset ? activePreset.name : 'Custom'}</span>
        </div>
      </nav>

      {/* Main Studio Grid */}
      <main className="main-layout">
        {/* Left / Center Column: Visualizer & Active EQ Mode */}
        <div className="center-column">
          {/* Real-time Spectrum & Frequency Response Curve */}
          <div className="studio-card" style={{ padding: '16px' }}>
            <div className="card-header" style={{ marginBottom: '12px' }}>
              <div className="card-title-group">
                <Activity size={17} className="card-title-icon" />
                <h2 className="card-title">Real-Time DSP Response & Audio Spectrum</h2>
              </div>
              <span className="card-hint">Calculated Biquad Transfer Function H(s) + Live 1024-FFT</span>
            </div>
            <VisualizerCanvas
              eqVersion={eqVersion}
              bass={bass}
              treble={treble}
              onChangeBass={handleBassChange}
              onChangeTreble={handleTrebleChange}
              activeTheme={visualizerTheme}
              onThemeChange={setVisualizerTheme}
            />
          </div>

          {/* Mode View: Classic Google Home 2-Band */}
          {activeTab === 'classic' && (
            <div className="studio-card">
              <div className="card-header">
                <div className="card-title-group">
                  <Sliders size={18} className="card-title-icon" />
                  <h2 className="card-title">Google Home Custom Equalizer Controls</h2>
                </div>
                <span className="card-hint">Official Google Home App Calibration (-6 dB to +6 dB)</span>
              </div>
              <ClassicDials
                bass={bass}
                treble={treble}
                onChangeBass={handleBassChange}
                onChangeTreble={handleTrebleChange}
                tubeDrive={tubeDrive}
                onChangeTubeDrive={(val) => {
                  setTubeDrive(val);
                  setEqVersion((v) => v + 1);
                }}
                stereoWidth={stereoWidth}
                onChangeStereoWidth={(val) => {
                  setStereoWidth(val);
                  setEqVersion((v) => v + 1);
                }}
                isAutoGain={isAutoGain}
                onToggleAutoGain={(val) => {
                  setIsAutoGain(val);
                  setEqVersion((v) => v + 1);
                }}
                dynamicBass={dynamicBass}
                onToggleDynamicBass={handleToggleDynamicBass}
                dialogueBoost={dialogueBoost}
                onToggleDialogueBoost={handleToggleDialogue}
                nightMode={nightMode}
                onToggleNightMode={handleToggleNightMode}
              />
            </div>
          )}

          {/* Mode View: Studio Graphic 10-Band */}
          {activeTab === 'graphic' && (
            <div className="studio-card">
              <div className="card-header">
                <div className="card-title-group">
                  <SlidersHorizontal size={18} className="card-title-icon" />
                  <h2 className="card-title">10-Band Precision Graphic Equalizer</h2>
                </div>
                <span className="card-hint">Pro Biquad Peaking Filters (31 Hz – 16 kHz)</span>
              </div>
              <StudioGraphic
                bands10={bands10}
                onChangeBand={handleBandChange}
                onResetAll={handleResetBands}
              />
            </div>
          )}

          {/* Mode View: Room Acoustic & Enhancements */}
          {activeTab === 'acoustic' && (
            <div className="studio-card">
              <div className="card-header">
                <div className="card-title-group">
                  <Home size={18} className="card-title-icon" />
                  <h2 className="card-title">Smart Acoustic & Environmental Tuning</h2>
                </div>
                <span className="card-hint">Boundary Reflections, Dialogue Clarity & Compression</span>
              </div>
              <AcousticSettings
                roomPlacement={roomPlacement}
                onChangeRoomPlacement={handleRoomPlacementChange}
                dialogueBoost={dialogueBoost}
                onToggleDialogueBoost={handleToggleDialogue}
                dynamicBass={dynamicBass}
                onToggleDynamicBass={handleToggleDynamicBass}
                nightMode={nightMode}
                onToggleNightMode={handleToggleNightMode}
                stereoBalance={stereoBalance}
                onChangeStereoBalance={handleStereoBalanceChange}
              />
            </div>
          )}

          {/* Mode View: Architecture & Implementation Guide */}
          {activeTab === 'guide' && (
            <div className="studio-card">
              <div className="card-header">
                <div className="card-title-group">
                  <HelpCircle size={18} className="card-title-icon" />
                  <h2 className="card-title">How to Implement Google Home & Smart Speaker EQ</h2>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.82rem', lineHeight: '1.6', color: '#cbd5e1' }}>
                <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#818cf8', marginBottom: '6px' }}>
                    1. Google Cast Local Eureka API
                  </h3>
                  <p>
                    All Google Home, Nest Mini, Nest Audio, and Chromecast built-in devices run a local HTTP server on <strong>port 8008</strong> (or HTTPS on port 8443).
                    The equalizer settings can be changed with a standard HTTP POST request to:
                  </p>
                  <pre className="code-box" style={{ marginTop: '8px' }}>
POST http://&lt;DEVICE_IP&gt;:8008/setup/set_eureka_info
Content-Type: application/json

&#123;
  "settings": &#123;
    "system": &#123;
      "audio_eq": &#123;
        "bass": 2.0,    // -6.0 to +6.0 dB
        "treble": -1.0   // -6.0 to +6.0 dB
      &#125;
    &#125;
  &#125;
&#125;
                  </pre>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#06b6d4', marginBottom: '6px' }}>
                    2. Finding Your Google Home's Local IP Address
                  </h3>
                  <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <li>Open the official <strong>Google Home app</strong> on your phone.</li>
                    <li>Tap on your speaker (e.g. <em>Living Room Nest Audio</em>).</li>
                    <li>Tap the <strong>Settings gear icon</strong> in the top right corner.</li>
                    <li>Select <strong>Device Information</strong>.</li>
                    <li>Note the <strong>IP address</strong> (e.g., <code>192.168.1.42</code>). Enter this IP in AuraEQ's Device Modal!</li>
                  </ol>
                </div>

                <div style={{ background: 'var(--bg-surface-elevated)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h3 style={{ fontSize: '0.95rem', color: '#10b981', marginBottom: '6px' }}>
                    3. For DIY Smart Speakers (Raspberry Pi / ESP32)
                  </h3>
                  <p>
                    For custom speakers running CamillaDSP, PipeWire, or ESPHome, AuraEQ exports standard Biquad filter transfer functions.
                    Click the <strong>Cast / API Export</strong> button in the top header to copy CamillaDSP YAML or run our Python script.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Acoustics Overview, Stereo Meter Bridge & Live Network Telemetry */}
        <div className="side-column">
          {/* Dual Channel 20-Segment Stereo LED Meter Bridge */}
          <MeterBridge />

          {/* Quick Room Acoustic Card (if not already in acoustic tab) */}
          {activeTab !== 'acoustic' && (
            <div className="studio-card">
              <div className="card-header" style={{ marginBottom: '10px' }}>
                <div className="card-title-group">
                  <Home size={16} className="card-title-icon" />
                  <h3 className="card-title">Room Placement</h3>
                </div>
                <button
                  className="btn-outline"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={() => setActiveTab('acoustic')}
                >
                  Configure
                </button>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Active profile: <strong style={{ color: '#fff' }}>{roomPlacement.toUpperCase()}</strong>
              </div>

              <div className="room-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {['free', 'wall', 'corner', 'bookshelf'].map((id) => (
                  <button
                    key={id}
                    className={`room-card ${roomPlacement === id ? 'active' : ''}`}
                    onClick={() => handleRoomPlacementChange(id)}
                    style={{ padding: '8px 10px' }}
                  >
                    <span className="room-card-title" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                      {id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Device Telemetry Log */}
          <NetworkTelemetry
            activeDevice={activeDevice}
            eqState={currentEqState}
            isDeviceConnected={isDeviceConnected}
          />
        </div>
      </main>

      {/* Floating Audio Player & Test Dock */}
      <AudioPlayerBar
        isBypassed={isBypassed}
        onToggleBypass={handleToggleBypass}
        onCastToSpeaker={handleCastToSpeaker}
        isSpeakerStreaming={isSpeakerStreaming}
        onStopCast={handleStopCast}
        isDeviceConnected={isDeviceConnected}
        onConnectSpeaker={handleConnectSpeaker}
        activeDevice={activeDevice}
      />

      {/* Modals */}
      <DeviceModal
        isOpen={isDeviceModalOpen}
        onClose={() => setIsDeviceModalOpen(false)}
        activeDevice={activeDevice}
        onSelectDevice={handleSelectDevice}
      />

      <PresetManager
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        activePresetId={activePreset?.id}
        onApplyPreset={handleApplyPreset}
        currentEqState={currentEqState}
      />

      <DevIntegrationModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeDevice={activeDevice}
        eqState={currentEqState}
      />
    </div>
  );
}
export default App;
