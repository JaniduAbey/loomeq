import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Cast,
  Headphones,
  Radio,
} from 'lucide-react';
import { audioEngine } from '../audio/AudioEngine';

const BUILT_IN_TRACKS = [
  { id: 'funk_bass', name: 'Funk Bass & Drum Groove' },
  { id: 'synthwave', name: 'Retro 80s Synthwave' },
  { id: 'acoustic_vocal', name: 'Acoustic Warmth & Vocal' },
  { id: 'pink_noise', name: 'Pink Noise (Acoustic Calibrator)' },
  { id: 'sine_sweep', name: 'Sine Sweep (20Hz - 20kHz)' },
];

export function AudioPlayerBar({
  onCastToSpeaker,
  isSpeakerStreaming,
  onStopCast,
  isDeviceConnected = true,
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

  const handleCaptureTab = async () => {
    try {
      await audioEngine.captureTabOrSystemAudio();
      setIsHeadsetMuted(audioEngine.isHeadsetMuted);
    } catch (err) {
      // User cancelled or failed
    }
  };

  return (
    <div className="audio-player-dock">
      <div className="player-content">
        {/* Play / Pause Button in Lime Circle */}
        <button
          className="btn-play-lime"
          onClick={handleTogglePlay}
          title={isPlaying ? 'Pause Audio' : 'Play Test Track'}
        >
          {isPlaying ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 2 }} />}
        </button>

        {/* Track Selector Dropdown */}
        <div className="player-track-select-wrap">
          <select
            className="player-select"
            value={currentTrackId}
            onChange={handleTrackChange}
          >
            {BUILT_IN_TRACKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {customFileName && (
              <option value="custom_file">{customFileName}</option>
            )}
            {currentTrackId === 'captured_tab' && (
              <option value="captured_tab">Chrome Tab / System Audio (Live)</option>
            )}
          </select>
        </div>

        {/* Load Audio File */}
        <button
          className="btn-player-action"
          onClick={() => fileInputRef.current?.click()}
          title="Upload MP3, FLAC, or WAV"
        >
          <Upload size={13} />
          <span>Upload File</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        {/* Share Tab Audio Button */}
        <button
          className={`btn-player-action ${currentTrackId === 'captured_tab' ? 'active-lime' : ''}`}
          onClick={handleCaptureTab}
          title="Capture Chrome tab audio or YouTube live stream"
        >
          <Radio size={13} />
          <span>Capture Tab</span>
        </button>

        {/* Stream to Physical Speaker Button (Click to Stream, Click again to Disconnect) */}
        <button
          className={`btn-player-action ${isSpeakerStreaming ? 'streaming-active' : ''}`}
          onClick={async () => {
            if (isSpeakerStreaming) {
              await onStopCast();
            } else {
              await onCastToSpeaker();
            }
          }}
          disabled={!isDeviceConnected}
          title={isSpeakerStreaming ? 'Click to Disconnect / Stop streaming to speaker' : 'Stream DSP audio to Google Home'}
        >
          <Cast size={13} className={isSpeakerStreaming ? 'animate-pulse' : ''} />
          <span>{isSpeakerStreaming ? 'Disconnect Stream' : 'Stream to Speaker'}</span>
        </button>

        {/* Headset Monitor Mute Toggle */}
        <button
          className={`btn-player-action ${isHeadsetMuted ? 'muted-warn' : ''}`}
          onClick={handleToggleHeadsetMonitor}
          title={isHeadsetMuted ? 'Local monitor muted (No double echo)' : 'Local monitor unmuted'}
        >
          <Headphones size={13} />
          <span>{isHeadsetMuted ? 'Monitor Muted' : 'Monitor On'}</span>
        </button>

        {/* Master Volume */}
        <div className="player-volume-wrap">
          {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="player-volume-slider"
            title="Master Volume"
          />
        </div>
      </div>
    </div>
  );
}
