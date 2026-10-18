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
}) {
  const knobRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + norm * 270;

  const radius = 52;
  const center = 60;
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
        title="Drag up/down to adjust"
      >
        <svg className="knob-ring-svg" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth="4"
            strokeDasharray="165 75"
            strokeDashoffset="-30"
            strokeLinecap="round"
          />

          {arcPath && (
            <path
              d={arcPath}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${glowColor})` }}
            />
          )}

          <line
            x1="60"
            y1="4"
            x2="60"
            y2="9"
            stroke="rgba(255, 255, 255, 0.3)"
            strokeWidth="1.5"
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
