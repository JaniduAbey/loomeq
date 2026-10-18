import React, { useRef, useEffect, useState } from 'react';
import { audioEngine } from '../audio/AudioEngine';

const SEGMENTS = 18;

const SCALE_MARKERS = [
  { db: '+3', pct: 95, color: '#f43f5e' },
  { db: '0', pct: 85, color: '#fbbf24' },
  { db: '-6', pct: 68, color: '#10f27c' },
  { db: '-12', pct: 50, color: '#10f27c' },
  { db: '-24', pct: 30, color: '#10f27c' },
  { db: '-48', pct: 10, color: '#10f27c' },
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

      const levels = audioEngine.getStereoMeterLevels();
      const rawL = levels.leftPeak || 0;
      const rawR = levels.rightPeak || 0;

      peakL = Math.max(rawL, peakL - 0.012);
      peakR = Math.max(rawR, peakR - 0.012);

      if (rawL > 0.98 || rawR > 0.98) {
        lastClipTime = Date.now();
        setClipAlert(true);
      } else if (Date.now() - lastClipTime > 800) {
        setClipAlert(false);
      }

      const toDb = (amp) => {
        if (amp < 0.001) return '-inf';
        const db = 20 * Math.log10(amp);
        return `${db >= 0 ? '+' : ''}${db.toFixed(1)}`;
      };
      setMeterDb({ l: toDb(rawL), r: toDb(rawR) });

      const chWidth = (w - 14) / 2;
      const drawChannel = (startX, rmsLevel, peakLevel) => {
        const segHeight = (h - 20) / SEGMENTS;
        const gap = 2;

        for (let i = 0; i < SEGMENTS; i++) {
          const segNorm = (i + 1) / SEGMENTS;
          const y = h - 14 - (i + 1) * segHeight;

          const isRmsLit = rmsLevel >= segNorm;
          const isPeakLit = peakLevel >= segNorm && peakLevel < segNorm + (1 / SEGMENTS) * 1.5;

          let activeColor, offColor, glowColor;
          if (segNorm > 0.88) {
            activeColor = '#f43f5e';
            offColor = 'rgba(244, 63, 94, 0.1)';
            glowColor = 'rgba(244, 63, 94, 0.7)';
          } else if (segNorm > 0.72) {
            activeColor = '#fbbf24';
            offColor = 'rgba(251, 191, 36, 0.1)';
            glowColor = 'rgba(251, 191, 36, 0.5)';
          } else {
            // Lime Green safe zone
            activeColor = '#10f27c';
            offColor = 'rgba(16, 242, 124, 0.08)';
            glowColor = 'rgba(16, 242, 124, 0.5)';
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

      drawChannel(0, levels.leftRms, peakL);
      drawChannel(chWidth + 14, levels.rightRms, peakR);

      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.fillText('L', chWidth / 2, h - 2);
      ctx.fillText('R', chWidth + 14 + chWidth / 2, h - 2);

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="meter-bridge-card">
      <div className="meter-bridge-header">
        <span className="meter-title">VU STEREO</span>
        <div className={`clip-indicator ${clipAlert ? 'active' : ''}`}>
          CLIP
        </div>
      </div>

      <div className="meter-stage">
        <canvas ref={canvasRef} className="meter-canvas" />

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
