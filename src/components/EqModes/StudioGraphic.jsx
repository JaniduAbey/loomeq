import React from 'react';
import { RotateCcw, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { STANDARD_FREQUENCIES_10 } from '../../audio/AudioEngine';

export function StudioGraphic({ bands10, onChangeBand, onResetAll }) {
  const formatFreq = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

  const handleInvert = () => {
    bands10.forEach((gain, i) => {
      onChangeBand(i, -gain);
    });
  };

  return (
    <div className="studio-graphic-card">
      {/* Console Strip Header */}
      <div className="graphic-header">
        <div className="graphic-title-group">
          <span className="live-dot-lime" />
          <span className="graphic-title">10-BAND ISO GRAPHIC EQUALIZER</span>
          <span className="graphic-sub">±12 dB Precision Peaking Filters</span>
        </div>

        <div className="graphic-actions">
          <button className="btn-graphic-action" onClick={onResetAll} title="Reset all 10 bands to 0 dB flat">
            <RotateCcw size={12} />
            <span>Zero Flat</span>
          </button>
          <button className="btn-graphic-action" onClick={handleInvert} title="Invert current frequency curve">
            <ArrowUpDown size={12} />
            <span>Invert</span>
          </button>
        </div>
      </div>

      {/* 10 Vertical Fader Channels Console */}
      <div className="graphic-faders-rack">
        {/* Background 0dB reference guideline */}
        <div className="fader-center-guideline" />

        {STANDARD_FREQUENCIES_10.map((freq, index) => {
          const gain = bands10[index] || 0;
          const isBoosted = gain > 0;
          const isCut = gain < 0;

          return (
            <div key={freq} className="graphic-channel-cell">
              {/* dB Readout */}
              <span
                className={`fader-gain-badge ${isBoosted ? 'boost' : isCut ? 'cut' : 'flat'}`}
              >
                {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
              </span>

              {/* Vertical Fader Track Wrapper */}
              <div className="fader-track-slot">
                <input
                  type="range"
                  className="graphic-vertical-fader"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gain}
                  onChange={(e) => onChangeBand(index, parseFloat(e.target.value))}
                  title={`${formatFreq(freq)} Hz: ${gain.toFixed(1)} dB`}
                />
              </div>

              {/* Frequency Label */}
              <div className="fader-freq-tag">
                <span>{formatFreq(freq)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
