import React from 'react';
import { RotateCcw, TrendingUp, SlidersHorizontal } from 'lucide-react';
import { STANDARD_FREQUENCIES_10 } from '../../audio/AudioEngine';

export function StudioGraphic({ bands10, onChangeBand, onResetAll }) {
  const formatFreq = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

  const handleInvert = () => {
    bands10.forEach((gain, i) => {
      onChangeBand(i, -gain);
    });
  };

  return (
    <div className="studio-graphic-view">
      <div className="faders-container">
        {STANDARD_FREQUENCIES_10.map((freq, index) => {
          const gain = bands10[index] || 0;
          return (
            <div key={freq} className="fader-column">
              {/* Value pill */}
              <span
                className="fader-db-display"
                style={{
                  color: gain > 0 ? '#38bdf8' : gain < 0 ? '#f43f5e' : '#a5b4fc',
                  borderColor: gain !== 0 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.1)',
                }}
              >
                {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
              </span>

              {/* Slider Track */}
              <div className="fader-track-wrapper">
                <div className="fader-zero-indicator" />
                <input
                  type="range"
                  className="vertical-slider"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={gain}
                  onChange={(e) => onChangeBand(index, parseFloat(e.target.value))}
                  title={`${formatFreq(freq)} Hz: ${gain.toFixed(1)} dB`}
                />
              </div>

              {/* Frequency Label */}
              <span className="fader-freq-label">{formatFreq(freq)}</span>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-outline" onClick={onResetAll} title="Reset all 10 bands to 0 dB flat">
            <RotateCcw size={13} />
            <span>Flat All (0 dB)</span>
          </button>
          <button className="btn-outline" onClick={handleInvert} title="Invert current frequency curve">
            <SlidersHorizontal size={13} />
            <span>Invert EQ</span>
          </button>
        </div>

        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
          Precision ISO Octave Bands (±12 dB)
        </span>
      </div>
    </div>
  );
}
