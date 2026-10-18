import React, { useRef, useState, useEffect } from 'react';
import { RotateCcw, Volume2, Sparkles, Zap, Mic, ShieldAlert, Sliders, Waves } from 'lucide-react';
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
      {/* Top Rack Strip */}
      <div className="rack-faceplate-header">
        <div className="rack-model-tag">
          <div className="rack-screw" />
          <div className="rack-brand">
            <span className="rack-brand-accent">AURA</span>
            <span className="rack-brand-model">PRO-DSP 4000</span>
          </div>
          <span className="rack-serial">ANALOG HYBRID CHANNEL STRIP</span>
        </div>

        <div className="rack-header-actions">
          {/* Hardware Auto-Gain Switch */}
          <button
            className={`hardware-toggle-button ${autoGainActive ? 'engaged' : ''}`}
            onClick={handleAutoGainToggle}
            title="Auto-Gain Fletcher-Munson Loudness Normalizer (Prevents volume jump when boosting bass/treble)"
          >
            <span className={`toggle-led ${autoGainActive ? 'green' : 'off'}`} />
            <span className="toggle-label">AUTO-GAIN LOUDNESS</span>
          </button>

          {/* Master 0dB Reset */}
          <button
            className="rack-reset-btn"
            onClick={resetAllToFlat}
            title="Zero all knobs back to factory flat reference"
          >
            <RotateCcw size={12} />
            <span>ZERO FLAT</span>
          </button>
          <div className="rack-screw" />
        </div>
      </div>

      {/* Main Rotary Console Grid */}
      <div className="knob-rack-grid">
        {/* Knob 1: Bass Sculptor */}
        <StudioRotaryKnob
          id="knob-bass"
          label="BASS SCULPTOR"
          subtext="160 Hz Low-Shelf"
          value={bass}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#6366f1"
          glowColor="rgba(99, 102, 241, 0.6)"
          onChange={onChangeBass}
        />

        {/* Knob 2: Treble Detail */}
        <StudioRotaryKnob
          id="knob-treble"
          label="TREBLE AIR"
          subtext="3.2 kHz High-Shelf"
          value={treble}
          min={-6}
          max={6}
          step={0.5}
          unit="dB"
          color="#06b6d4"
          glowColor="rgba(6, 182, 212, 0.6)"
          onChange={onChangeTreble}
        />

        {/* Knob 3: Analog Tube Saturation */}
        <StudioRotaryKnob
          id="knob-tube"
          label="TUBE WARMTH"
          subtext="Triode Harmonic Color"
          value={Math.round(internalTube * 100)}
          min={0}
          max={100}
          step={1}
          unit="%"
          color="#f59e0b"
          glowColor="rgba(245, 158, 11, 0.6)"
          onChange={(val) => handleTubeChange(val / 100)}
        />

        {/* Knob 4: Spatial Stereo Imager */}
        <StudioRotaryKnob
          id="knob-width"
          label="STEREO WIDTH"
          subtext="Mid/Side Soundstage"
          value={Math.round(internalWidth * 100)}
          min={0}
          max={200}
          step={5}
          unit="%"
          color="#10b981"
          glowColor="rgba(16, 185, 129, 0.6)"
          onChange={(val) => handleWidthChange(val / 100)}
        />
      </div>

      {/* Bottom Rack Enhancement Switches Bar */}
      <div className="rack-enhancement-bar">
        <div className="enhancement-title">
          <Zap size={13} className="text-amber" />
          <span>DSP ENHANCEMENT ENGAGEMENTS</span>
        </div>

        <div className="switches-cluster">
          {/* Dynamic Punch Exciter */}
          <button
            className={`metal-switch-tile ${dynamicBass ? 'active' : ''}`}
            onClick={() => onToggleDynamicBass && onToggleDynamicBass(!dynamicBass)}
          >
            <div className="switch-top">
              <span className={`switch-led ${dynamicBass ? 'amber' : 'off'}`} />
              <Waves size={14} className="switch-icon" />
            </div>
            <div className="switch-title">SUB EXCITER</div>
            <div className="switch-sub">+4dB @ 90Hz Punch</div>
          </button>

          {/* Dialogue Clarity */}
          <button
            className={`metal-switch-tile ${dialogueBoost ? 'active' : ''}`}
            onClick={() => onToggleDialogueBoost && onToggleDialogueBoost(!dialogueBoost)}
          >
            <div className="switch-top">
              <span className={`switch-led ${dialogueBoost ? 'cyan' : 'off'}`} />
              <Mic size={14} className="switch-icon" />
            </div>
            <div className="switch-title">VOCAL CLARITY</div>
            <div className="switch-sub">+3.5dB 3kHz Presence</div>
          </button>

          {/* Night Mode Compressor */}
          <button
            className={`metal-switch-tile ${nightMode ? 'active' : ''}`}
            onClick={() => onToggleNightMode && onToggleNightMode(!nightMode)}
          >
            <div className="switch-top">
              <span className={`switch-led ${nightMode ? 'violet' : 'off'}`} />
              <ShieldAlert size={14} className="switch-icon" />
            </div>
            <div className="switch-title">DYNAMICS LIMITER</div>
            <div className="switch-sub">Night Mode Compressor</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// Precision Knurled Aluminum Rotary Knob Component
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
}) {
  const knobRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  // Normalize 0 to 1
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Angle: -135deg (min) to +135deg (max)
  const angle = -135 + norm * 270;

  // Arc path for SVG ring
  const radius = 54;
  const center = 65;
  const startAngleRad = ((-135 - 90) * Math.PI) / 180;
  const endAngleRad = (((-135 + norm * 270) - 90) * Math.PI) / 180;

  const x1 = center + radius * Math.cos(startAngleRad);
  const y1 = center + radius * Math.sin(startAngleRad);
  const x2 = center + radius * Math.cos(endAngleRad);
  const y2 = center + radius * Math.sin(endAngleRad);

  const largeArcFlag = norm > 0.5 ? 1 : 0;
  const arcPath = norm <= 0.005 ? '' : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;

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
    const change = (deltaY / 130) * range;
    let newVal = startVal.current + change;

    // Snap to step
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
        title="Click & drag up/down to adjust with precision"
      >
        <svg className="knob-ring-svg" viewBox="0 0 130 130">
          {/* Background track */}
          <circle
            cx="65"
            cy="65"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="5"
            strokeDasharray="180 75"
            strokeDashoffset="-32"
            strokeLinecap="round"
          />

          {/* Active glow arc */}
          {arcPath && (
            <path
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth="5"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${glowColor})` }}
            />
          )}

          {/* Top detent tick */}
          <line
            x1="65"
            y1="5"
            x2="65"
            y2="11"
            stroke="rgba(255, 255, 255, 0.4)"
            strokeWidth="2"
          />
        </svg>

        {/* Tactile Knurled Metal Knob Disc */}
        <div
          className="knob-rotor-disc"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Brushed texture ring */}
          <div className="knob-knurling-edge" />
          <div className="knob-notch-pointer" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <div className="knob-cap-center" />
        </div>
      </div>

      {/* Numeric Display Pod */}
      <div className="knob-digital-readout">
        <span className="readout-num" style={{ color }}>
          {value > 0 ? `+${value}` : value}
        </span>
        <span className="readout-unit">{unit}</span>
      </div>
    </div>
  );
}
