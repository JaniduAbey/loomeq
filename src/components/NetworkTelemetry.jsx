import React, { useState, useEffect } from 'react';
import { Terminal, Trash2, Send, Activity, Wifi } from 'lucide-react';
import { deviceService } from '../services/deviceService';

export function NetworkTelemetry({ activeDevice, eqState, isDeviceConnected = true }) {
  const [logs, setLogs] = useState(deviceService.getLogs());

  useEffect(() => {
    const unsub = deviceService.subscribe(() => {
      setLogs([...deviceService.getLogs()]);
    });
    return unsub;
  }, []);

  const handleSyncNow = () => {
    deviceService.pushEqSettings(activeDevice, eqState);
  };

  const handleClear = () => {
    deviceService.clearLogs();
  };

  return (
    <div className="studio-card terminal-card">
      <div className="card-header" style={{ marginBottom: '10px' }}>
        <div className="card-title-group">
          <Terminal size={16} className="card-title-icon" />
          <h3 className="card-title">Live Device Telemetry</h3>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
            onClick={handleSyncNow}
            title="Push current EQ payload to speaker"
          >
            <Send size={12} />
          </button>
          <button
            className="btn-icon"
            style={{ width: '28px', height: '28px' }}
            onClick={handleClear}
            title="Clear log console"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={12} color={isDeviceConnected ? '#10b981' : '#94a3b8'} />
          <span style={{ color: isDeviceConnected ? '#34d399' : '#94a3b8', fontWeight: 600 }}>
            Status: {isDeviceConnected ? 'Connected' : 'Disconnected'}
          </span>
        </span>
        <span>•</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{activeDevice.ip}:{activeDevice.port}</span>
      </div>

      <div className="terminal-logs">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-subtle)', fontStyle: 'italic', padding: '8px 0' }}>
            Awaiting device communication... Adjust any slider or click Sync to transmit Cast EQ.
          </div>
        ) : (
          logs.map((log) => {
            const isSuccess = log.text.includes('200 OK') || log.text.includes('Discovered');
            const isCmd = log.text.includes('POST') || log.text.includes('WS');
            return (
              <div
                key={log.id}
                className={`terminal-line ${isSuccess ? 'success' : isCmd ? 'cmd' : ''}`}
              >
                {log.text}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
