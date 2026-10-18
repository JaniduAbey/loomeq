import React, { useState, useRef } from 'react';
import { RotateCcw, Plus, Minus } from 'lucide-react';

export function ClassicDials({ bass, treble, onChangeBass, onChangeTreble }) {
  return (
    <div className="classic-dials-view">
      <div className="dial-grid">
        {/* Bass Dial */}
        <RotaryKnob
          label="Bass"
          subtext="Low frequencies (30Hz – 250Hz)"
          value={bass}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#6366f1"
          onChange={onChangeBass}
        />

        {/* Treble Dial */}
        <RotaryKnob
          label="Treble"
          subtext="High frequencies (4kHz – 16kHz)"
          value={treble}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#06b6d4"
          onChange={onChangeTreble}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <button
          className="btn-outline"
          onClick={() => {
            onChangeBass(0);
            onChangeTreble(0);
          }}
          title="Reset both dials to neutral 0 dB"
        >
          <RotateCcw size={14} />
          <span>Reset Google Home EQ (0 dB Flat)</span>
        </button>
      </div>
    </div>
  );
}

function RotaryKnob({ label, subtext, value, min, max, step, unit, color, onChange }) {
  const knobRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  // Compute angle for -135deg (min) to +135deg (max)
  const norm = (value - min) / (max - min); // 0 to 1
  const angle = -135 + norm * 270;

  // Arc path for SVG
  const radius = 64;
  const center = 75;
  const startAngleRad = ((-135 - 90) * Math.PI) / 180;
  const endAngleRad = (((-135 + norm * 270) - 90) * Math.PI) / 180;

  const x1 = center + radius * Math.cos(startAngleRad);
  const y1 = center + radius * Math.sin(startAngleRad);
  const x2 = center + radius * Math.cos(endAngleRad);
  const y2 = center + radius * Math.sin(endAngleRad);

  const largeArcFlag = norm > 0.5 ? 1 : 0;
  const arcPath = norm <= 0.01 
    ? '' 
    : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

  const handlePointerDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const change = (deltaY / 120) * range;
    let newVal = startVal.current + change;

    // Snap to step
    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  const stepDown = () => {
    const newVal = Math.max(min, value - step);
    onChange(newVal);
  };

  const stepUp = () => {
    const newVal = Math.min(max, value + step);
    onChange(newVal);
  };

  return (
    <div className="rotary-knob-container">
      <div
        ref={knobRef}
        className="rotary-knob"
        onPointerDown={handlePointerDown}
        title="Click and drag up/down to adjust"
      >
        <svg className="rotary-svg-ring" viewBox="0 0 150 150">
          {/* Background track */}
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="7"
            strokeDasharray="210 90"
            strokeDashoffset="-38"
            strokeLinecap="round"
          />

          {/* Active arc */}
          {arcPath && (
            <path
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${color})` }}
            />
          )}

          {/* Zero detent tick mark at top (angle 0) */}
          <line
            x1="75"
            y1="5"
            x2="75"
            y2="13"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="2"
          />
        </svg>

        {/* Center Disc with Value */}
        <div className="rotary-center-disc">
          <span className="rotary-value-display">
            {value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)}
          </span>
          <span className="rotary-unit">{unit}</span>
        </div>
      </div>

      <div className="rotary-label-group">
        <h3 className="rotary-title">{label}</h3>
        <p className="rotary-subtext">{subtext}</p>
      </div>

      <div className="knob-steppers">
        <button className="knob-step-btn" onClick={stepDown} title={`Decrease ${label}`}>
          <Minus size={12} />
        </button>
        <button
          className="knob-step-btn"
          onClick={() => onChange(0)}
          title="Reset to 0 dB"
          style={{ width: 'auto', padding: '0 8px', borderRadius: '12px', fontSize: '0.7rem' }}
        >
          0 dB
        </button>
        <button className="knob-step-btn" onClick={stepUp} title={`Increase ${label}`}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
}
