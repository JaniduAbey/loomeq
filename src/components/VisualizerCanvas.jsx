import React, { useRef, useEffect, useState, useCallback } from 'react';
import { audioEngine } from '../audio/AudioEngine';

const NUM_CURVE_POINTS = 160;
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
  lime: {
    id: 'lime',
    name: 'Lime Green',
    curveStroke: '#10f27c',
    curveGlow: 'rgba(16, 242, 124, 0.7)',
    curveFillTop: 'rgba(16, 242, 124, 0.18)',
    curveFillBottom: 'rgba(16, 242, 124, 0.0)',
    barTop: 'rgba(16, 242, 124, 0.9)',
    barBottom: 'rgba(5, 150, 105, 0.12)',
    peakCap: '#ffffff',
    nodeBass: '#10f27c',
    nodeTreble: '#34d399',
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Cyan',
    curveStroke: '#06b6d4',
    curveGlow: 'rgba(6, 182, 212, 0.7)',
    curveFillTop: 'rgba(6, 182, 212, 0.18)',
    curveFillBottom: 'rgba(6, 182, 212, 0.0)',
    barTop: 'rgba(6, 182, 212, 0.85)',
    barBottom: 'rgba(8, 145, 178, 0.1)',
    peakCap: '#ffffff',
    nodeBass: '#06b6d4',
    nodeTreble: '#38bdf8',
  },
  amber: {
    id: 'amber',
    name: 'Warm Gold',
    curveStroke: '#fbbf24',
    curveGlow: 'rgba(251, 191, 36, 0.7)',
    curveFillTop: 'rgba(245, 158, 11, 0.18)',
    curveFillBottom: 'rgba(245, 158, 11, 0.0)',
    barTop: 'rgba(245, 158, 11, 0.85)',
    barBottom: 'rgba(180, 83, 9, 0.1)',
    peakCap: '#ffffff',
    nodeBass: '#f59e0b',
    nodeTreble: '#fbbf24',
  },
  mono: {
    id: 'mono',
    name: 'Pure White',
    curveStroke: '#f8fafc',
    curveGlow: 'rgba(255, 255, 255, 0.6)',
    curveFillTop: 'rgba(255, 255, 255, 0.12)',
    curveFillBottom: 'rgba(255, 255, 255, 0.0)',
    barTop: 'rgba(241, 245, 249, 0.85)',
    barBottom: 'rgba(148, 163, 184, 0.08)',
    peakCap: '#ffffff',
    nodeBass: '#f8fafc',
    nodeTreble: '#cbd5e1',
  },
};

export function VisualizerCanvas({
  eqVersion,
  bass = 0,
  treble = 0,
  onChangeBass,
  onChangeTreble,
  activeTheme = 'lime',
  onThemeChange,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const [theme, setTheme] = useState(activeTheme);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [activeDragNode, setActiveDragNode] = useState(null);
  const [hudInfo, setHudInfo] = useState(null);

  const themeColors = VISUALIZER_THEMES[theme] || VISUALIZER_THEMES.lime;

  const BASS_FREQ = 160;
  const TREBLE_FREQ = 3200;

  const freqToX = useCallback((f, width) => {
    const logMin = Math.log10(MIN_FREQ);
    const logMax = Math.log10(MAX_FREQ);
    return ((Math.log10(f) - logMin) / (logMax - logMin)) * width;
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

    if (Math.hypot(clickX - bassX, clickY - bassY) < 26) {
      setActiveDragNode('bass');
      e.target.setPointerCapture?.(e.pointerId);
    } else if (Math.hypot(clickX - trebleX, clickY - trebleY) < 26) {
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
          name: 'BASS',
          freq: '160 Hz',
          gain: `${clampedDb >= 0 ? '+' : ''}${clampedDb.toFixed(1)} dB`,
          x: freqToX(BASS_FREQ, rect.width),
          y: dbToY(clampedDb, rect.height),
        });
      } else if (activeDragNode === 'treble' && onChangeTreble) {
        onChangeTreble(clampedDb);
        setHudInfo({
          name: 'TREBLE',
          freq: '3.2 kHz',
          gain: `${clampedDb >= 0 ? '+' : ''}${clampedDb.toFixed(1)} dB`,
          x: freqToX(TREBLE_FREQ, rect.width),
          y: dbToY(clampedDb, rect.height),
        });
      }
      return;
    }

    const bassX = freqToX(BASS_FREQ, rect.width);
    const bassY = dbToY(bass, rect.height);
    const trebleX = freqToX(TREBLE_FREQ, rect.width);
    const trebleY = dbToY(treble, rect.height);

    if (Math.hypot(currX - bassX, currY - bassY) < 20) {
      setHoveredNode('bass');
      setHudInfo({
        name: 'BASS',
        freq: '160 Hz',
        gain: `${bass >= 0 ? '+' : ''}${bass.toFixed(1)} dB`,
        x: bassX,
        y: bassY,
      });
    } else if (Math.hypot(currX - trebleX, currY - trebleY) < 20) {
      setHoveredNode('treble');
      setHudInfo({
        name: 'TREBLE',
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

      // 1. OLED Pure Black Background
      ctx.fillStyle = '#020304';
      ctx.fillRect(0, 0, width, height);

      // Subtle grid
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      for (let x = 0; x < width; x += 20) {
        ctx.fillRect(x, 0, 1, height);
      }

      // 2. dB Reference Grid lines
      DB_TICKS.forEach((db) => {
        const y = dbToY(db, height);
        ctx.beginPath();
        ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = db === 0 ? 1.2 : 1;
        if (db !== 0) ctx.setLineDash([3, 4]);
        else ctx.setLineDash([]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = db === 0 ? '#94a3b8' : '#334155';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 8, y - 3);
      });

      // 3. Frequency Reference Lines & Ticks (drawn above bottom bar to prevent overlap!)
      FREQ_TICKS.forEach((f) => {
        const x = freqToX(f, width);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#3f4e62';
        ctx.font = '8px "JetBrains Mono", monospace';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(label, x + 3, height - 28);
      });

      // 4. Real-Time Spectrum Analyzer Bars
      audioEngine.getSpectrumData(fftBuffer);
      const numBars = 56;
      const barSpacing = width / numBars;
      const barWidth = Math.max(2.5, barSpacing - 2);

      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor(Math.pow(i / numBars, 1.55) * (fftBuffer.length - 1));
        const val = fftBuffer[binIndex] || 0;
        const normalizedVal = val / 255;
        const barHeight = normalizedVal * (height * 0.7);

        if (barHeight > peakHold[i]) {
          peakHold[i] = barHeight;
        } else {
          peakHold[i] = Math.max(0, peakHold[i] - 0.7);
        }

        const x = i * barSpacing + 2;
        const y = height - barHeight;

        const barGrad = ctx.createLinearGradient(0, y, 0, height);
        barGrad.addColorStop(0, themeColors.barTop);
        barGrad.addColorStop(1, themeColors.barBottom);

        ctx.fillStyle = barGrad;
        ctx.fillRect(x, y, barWidth, barHeight);

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

      ctx.shadowColor = themeColors.curveGlow;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = themeColors.curveStroke;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.lineTo(width, dbToY(0, height));
      ctx.lineTo(0, dbToY(0, height));
      ctx.closePath();

      const curveFillGrad = ctx.createLinearGradient(0, 0, 0, height);
      curveFillGrad.addColorStop(0, themeColors.curveFillTop);
      curveFillGrad.addColorStop(1, themeColors.curveFillBottom);
      ctx.fillStyle = curveFillGrad;
      ctx.fill();

      // 6. Interactive Draggable Nodes
      const drawNode = (freq, gainDb, label, nodeColor, isHovered, isDragging) => {
        const nx = freqToX(freq, width);
        const ny = dbToY(gainDb, height);

        if (isHovered || isDragging) {
          ctx.beginPath();
          ctx.arc(nx, ny, 14, 0, Math.PI * 2);
          ctx.strokeStyle = nodeColor;
          ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.shadowColor = nodeColor;
        ctx.shadowBlur = isDragging ? 14 : isHovered ? 10 : 5;

        ctx.beginPath();
        ctx.arc(nx, ny, isDragging ? 6.5 : isHovered ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#020304';
        ctx.fill();
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = nodeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = nodeColor;
        ctx.textAlign = 'center';
        const txt = `${label} ${gainDb >= 0 ? '+' : ''}${gainDb.toFixed(1)}dB`;
        const textY = ny < 28 ? ny + 16 : ny - 10;
        ctx.fillText(txt, nx, textY);
        ctx.textAlign = 'start';
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
      {/* Top Header / Theme Dots */}
      <div className="visualizer-top-bar">
        <div className="visualizer-status-badge">
          <span className="live-dot-lime" />
          <span>REALTIME H(s) SPECTRUM</span>
        </div>

        <div className="visualizer-theme-pills">
          {Object.entries(VISUALIZER_THEMES).map(([k, t]) => (
            <button
              key={k}
              className={`theme-dot-btn ${theme === k ? 'active' : ''}`}
              onClick={() => selectTheme(k)}
              title={t.name}
            >
              <span className="theme-dot" style={{ background: t.curveStroke }} />
              <span className="theme-name">{t.name.split(' ')[0]}</span>
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

      {/* Floating HUD Tooltip */}
      {hudInfo && (
        <div
          className="visualizer-hud-tooltip"
          style={{
            left: `${hudInfo.x}px`,
            top: `${Math.max(20, hudInfo.y - 40)}px`,
          }}
        >
          <div className="hud-gain">{hudInfo.name} {hudInfo.gain}</div>
          <div className="hud-freq">{hudInfo.freq}</div>
        </div>
      )}

      {/* Minimalist Legend Footer Bar (no overlaps!) */}
      <div className="visualizer-overlay-info">
        <div className="legend-item">
          <div className="legend-color" style={{ background: themeColors.curveStroke }} />
          <span>Biquad Curve</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: themeColors.barTop }} />
          <span>Live FFT</span>
        </div>
        <div className="legend-hint">
          <span>Drag nodes on curve to sculpt</span>
        </div>
      </div>
    </div>
  );
}
