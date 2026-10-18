import React, { useRef, useState } from 'react';
import { RotateCcw, Zap, Mic, ShieldAlert, Waves } from 'lucide-react';
import { audioEngine } from '../../audio/AudioEngine';

export function ClassicDials({
  bass = 0,
  treble = 0,
  onChangeBass,
  onChangeTreble,
  tubeDrive = 0,
  onChangeTubeDrive,
  stereoWidth = 1,
  onChangeStereoWidth,
  isAutoGain = true,
  onToggleAutoGain,
  dynamicBass = false,
  onToggleDynamicBass,
  dialogueBoost = false,
  onToggleDialogueBoost,
  nightMode = false,
  onToggleNightMode,
}) {
  const [internalTube, setInternalTube] = useState(tubeDrive || 0);
  const [internalWidth, setInternalWidth] = useState(stereoWidth ?? 1);
  const [autoGainActive, setAutoGainActive] = useState(isAutoGain ?? true);

  const handleTubeChange = (val) => {
    setInternalTube(val);
    audioEngine.setTubeWarmth(val);
    if (onChangeTubeDrive) onChangeTubeDrive(val);
  };

  const handleWidthChange = (val) => {
    setInternalWidth(val);
    audioEngine.setStereoWidth(val);
    if (onChangeStereoWidth) onChangeStereoWidth(val);
  };

  const handleAutoGainToggle = () => {
    const next = !autoGainActive;
    setAutoGainActive(next);
    audioEngine.setAutoGainEnabled(next);
    if (onToggleAutoGain) onToggleAutoGain(next);
  };

  const resetAllToFlat = () => {
    onChangeBass(0);
    onChangeTreble(0);
    handleTubeChange(0);
    handleWidthChange(1.0);
  };

  return (
    <div className="tactile-rack-view">
      {/* Sleek Minimalist Console Header */}
      <div className="rack-faceplate-header">
        <div className="rack-title-group">
          <span className="live-dot-lime" />
          <span className="rack-title">ANALOG CHANNEL STRIP</span>
        </div>

        <div className="rack-header-actions">
          {/* Auto-Gain Loudness Toggle */}
          <button
            className={`btn-auto-gain ${autoGainActive ? 'engaged' : ''}`}
            onClick={handleAutoGainToggle}
            title="Auto-Gain Fletcher-Munson Loudness Normalizer (Prevents volume jump when boosting bass/treble)"
          >
            <span className={`pill-led ${autoGainActive ? 'lime' : 'off'}`} />
            <span>Auto-Gain</span>
          </button>

          {/* Zero Flat Reset */}
          <button
            className="btn-zero-flat"
            onClick={resetAllToFlat}
            title="Reset all knobs to 0 dB flat"
          >
            <RotateCcw size={12} />
            <span>Zero Flat</span>
          </button>
        </div>
      </div>

      {/* 4 Rotary Dials Grid */}
      <div className="knob-rack-grid">
        {/* Knob 1: Bass */}
        <StudioRotaryKnob
          id="knob-bass"
          label="BASS"
          subtext="160 Hz Low-Shelf"
          value={bass}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#10f27c"
          glowColor="rgba(16, 242, 124, 0.6)"
          onChange={onChangeBass}
        />

        {/* Knob 2: Treble */}
        <StudioRotaryKnob
          id="knob-treble"
          label="TREBLE"
          subtext="3.2 kHz High-Shelf"
          value={treble}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#10f27c"
          glowColor="rgba(16, 242, 124, 0.6)"
          onChange={onChangeTreble}
        />

        {/* Knob 3: Warmth (Tube Saturation) */}
        <StudioRotaryKnob
          id="knob-tube"
          label="WARMTH"
          subtext="Tube Saturation"
          value={Math.round(internalTube * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          color="#34d399"
          glowColor="rgba(52, 211, 153, 0.6)"
          onChange={(val) => handleTubeChange(val / 100)}
        />

        {/* Knob 4: Width (Stereo Imager) */}
        <StudioRotaryKnob
          id="knob-width"
          label="WIDTH"
          subtext="Spatial Soundstage"
          value={Math.round(internalWidth * 100)}
          min={0}
          max={200}
          step={5}
          unit="%"
          color="#10f27c"
          glowColor="rgba(16, 242, 124, 0.6)"
          onChange={(val) => handleWidthChange(val / 100)}
        />
      </div>

      {/* Bottom Minimalist Enhancement Toggles */}
      <div className="rack-enhancement-bar">
        <div className="switches-cluster">
          {/* Sub Exciter */}
          <button
            className={`pill-switch-btn ${dynamicBass ? 'active' : ''}`}
            onClick={() => onToggleDynamicBass && onToggleDynamicBass(!dynamicBass)}
          >
            <span className={`pill-led ${dynamicBass ? 'lime' : 'off'}`} />
            <Waves size={13} className="switch-icon" />
            <span className="switch-title">Sub Exciter (+4dB)</span>
          </button>

          {/* Vocal Air */}
          <button
            className={`pill-switch-btn ${dialogueBoost ? 'active' : ''}`}
            onClick={() => onToggleDialogueBoost && onToggleDialogueBoost(!dialogueBoost)}
          >
            <span className={`pill-led ${dialogueBoost ? 'lime' : 'off'}`} />
            <Mic size={13} className="switch-icon" />
            <span className="switch-title">Vocal Clarity (+3.5dB)</span>
          </button>

          {/* Night Limiter */}
          <button
            className={`pill-switch-btn ${nightMode ? 'active' : ''}`}
            onClick={() => onToggleNightMode && onToggleNightMode(!nightMode)}
          >
            <span className={`pill-led ${nightMode ? 'lime' : 'off'}`} />
            <ShieldAlert size={13} className="switch-icon" />
            <span className="switch-title">Night Limiter</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Minimalist Knurled Aluminum Knob Component
function StudioRotaryKnob({
  id,
  label,
  subtext,
  value,
  min,
  max,
  step,
  unit,
  color,
  glowColor,
  onChange,
  isBipolar = min < 0 && max > 0,
}) {
  const knobRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + norm * 270;

  const radius = 46;
  const circumference = 2 * Math.PI * radius; // 289.027
  const arcLength270 = 0.75 * circumference; // 216.77
  const halfArc = arcLength270 / 2; // 108.385 (135 degrees)

  // Bipolar Arc Calculations
  let arcDasharray = '0 1000';
  let arcTransform = 'rotate(135 60 60)';

  if (isBipolar) {
    if (value > 0) {
      const posNorm = Math.min(1, value / max);
      const posLen = Math.max(0.1, posNorm * halfArc);
      arcDasharray = `${posLen} ${circumference}`;
      arcTransform = 'rotate(-90 60 60)'; // Start at 12 o'clock and sweep clockwise
    } else if (value < 0) {
      const negNorm = Math.min(1, Math.abs(value) / Math.abs(min));
      const negLen = Math.max(0.1, negNorm * halfArc);
      const negAngle = negNorm * 135;
      arcDasharray = `${negLen} ${circumference}`;
      arcTransform = `rotate(${-90 - negAngle} 60 60)`; // Start to the left and sweep up to 12 o'clock
    }
  } else {
    if (norm > 0.005) {
      const activeLength = Math.max(0.1, norm * arcLength270);
      arcDasharray = `${activeLength} ${circumference}`;
      arcTransform = 'rotate(135 60 60)';
    }
  }

  const handlePointerDown = (e) => {
    isDragging.current = true;
    startY.current = e.clientY;
    startVal.current = value;
    e.target.setPointerCapture?.(e.pointerId);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    const deltaY = startY.current - e.clientY;
    const range = max - min;
    const change = (deltaY / 140) * range;
    let newVal = startVal.current + change;

    newVal = Math.round(newVal / step) * step;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    e.target.releasePointerCapture?.(e.pointerId);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="knob-assembly-cell" id={id}>
      <div className="knob-title-wrap">
        <span className="knob-label">{label}</span>
        <span className="knob-subtext">{subtext}</span>
      </div>

      <div
        ref={knobRef}
        className="knob-body-wrap"
        onPointerDown={handlePointerDown}
        title="Drag up/down to adjust value"
      >
        <svg className="knob-ring-svg" viewBox="0 0 120 120">
          {/* Bezel Scale Ticks (-135°, -67.5°, 0°, +67.5°, +135°) */}
          {[
            { a: -135, major: true },
            { a: -67.5, major: false },
            { a: 0, major: true, center: true },
            { a: 67.5, major: false },
            { a: 135, major: true },
          ].map(({ a, major, center }) => {
            const rad = (a * Math.PI) / 180;
            const r1 = radius + 4;
            const r2 = radius + (major ? 8 : 6);
            const x1 = 60 + r1 * Math.sin(rad);
            const y1 = 60 - r1 * Math.cos(rad);
            const x2 = 60 + r2 * Math.sin(rad);
            const y2 = 60 - r2 * Math.cos(rad);
            return (
              <line
                key={a}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={center ? 'rgba(16, 242, 124, 0.7)' : 'rgba(255, 255, 255, 0.18)'}
                strokeWidth={center ? 1.8 : major ? 1.2 : 0.8}
                strokeLinecap="round"
              />
            );
          })}

          {/* Background track circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3.5"
            strokeDasharray={`${arcLength270} ${circumference}`}
            transform="rotate(135 60 60)"
            strokeLinecap="round"
          />

          {/* Active glow arc */}
          {((isBipolar && value !== 0) || (!isBipolar && norm > 0.005)) && (
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="3.5"
              strokeDasharray={arcDasharray}
              transform={arcTransform}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${glowColor})` }}
            />
          )}

          {/* 12 o'clock detent center tick */}
          <line
            x1="60"
            y1={60 - radius - 2}
            x2="60"
            y2={60 - radius + 5}
            stroke={value === 0 && isBipolar ? 'var(--color-lime)' : 'rgba(255, 255, 255, 0.35)'}
            strokeWidth={value === 0 && isBipolar ? '2' : '1.2'}
            strokeLinecap="round"
          />
        </svg>

        <div
          className="knob-rotor-disc"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <div className="knob-notch-pointer" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <div className="knob-cap-center" />
        </div>
      </div>

      <div className="knob-digital-readout">
        <span className="readout-num" style={{ color }}>
          {value > 0 ? `+${value}` : value}
        </span>
        <span className="readout-unit">{unit}</span>
      </div>
    </div>
  );
}
