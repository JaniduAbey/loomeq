import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';

const SEGMENTS = 20;

// dB markings for the meter scale
const SCALE_MARKERS = [
  { db: '+3', pct: 95, color: '#ef4444' },
  { db: '0', pct: 85, color: '#f59e0b' },
  { db: '-6', pct: 68, color: '#22c55e' },
  { db: '-12', pct: 50, color: '#22c55e' },
  { db: '-24', pct: 30, color: '#22c55e' },
  { db: '-48', pct: 10, color: '#22c55e' },
];

export function MeterBridge() {
  const canvasRef = useRef(null);
  const [meterDb, setMeterDb] = useState({ l: '-inf', r: '-inf' });
  const [clipAlert, setClipAlert] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let peakL = 0;
    let peakR = 0;
    let animId;
    let lastClipTime = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Fetch stereo levels from AudioEngine
      const levels = audioEngine.getStereoMeterLevels();
      const rawL = levels.leftPeak || 0;
      const rawR = levels.rightPeak || 0;

      // Peak decay
      peakL = Math.max(rawL, peakL - 0.012);
      peakR = Math.max(rawR, peakR - 0.012);

      if (rawL > 0.98 || rawR > 0.98) {
        lastClipTime = Date.now();
        setClipAlert(true);
      } else if (Date.now() - lastClipTime > 800) {
        setClipAlert(false);
      }

      // Convert amplitude to dB for readout
      const toDb = (amp) => {
        if (amp < 0.001) return '-inf';
        const db = 20 * Math.log10(amp);
        return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
      };
      setMeterDb({ l: toDb(rawL), r: toDb(rawR) });

      // Draw two vertical LED ladders
      const chWidth = (w - 18) / 2;
      const drawChannel = (startX, rmsLevel, peakLevel) => {
        const segHeight = (h - 24) / SEGMENTS;
        const gap = 2;

        for (let i = 0; i < SEGMENTS; i++) {
          const segIndexFromBottom = i;
          const segNorm = (segIndexFromBottom + 1) / SEGMENTS;
          const y = h - 16 - (i + 1) * segHeight;

          const isRmsLit = rmsLevel >= segNorm;
          const isPeakLit = peakLevel >= segNorm && peakLevel < segNorm + (1 / SEGMENTS) * 1.5;

          // Determine color based on threshold
          let activeColor, offColor, glowColor;
          if (segNorm > 0.88) {
            // Clip zone (Red)
            activeColor = '#ef4444';
            offColor = 'rgba(239, 68, 68, 0.12)';
            glowColor = 'rgba(239, 68, 68, 0.7)';
          } else if (segNorm > 0.7) {
            // Warning zone (Amber)
            activeColor = '#f59e0b';
            offColor = 'rgba(245, 158, 11, 0.12)';
            glowColor = 'rgba(245, 158, 11, 0.5)';
          } else {
            // Safe zone (Green)
            activeColor = '#10b981';
            offColor = 'rgba(16, 185, 129, 0.1)';
            glowColor = 'rgba(16, 185, 129, 0.4)';
          }

          if (isPeakLit) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 6;
            ctx.fillRect(startX, y, chWidth, segHeight - gap);
            ctx.shadowBlur = 0;
          } else if (isRmsLit) {
            ctx.fillStyle = activeColor;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 4;
            ctx.fillRect(startX, y, chWidth, segHeight - gap);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = offColor;
            ctx.fillRect(startX, y, chWidth, segHeight - gap);
          }
        }
      };

      // Draw Left and Right channels
      drawChannel(0, levels.leftRms, peakL);
      drawChannel(chWidth + 18, levels.rightRms, peakR);

      // Channel Labels
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText('L', chWidth / 2, h - 3);
      ctx.fillText('R', chWidth + 18 + chWidth / 2, h - 3);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="meter-bridge-card">
      <div className="meter-bridge-header">
        <div className="meter-title-wrap">
          <span className="meter-badge">VU STEREO</span>
          <span className="meter-title">MASTER OUT</span>
        </div>
        <div className={`clip-indicator ${clipAlert ? 'active' : ''}`}>
          CLIP
        </div>
      </div>

      <div className="meter-stage">
        <canvas ref={canvasRef} className="meter-canvas" />

        {/* Center scale markings */}
        <div className="meter-scale-markers">
          {SCALE_MARKERS.map((m, idx) => (
            <div
              key={idx}
              className="scale-marker"
              style={{ bottom: `${m.pct}%`, color: m.color }}
            >
              <span>{m.db}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="meter-readout-row">
        <div className="meter-ch-val">
          <span className="ch-tag">L</span>
          <span className="ch-num">{meterDb.l}</span>
        </div>
        <div className="meter-ch-val">
          <span className="ch-tag">R</span>
          <span className="ch-num">{meterDb.r}</span>
        </div>
      </div>
    </div>
  );
}
