import React from 'react';
import { Sliders, Cast, Code, RefreshCw, Volume2, VolumeX, Sparkles, Radio } from 'lucide-react';

export function Header({
  activeDevice,
  isDeviceConnected = true,
  isConnecting = false,
  onConnect,
  onDisconnect,
  onOpenDeviceModal,
  onOpenExportModal,
  isBypassed,
  onToggleBypass,
  activePreset,
  onOpenPresetModal,
  onPlayChime,
}) {
  return (
    <header className="app-header">
      {/* Brand */}
      <div className="brand-section">
        <div className="brand-icon-wrapper">
          <Sliders size={22} color="#ffffff" />
        </div>
        <div className="brand-title-group">
          <h1>
            AuraEQ
            <span className="brand-badge">Smart Cast DSP</span>
          </h1>
          <p className="brand-subtitle">Google Home & Wireless Speaker Custom Equalizer</p>
        </div>
      </div>

      {/* Target Device Selector & Connection Buttons */}
      <div className="header-center">
        <button
          className="device-selector-btn"
          onClick={onOpenDeviceModal}
          title="Change or configure wireless speaker target"
        >
          <div className={isDeviceConnected ? 'device-live-dot' : 'device-idle-dot'} />
          <Cast size={15} color={isDeviceConnected ? '#818cf8' : '#64748b'} />
          <span>{activeDevice.name}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>({activeDevice.ip})</span>
          <span
            style={{
              fontSize: '0.66rem',
              padding: '2px 8px',
              borderRadius: '10px',
              fontWeight: 600,
              background: isDeviceConnected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.12)',
              color: isDeviceConnected ? '#4ade80' : '#94a3b8',
              border: `1px solid ${isDeviceConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(148, 163, 184, 0.2)'}`,
              marginLeft: '4px',
            }}
          >
            {isDeviceConnected ? 'Connected' : 'Disconnected'}
          </span>
        </button>

        {activeDevice.ip && activeDevice.ip !== '192.168.1.x' && (
          isDeviceConnected ? (
            <>
              <button
                className="btn-outline"
                style={{ padding: '6px 12px', fontSize: '0.78rem', borderColor: 'rgba(99,102,241,0.35)' }}
                onClick={onPlayChime}
                title="Sound Google Cast connection chime on your physical speaker"
              >
                <Radio size={13} color="#818cf8" />
                <span>Play Chime 🔔</span>
              </button>

              <button
                className="btn-outline"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#fca5a5',
                  cursor: 'pointer',
                }}
                onClick={onDisconnect}
                title="Disconnect from Google Home speaker"
              >
                <span style={{ fontWeight: 700 }}>✕</span>
                <span>Disconnect</span>
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              style={{
                padding: '6px 14px',
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 0 14px rgba(99, 102, 241, 0.4)',
                cursor: 'pointer',
              }}
              onClick={onConnect}
              disabled={isConnecting}
              title="Connect to physical Google Home speaker"
            >
              <Cast size={14} className={isConnecting ? 'animate-spin' : ''} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Speaker 🔗'}</span>
            </button>
          )
        )}
      </div>

      {/* Actions */}
      <div className="header-actions">
        {/* A/B Bypass Button */}
        <button
          className={`bypass-toggle-btn ${isBypassed ? 'bypassed' : 'active'}`}
          onClick={onToggleBypass}
          title={isBypassed ? 'EQ Bypassed (Playing Flat Reference)' : 'EQ Engaged'}
        >
          {isBypassed ? <VolumeX size={14} /> : <Volume2 size={14} />}
          <span>{isBypassed ? 'A/B: FLAT (BYPASS)' : 'A/B: EQ ENGAGED'}</span>
        </button>

        {/* Preset Button */}
        <button
          className="btn-outline"
          onClick={onOpenPresetModal}
          title="Open EQ preset library"
        >
          <Sparkles size={15} color="#a5b4fc" />
          <span>Preset: {activePreset ? activePreset.name : 'Custom'}</span>
        </button>

        {/* Code & Export Integration */}
        <button
          className="btn-primary"
          onClick={onOpenExportModal}
          title="Export Eureka JSON, Python Cast script & CamillaDSP"
        >
          <Code size={15} />
          <span>Cast / API Export</span>
        </button>
      </div>
    </header>
  );
}
