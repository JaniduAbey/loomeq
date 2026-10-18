import React, { useRef, useEffect, useState, useCallback } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { Palette, Crosshair, Sparkles } from 'lucide-react';

const NUM_CURVE_POINTS = 180;
const TEST_FREQUENCIES = new Float32Array(NUM_CURVE_POINTS);
const MIN_FREQ = 20;
const MAX_FREQ = 20000;

for (let i = 0; i < NUM_CURVE_POINTS; i++) {
  const t = i / (NUM_CURVE_POINTS - 1);
  TEST_FREQUENCIES[i] = MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, t);
}

const FREQ_TICKS = [30, 60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const DB_TICKS = [12, 6, 0, -6, -12];

export const VISUALIZER_THEMES = {
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon',
    curveStroke: '#818cf8',
    curveGlow: 'rgba(99, 102, 241, 0.85)',
    curveFillTop: 'rgba(99, 102, 241, 0.22)',
    curveFillBottom: 'rgba(99, 102, 241, 0.0)',
    barTop: 'rgba(6, 182, 212, 0.85)',
    barBottom: 'rgba(99, 102, 241, 0.1)',
    peakCap: '#a5b4fc',
    nodeBass: '#6366f1',
    nodeTreble: '#06b6d4',
  },
  amber: {
    id: 'amber',
    name: 'Vintage Neve Tube',
    curveStroke: '#fbbf24',
    curveGlow: 'rgba(251, 191, 36, 0.85)',
    curveFillTop: 'rgba(245, 158, 11, 0.25)',
    curveFillBottom: 'rgba(245, 158, 11, 0.0)',
    barTop: 'rgba(245, 158, 11, 0.85)',
    barBottom: 'rgba(180, 83, 9, 0.12)',
    peakCap: '#fde68a',
    nodeBass: '#f59e0b',
    nodeTreble: '#fbbf24',
  },
  emerald: {
    id: 'emerald',
    name: 'SSL Phosphor Green',
    curveStroke: '#34d399',
    curveGlow: 'rgba(52, 211, 153, 0.85)',
    curveFillTop: 'rgba(16, 185, 129, 0.22)',
    curveFillBottom: 'rgba(16, 185, 129, 0.0)',
    barTop: 'rgba(16, 185, 129, 0.85)',
    barBottom: 'rgba(5, 150, 105, 0.12)',
    peakCap: '#a7f3d0',
    nodeBass: '#10b981',
    nodeTreble: '#34d399',
  },
  ice: {
    id: 'ice',
    name: 'Glacial Arctic',
    curveStroke: '#38bdf8',
    curveGlow: 'rgba(56, 189, 248, 0.85)',
    curveFillTop: 'rgba(56, 189, 248, 0.22)',
    curveFillBottom: 'rgba(56, 189, 248, 0.0)',
    barTop: 'rgba(224, 242, 254, 0.85)',
    barBottom: 'rgba(14, 165, 233, 0.12)',
    peakCap: '#ffffff',
    nodeBass: '#0ea5e9',
    nodeTreble: '#38bdf8',
  },
  crimson: {
    id: 'crimson',
    name: 'Infrared Sunset',
    curveStroke: '#f43f5e',
    curveGlow: 'rgba(244, 63, 94, 0.85)',
    curveFillTop: 'rgba(244, 63, 94, 0.22)',
    curveFillBottom: 'rgba(244, 63, 94, 0.0)',
    barTop: 'rgba(244, 63, 94, 0.85)',
    barBottom: 'rgba(159, 18, 57, 0.12)',
    peakCap: '#fecdd3',
    nodeBass: '#e11d48',
    nodeTreble: '#f43f5e',
  },
};

export function VisualizerCanvas({
  eqVersion,
  bass = 0,
  treble = 0,
  onChangeBass,
  onChangeTreble,
  activeTheme = 'cyber',
  onThemeChange,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const [theme, setTheme] = useState(activeTheme);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeDragNode, setActiveDragNode] = useState(null);
  const [hudInfo, setHudInfo] = useState(null);

  const themeColors = VISUALIZER_THEMES[theme] || VISUALIZER_THEMES.cyber;

  // Node frequency anchors
  const BASS_FREQ = 160;
  const TREBLE_FREQ = 3200;

  const freqToX = useCallback((f, width) => {
    const logMin = Math.log10(MIN_FREQ);
    const logMax = Math.log10(MAX_FREQ);
    return ((Math.log10(f) - logMin) / (logMax - logMin)) * width;
  }, []);

  const xToFreq = useCallback((x, width) => {
    const logMin = Math.log10(MIN_FREQ);
    const logMax = Math.log10(MAX_FREQ);
    const norm = Math.max(0, Math.min(1, x / width));
    return Math.pow(10, logMin + norm * (logMax - logMin));
  }, []);

  const dbToY = useCallback((db, height) => {
    const minDb = -15;
    const maxDb = 15;
    const clamped = Math.max(minDb, Math.min(maxDb, db));
    const normalized = (clamped - minDb) / (maxDb - minDb);
    return height - normalized * height;
  }, []);

  const yToDb = useCallback((y, height) => {
    const minDb = -15;
    const maxDb = 15;
    const normalized = 1 - Math.max(0, Math.min(1, y / height));
    return minDb + normalized * (maxDb - minDb);
  }, []);

  // Handle pointer down on interactive nodes
  const handlePointerDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const bassX = freqToX(BASS_FREQ, rect.width);
    const bassY = dbToY(bass, rect.height);

    const trebleX = freqToX(TREBLE_FREQ, rect.width);
    const trebleY = dbToY(treble, rect.height);

    const distBass = Math.hypot(clickX - bassX, clickY - bassY);
    const distTreble = Math.hypot(clickX - trebleX, clickY - trebleY);

    if (distBass < 24) {
      setActiveDragNode('bass');
      e.target.setPointerCapture?.(e.pointerId);
    } else if (distTreble < 24) {
      setActiveDragNode('treble');
      e.target.setPointerCapture?.(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currX = e.clientX - rect.left;
    const currY = e.clientY - rect.top;

    if (activeDragNode) {
      const rawDb = yToDb(currY, rect.height);
      const clampedDb = Math.round(Math.max(-6, Math.min(6, rawDb)) * 2) / 2;

      if (activeDragNode === 'bass' && onChangeBass) {
        onChangeBass(clampedDb);
        setHudInfo({
          name: 'BASS SHELF',
          freq: '160 Hz',
          gain: `${clampedDb >= 0 ? '+' : ''}${clampedDb.toFixed(1)} dB`,
          x: freqToX(BASS_FREQ, rect.width),
          y: dbToY(clampedDb, rect.height),
        });
      } else if (activeDragNode === 'treble' && onChangeTreble) {
        onChangeTreble(clampedDb);
        setHudInfo({
          name: 'TREBLE SHELF',
          freq: '3.2 kHz',
          gain: `${clampedDb >= 0 ? '+' : ''}${clampedDb.toFixed(1)} dB`,
          x: freqToX(TREBLE_FREQ, rect.width),
          y: dbToY(clampedDb, rect.height),
        });
      }
      return;
    }

    // Hover detection
    const bassX = freqToX(BASS_FREQ, rect.width);
    const bassY = dbToY(bass, rect.height);
    const trebleX = freqToX(TREBLE_FREQ, rect.width);
    const trebleY = dbToY(treble, rect.height);

    const distBass = Math.hypot(currX - bassX, currY - bassY);
    const distTreble = Math.hypot(currX - trebleX, currY - trebleY);

    if (distBass < 20) {
      setHoveredNode('bass');
      setHudInfo({
        name: 'BASS SHELF',
        freq: '160 Hz',
        gain: `${bass >= 0 ? '+' : ''}${bass.toFixed(1)} dB`,
        x: bassX,
        y: bassY,
      });
    } else if (distTreble < 20) {
      setHoveredNode('treble');
      setHudInfo({
        name: 'TREBLE SHELF',
        freq: '3.2 kHz',
        gain: `${treble >= 0 ? '+' : ''}${treble.toFixed(1)} dB`,
        x: trebleX,
        y: trebleY,
      });
    } else {
      setHoveredNode(null);
      setHudInfo(null);
    }
  };

  const handlePointerUp = (e) => {
    if (activeDragNode) {
      e.target.releasePointerCapture?.(e.pointerId);
      setActiveDragNode(null);
    }
  };

  const selectTheme = (themeKey) => {
    setTheme(themeKey);
    if (onThemeChange) onThemeChange(themeKey);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const fftBuffer = new Uint8Array(128);
    const peakHold = new Float32Array(128).fill(0);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Studio Rack Background
      ctx.fillStyle = '#06080d';
      ctx.fillRect(0, 0, width, height);

      // Subtle hardware grid backing
      ctx.fillStyle = 'rgba(255, 255, 255, 0.012)';
      for (let x = 0; x < width; x += 16) {
        ctx.fillRect(x, 0, 1, height);
      }

      // 2. dB Reference Grid lines
      DB_TICKS.forEach((db) => {
        const y = dbToY(db, height);
        ctx.beginPath();
        ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = db === 0 ? 1.5 : 1;
        if (db !== 0) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = db === 0 ? '#cbd5e1' : '#475569';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 8, y - 3);
      });

      // 3. Frequency Tick Lines
      FREQ_TICKS.forEach((f) => {
        const x = freqToX(f, width);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#475569';
        ctx.font = '9px "JetBrains Mono", monospace';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(label, x + 3, height - 26);
      });

      // 4. Real-Time Spectrum Analyzer Bars
      audioEngine.getSpectrumData(fftBuffer);
      const numBars = 60;
      const barSpacing = width / numBars;
      const barWidth = Math.max(2.5, barSpacing - 2);

      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor(Math.pow(i / numBars, 1.55) * (fftBuffer.length - 1));
        const val = fftBuffer[binIndex] || 0;
        const normalizedVal = val / 255;
        const barHeight = normalizedVal * (height * 0.72);

        if (barHeight > peakHold[i]) {
          peakHold[i] = barHeight;
        } else {
          peakHold[i] = Math.max(0, peakHold[i] - 0.65);
        }

        const x = i * barSpacing + 2;
        const y = height - barHeight;

        // Theme-reactive bar gradient
        const barGrad = ctx.createLinearGradient(0, y, 0, height);
        barGrad.addColorStop(0, themeColors.barTop);
        barGrad.addColorStop(1, themeColors.barBottom);

        ctx.fillStyle = barGrad;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Peak needle
        if (peakHold[i] > 2) {
          ctx.fillStyle = themeColors.peakCap;
          ctx.fillRect(x, height - peakHold[i] - 2, barWidth, 1.5);
        }
      }

      // 5. Composite EQ Frequency Response Curve
      const dbResponses = audioEngine.getCombinedFrequencyResponse(TEST_FREQUENCIES);

      ctx.beginPath();
      for (let i = 0; i < NUM_CURVE_POINTS; i++) {
        const x = freqToX(TEST_FREQUENCIES[i], width);
        const y = dbToY(dbResponses[i], height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Glowing stroke
      ctx.shadowColor = themeColors.curveGlow;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = themeColors.curveStroke;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fill under curve
      ctx.lineTo(width, dbToY(0, height));
      ctx.lineTo(0, dbToY(0, height));
      ctx.closePath();

      const curveFillGrad = ctx.createLinearGradient(0, 0, 0, height);
      curveFillGrad.addColorStop(0, themeColors.curveFillTop);
      curveFillGrad.addColorStop(1, themeColors.curveFillBottom);
      ctx.fillStyle = curveFillGrad;
      ctx.fill();

      // 6. Draw Interactive Draggable EQ Nodes
      const drawNode = (freq, gainDb, label, nodeColor, isHovered, isDragging) => {
        const nx = freqToX(freq, width);
        const ny = dbToY(gainDb, height);

        // Outer pulsing target ring when hovered or active
        if (isHovered || isDragging) {
          ctx.beginPath();
          ctx.arc(nx, ny, 16, 0, Math.PI * 2);
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Drop shadow & Halo
        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = isDragging ? 16 : isHovered ? 12 : 6;

        // Solid node core
        ctx.beginPath();
        ctx.arc(nx, ny, isDragging ? 7.5 : isHovered ? 6.5 : 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = nodeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Label flag above node
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#cbd5e1';
        const txt = `${label}: ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)}dB`;
        ctx.fillText(txt, nx - 20, ny - 12);
      };

      drawNode(
        BASS_FREQ,
        bass,
        'BASS',
        themeColors.nodeBass,
        hoveredNode === 'bass',
        activeDragNode === 'bass'
      );

      drawNode(
        TREBLE_FREQ,
        treble,
        'TREBLE',
        themeColors.nodeTreble,
        hoveredNode === 'treble',
        activeDragNode === 'treble'
      );

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [eqVersion, bass, treble, themeColors, freqToX, dbToY, hoveredNode, activeDragNode]);

  return (
    <div className="visualizer-wrapper" ref={containerRef}>
      {/* Top Header / Theme Switcher Bar */}
      <div className="visualizer-top-bar">
        <div className="visualizer-status-badge">
          <Crosshair size={13} className="text-cyan animate-pulse" />
          <span>PARAMETRIC H(s) TRANSFER CURVE • DRAGGABLE NODES</span>
        </div>

        <div className="visualizer-theme-pills">
          <Palette size={13} style={{ color: '#94a3b8', marginRight: '4px' }} />
          {Object.entries(VISUALIZER_THEMES).map(([k, t]) => (
            <button
              key={k}
              className={`theme-pill ${theme === k ? 'active' : ''}`}
              onClick={() => selectTheme(k)}
              title={t.name}
            >
              <span className="theme-pill-dot" style={{ background: t.curveStroke }} />
              <span className="theme-pill-label">{t.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={`visualizer-canvas ${activeDragNode ? 'is-dragging' : hoveredNode ? 'is-hovered' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Realtime Floating HUD Tooltip */}
      {hudInfo && (
        <div
          className="visualizer-hud-tooltip"
          style={{
            left: `${hudInfo.x}px`,
            top: `${Math.max(25, hudInfo.y - 45)}px`,
          }}
        >
          <div className="hud-line-1">{hudInfo.name}</div>
          <div className="hud-line-2">
            <span>{hudInfo.freq}</span>
            <span className="hud-gain">{hudInfo.gain}</span>
          </div>
        </div>
      )}

      {/* Footer Info / Legend */}
      <div className="visualizer-overlay-info">
        <div className="legend-item">
          <div
            className="legend-color legend-curve"
            style={{ background: themeColors.curveStroke, boxShadow: `0 0 8px ${themeColors.curveStroke}` }}
          />
          <span>Parametric Biquad Curve (dB)</span>
        </div>
        <div className="legend-item">
          <div
            className="legend-color legend-spectrum"
            style={{ background: themeColors.barTop }}
          />
          <span>Real-time Audio FFT (1024)</span>
        </div>
        <div className="legend-hint">
          <Sparkles size={11} style={{ marginRight: '4px' }} />
          <span>Drag BASS & TREBLE nodes directly on curve</span>
        </div>
      </div>
    </div>
  );
}
