import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Disc,
  Activity,
  Layers,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

const BUILT_IN_TRACKS = [
  { id: 'funk_bass', name: 'Funk Bass & Drum Groove', artist: 'Procedural Synth DSP', type: 'Music' },
  { id: 'synthwave', name: 'Retro 80s Synthwave Lead', artist: 'Procedural Synth DSP', type: 'Music' },
  { id: 'acoustic_vocal', name: 'Acoustic Warmth & Vocal Resonator', artist: 'Acoustic Synthesizer', type: 'Acoustic' },
  { id: 'pink_noise', name: 'Pink Noise (Room Acoustic Calibrator)', artist: 'Linear Pink Generator', type: 'Calibration' },
  { id: 'sine_sweep', name: 'Logarithmic Sine Sweep (20Hz - 20kHz)', artist: 'Acoustic Sweep Generator', type: 'Calibration' },
];

export function AudioPlayerBar({
  isBypassed,
  onToggleBypass,
  onCastToSpeaker,
  isSpeakerStreaming,
  onStopCast,
  isDeviceConnected = true,
  onConnectSpeaker,
  activeDevice,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackId, setCurrentTrackId] = useState('funk_bass');
  const [volume, setVolume] = useState(0.85);
  const [customFileName, setCustomFileName] = useState(null);
  const [isHeadsetMuted, setIsHeadsetMuted] = useState(audioEngine.isHeadsetMuted ?? false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const unsub = audioEngine.subscribeStateChange((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTrackId(state.currentTrackId);
      if (state.isHeadsetMuted !== undefined) {
        setIsHeadsetMuted(state.isHeadsetMuted);
      }
    });
    return unsub;
  }, []);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      audioEngine.pause();
    } else {
      await audioEngine.playTrack(currentTrackId);
    }
  };

  const handleTrackChange = async (e) => {
    const trackId = e.target.value;
    setCurrentTrackId(trackId);
    if (trackId !== 'custom_file') {
      setCustomFileName(null);
    }
    if (isPlaying) {
      await audioEngine.playTrack(trackId);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCustomFileName(file.name);
    setCurrentTrackId('custom_file');
    await audioEngine.playTrack('custom_file', file);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioEngine.setMasterVolume(val);
  };

  const handleToggleHeadsetMonitor = () => {
    const unmuted = audioEngine.toggleHeadsetMonitor();
    setIsHeadsetMuted(!unmuted);
  };

  const currentTrackObj = BUILT_IN_TRACKS.find((t) => t.id === currentTrackId) || {
    id: 'custom_file',
    name: customFileName || 'Custom Audio File',
    artist: 'User Upload',
  };

  return (
    <div className="audio-player-dock">
      <div className="player-content">
        {/* Track Info */}
        <div className="player-track-info">
          <div className="player-track-icon">
            {isPlaying ? (
              <Activity size={22} className="animate-spin" style={{ animationDuration: '3s' }} />
            ) : (
              <Disc size={22} />
            )}
          </div>
          <div className="track-names">
            <span className="track-title">{currentTrackObj.name}</span>
            <span className="track-artist">
              {currentTrackId === 'captured_tab' ? (
                <span style={{ color: '#67e8f9', fontWeight: 600 }}>
                  Live Tab / System Audio (Zero Headset Echo)
                </span>
              ) : (
                currentTrackObj.artist
              )}
            </span>
          </div>
        </div>

        {/* Center Controls: Play, Track Selector, Upload, Tab Capture & Cast */}
        <div className="player-controls">
          <button
            className="btn-play-pause"
            onClick={handleTogglePlay}
            title={isPlaying ? 'Pause Audio' : 'Play Audio DSP Test'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: 2 }} />}
          </button>

          <select
            className="track-select-dropdown"
            value={currentTrackId}
            onChange={handleTrackChange}
            title="Select built-in audio test signal or track"
          >
            <optgroup label="Musical Test Tracks">
              <option value="funk_bass">Funk Bass & Drum Groove</option>
              <option value="synthwave">Retro 80s Synthwave Lead</option>
              <option value="acoustic_vocal">Acoustic Warmth & Vocal Resonator</option>
            </optgroup>
            <optgroup label="Acoustic Calibration Signals">
              <option value="pink_noise">Pink Noise (Room Calibrator)</option>
              <option value="sine_sweep">Sine Sweep (20Hz - 20kHz)</option>
            </optgroup>
            {customFileName && (
              <optgroup label="Uploaded Audio">
                <option value="custom_file">{customFileName}</option>
              </optgroup>
            )}
          </select>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
          />

          <button
            className="btn-outline"
            style={{ padding: '6px 12px', fontSize: '0.78rem' }}
            onClick={() => fileInputRef.current?.click()}
            title="Load your own MP3/WAV/FLAC music file"
          >
            <Upload size={13} />
            <span>Load File</span>
          </button>

          {/* Share Chrome Tab or System Sound */}
          {currentTrackId === 'captured_tab' ? (
            <>
              {/* Headset Monitor Mute Toggle to Prevent Echo */}
              <button
                className="btn-outline"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  borderColor: isHeadsetMuted ? 'rgba(148, 163, 184, 0.4)' : '#22c55e',
                  background: isHeadsetMuted ? 'rgba(148, 163, 184, 0.12)' : 'rgba(34, 197, 94, 0.15)',
                  color: isHeadsetMuted ? '#94a3b8' : '#86efac',
                }}
                onClick={handleToggleHeadsetMonitor}
                title={
                  isHeadsetMuted
                    ? 'Headset monitor is MUTED to eliminate double hearing/echo. Click to unmute.'
                    : 'Headset monitor is ON. Click to mute local headset output to prevent double hearing.'
                }
              >
                <span>{isHeadsetMuted ? '🎧 Headset: Muted (No Echo)' : '🔊 Headset: On'}</span>
              </button>

              <button
                className="btn-outline"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  background: 'rgba(239, 68, 68, 0.2)',
                  borderColor: '#ef4444',
                  color: '#fca5a5',
                }}
                onClick={() => audioEngine.stopTabCapture()}
                title="Stop sharing tab / system audio"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#ef4444',
                    display: 'inline-block',
                    marginRight: 6,
                    animation: 'pulse-dot 1s infinite',
                  }}
                />
                <span>Stop Tab</span>
              </button>
            </>
          ) : (
            <button
              className="btn-outline"
              style={{
                padding: '6px 12px',
                fontSize: '0.78rem',
                borderColor: 'rgba(6, 182, 212, 0.4)',
                color: '#67e8f9',
                background: 'rgba(6, 182, 212, 0.08)',
              }}
              onClick={async () => {
                try {
                  await audioEngine.captureTabOrSystemAudio();
                } catch (e) {
                  alert(e.message || 'Could not capture tab audio');
                }
              }}
              title="Capture audio from YouTube, Spotify, or System Sound and stream with custom EQ"
            >
              <span>🖥️ Share Tab Sound</span>
            </button>
          )}

          {/* Cast Stream or Connect Speaker Button */}
          {!isDeviceConnected ? (
            <button
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              onClick={onConnectSpeaker}
              title="Connect to physical speaker first before casting"
            >
              <span>🔗 Connect Speaker</span>
            </button>
          ) : isSpeakerStreaming ? (
            <button
              className="btn-outline"
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                borderColor: '#ef4444',
                color: '#fca5a5',
                background: 'rgba(239, 68, 68, 0.18)',
              }}
              onClick={onStopCast}
              title="Stop streaming audio to Google Home"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                  marginRight: 6,
                  animation: 'pulse-dot 1s infinite',
                }}
              />
              <span>⏹ Stop Cast Stream</span>
            </button>
          ) : (
            <button
              className="btn-outline"
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                borderColor: 'rgba(99, 102, 241, 0.5)',
                color: '#a5b4fc',
                background: 'rgba(99, 102, 241, 0.12)',
              }}
              onClick={onCastToSpeaker}
              title={`Cast equalized audio directly to ${activeDevice?.name || 'Google Home'}`}
            >
              <span>
                📡 {currentTrackId === 'captured_tab' ? 'Cast Tab to Speaker' : 'Stream to Speaker'}
              </span>
            </button>
          )}
        </div>

        {/* Right Controls: Volume & A/B Bypass */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Quick A/B Comparison Toggle */}
          <button
            className={`bypass-toggle-btn ${isBypassed ? 'bypassed' : 'active'}`}
            onClick={onToggleBypass}
            style={{ fontSize: '0.75rem', padding: '5px 12px' }}
            title="Toggle between Equalized sound and Flat (unprocessed) sound"
          >
            <Layers size={13} />
            <span>{isBypassed ? 'FLAT REFERENCE' : 'EQ ACTIVE'}</span>
          </button>

          <div className="player-volume-group">
            {volume === 0 ? <VolumeX size={17} color="#64748b" /> : <Volume2 size={17} color="#94a3b8" />}
            <input
              type="range"
              className="volume-slider"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              title={`Master Volume: ${Math.round(volume * 100)}%`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
