import React from 'react';
import { Home, Mic, Zap, Moon, Sliders, Volume2 } from 'lucide-react';

export function AcousticSettings({
  roomPlacement,
  onChangeRoomPlacement,
  dialogueBoost,
  onToggleDialogueBoost,
  dynamicBass,
  onToggleDynamicBass,
  nightMode,
  onToggleNightMode,
  stereoBalance,
  onChangeStereoBalance,
}) {
  const roomOptions = [
    {
      id: 'free',
      name: 'Free-Standing',
      desc: 'Open table or counter. Neutral boundary response.',
    },
    {
      id: 'wall',
      name: 'Near Wall',
      desc: 'Compensates for +3dB bass reflection boundary buildup.',
    },
    {
      id: 'corner',
      name: 'In Corner',
      desc: 'Applies -4.5dB low-shelf to eliminate heavy boomy resonance.',
    },
    {
      id: 'bookshelf',
      name: 'Bookshelf',
      desc: 'Tames enclosure cavity reflections and lower mids.',
    },
  ];

  return (
    <div className="acoustic-settings-container">
      {/* Room Placement Compensation */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <Home size={15} color="#818cf8" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Room Placement Calibration</span>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Boundary acoustic compensation matching Google Nest Smart Sound.
        </p>

        <div className="room-grid">
          {roomOptions.map((opt) => (
            <div
              key={opt.id}
              className={`room-card ${roomPlacement === opt.id ? 'active' : ''}`}
              onClick={() => onChangeRoomPlacement(opt.id)}
            >
              <div className="room-card-header">
                <span className="room-card-title">{opt.name}</span>
                {roomPlacement === opt.id && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }} />
                )}
              </div>
              <p className="room-card-desc">{opt.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Smart Audio Enhancements */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sliders size={15} color="#06b6d4" />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>DSP Enhancements</span>
        </div>

        <div className="feature-toggle-list">
          {/* Dialogue Clarity */}
          <div className="feature-toggle-item">
            <div className="feature-info">
              <span className="feature-name">Dialogue & Vocal Boost</span>
              <span className="feature-desc">Peaking 3.0 kHz filter for clear podcasts and speech</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={dialogueBoost}
                onChange={(e) => onToggleDialogueBoost(e.target.checked)}
              />
              <span className="slider-round" />
            </label>
          </div>

          {/* Dynamic Bass Boost */}
          <div className="feature-toggle-item">
            <div className="feature-info">
              <span className="feature-name">Dynamic Loudness Bass</span>
              <span className="feature-desc">Fletcher-Munson low-frequency boost for punchy audio</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={dynamicBass}
                onChange={(e) => onToggleDynamicBass(e.target.checked)}
              />
              <span className="slider-round" />
            </label>
          </div>

          {/* Night Mode */}
          <div className="feature-toggle-item">
            <div className="feature-info">
              <span className="feature-name">Night Mode (Dynamic Compressor)</span>
              <span className="feature-desc">Tames loud sound spikes and boosts quiet whispering</span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={nightMode}
                onChange={(e) => onToggleNightMode(e.target.checked)}
              />
              <span className="slider-round" />
            </label>
          </div>
        </div>
      </div>

      {/* Stereo Balance Slider */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Stereo Balance</span>
          <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: '#a5b4fc' }}>
            {stereoBalance === 0
              ? 'Center (C)'
              : stereoBalance < 0
              ? `L ${Math.abs(Math.round(stereoBalance * 100))}%`
              : `R ${Math.round(stereoBalance * 100)}%`}
          </span>
        </div>
        <input
          type="range"
          min={-1}
          max={1}
          step={0.05}
          value={stereoBalance}
          onChange={(e) => onChangeStereoBalance(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--color-brand-primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          <span>Left</span>
          <span onClick={() => onChangeStereoBalance(0)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Center</span>
          <span>Right</span>
        </div>
      </div>
    </div>
  );
}
