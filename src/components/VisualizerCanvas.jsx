import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../audio/AudioEngine';

// Frequency test points logarithmically distributed between 20Hz and 20000Hz
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

export function VisualizerCanvas({ eqVersion }) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Spectrum buffer
    const fftBuffer = new Uint8Array(128);

    // Peak hold array for spectrum bars
    const peakHold = new Float32Array(128).fill(0);

    const render = () => {
      // Handle high-DPI
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

      // 1. Background
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      // Helper functions for logarithmic mapping
      const freqToX = (f) => {
        const logMin = Math.log10(MIN_FREQ);
        const logMax = Math.log10(MAX_FREQ);
        return ((Math.log10(f) - logMin) / (logMax - logMin)) * width;
      };

      const dbToY = (db) => {
        // Range: +15 dB to -15 dB
        const minDb = -15;
        const maxDb = 15;
        const clamped = Math.max(minDb, Math.min(maxDb, db));
        const normalized = (clamped - minDb) / (maxDb - minDb);
        return height - normalized * height;
      };

      // 2. Draw dB grid lines
      DB_TICKS.forEach((db) => {
        const y = dbToY(db);
        ctx.beginPath();
        ctx.strokeStyle = db === 0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = db === 0 ? 1.5 : 1;
        if (db !== 0) ctx.setLineDash([4, 4]);
        else ctx.setLineDash([]);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = db === 0 ? '#94a3b8' : '#475569';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, 8, y - 3);
      });

      // 3. Draw Frequency grid lines
      FREQ_TICKS.forEach((f) => {
        const x = freqToX(f);
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        ctx.fillStyle = '#475569';
        ctx.font = '9px "JetBrains Mono", monospace';
        const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
        ctx.fillText(label, x + 3, height - 8);
      });

      // 4. Draw Real-Time Spectrum Analyzer Bars
      audioEngine.getSpectrumData(fftBuffer);
      const numBars = 56;
      const barSpacing = width / numBars;
      const barWidth = Math.max(3, barSpacing - 2.5);

      for (let i = 0; i < numBars; i++) {
        // Map bar index logarithmically to FFT frequency bins
        const binIndex = Math.floor(Math.pow(i / numBars, 1.6) * (fftBuffer.length - 1));
        const val = fftBuffer[binIndex] || 0;
        const normalizedVal = val / 255;
        const barHeight = normalizedVal * (height * 0.7);

        // Peak decay
        if (barHeight > peakHold[i]) {
          peakHold[i] = barHeight;
        } else {
          peakHold[i] = Math.max(0, peakHold[i] - 0.7);
        }

        const x = i * barSpacing + 2;
        const y = height - barHeight;

        // Bar gradient
        const barGrad = ctx.createLinearGradient(0, y, 0, height);
        barGrad.addColorStop(0, 'rgba(6, 182, 212, 0.65)');
        barGrad.addColorStop(1, 'rgba(99, 102, 241, 0.1)');

        ctx.fillStyle = barGrad;
        ctx.fillRect(x, y, barWidth, barHeight);

        // Peak cap
        if (peakHold[i] > 2) {
          ctx.fillStyle = 'rgba(165, 180, 252, 0.9)';
          ctx.fillRect(x, height - peakHold[i] - 2, barWidth, 1.5);
        }
      }

      // 5. Draw Composite EQ Frequency Response Curve
      const dbResponses = audioEngine.getCombinedFrequencyResponse(TEST_FREQUENCIES);

      // Curve Path
      ctx.beginPath();
      for (let i = 0; i < NUM_CURVE_POINTS; i++) {
        const x = freqToX(TEST_FREQUENCIES[i]);
        const y = dbToY(dbResponses[i]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }

      // Glowing stroke
      ctx.shadowColor = 'rgba(99, 102, 241, 0.8)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // Soft fill under the curve
      ctx.lineTo(width, dbToY(0));
      ctx.lineTo(0, dbToY(0));
      ctx.closePath();

      const curveFillGrad = ctx.createLinearGradient(0, 0, 0, height);
      curveFillGrad.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
      curveFillGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.05)');
      curveFillGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      ctx.fillStyle = curveFillGrad;
      ctx.fill();

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [eqVersion]);

  return (
    <div className="visualizer-wrapper">
      <canvas ref={canvasRef} className="visualizer-canvas" />
      <div className="visualizer-overlay-info">
        <div className="legend-item">
          <div className="legend-color legend-curve" />
          <span>EQ Response (dB)</span>
        </div>
        <div className="legend-item">
          <div className="legend-color legend-spectrum" />
          <span>Live Audio FFT</span>
        </div>
        <span>20 Hz – 20 kHz</span>
      </div>
    </div>
  );
}
