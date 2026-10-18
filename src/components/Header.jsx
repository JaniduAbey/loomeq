import React from 'react';
import { Sliders, Cast, Volume2, VolumeX, Sparkles, Bell, X, Share2, Radio } from 'lucide-react';

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
          <Sliders size={18} color="#020304" />
        </div>
        <div className="brand-title-group">
          <span className="brand-name">AuraEQ</span>
        </div>
      </div>

      {/* Target Speaker Pill & Quick Actions */}
      <div className="header-center">
        <button
          className="device-pill"
          onClick={onOpenDeviceModal}
          title="Click to scan or switch speaker"
        >
          <span className={`status-dot ${isDeviceConnected ? 'connected' : 'disconnected'}`} />
          <Cast size={13} className="device-icon" />
          <span className="device-name">{activeDevice.name}</span>
          <span className="device-ip">{activeDevice.ip}</span>
        </button>

        {isDeviceConnected ? (
          <div className="device-quick-actions">
            <button
              className="btn-pill-action"
              onClick={onPlayChime}
              title="Test Google Home connection chime"
            >
              <Bell size={12} />
              <span>Chime</span>
            </button>
            <button
              className="btn-pill-action disconnect"
              onClick={onDisconnect}
              title="Disconnect speaker"
            >
              <X size={12} />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <button
            className="btn-connect"
            onClick={onConnect}
            disabled={isConnecting}
          >
            <Cast size={12} className={isConnecting ? 'animate-spin' : ''} />
            <span>{isConnecting ? 'Connecting...' : 'Connect'}</span>
          </button>
        )}
      </div>

      {/* Right Actions: Presets, A/B Bypass, Export */}
      <div className="header-actions">
        {/* Presets Button */}
        <button
          className="header-btn"
          onClick={onOpenPresetModal}
          title="Load or save sound profiles"
        >
          <Sparkles size={13} className="text-lime" />
          <span>{activePreset ? activePreset.name : 'Preset'}</span>
        </button>

        {/* Single A/B Bypass Toggle */}
        <button
          className={`bypass-pill ${isBypassed ? 'bypassed' : 'active'}`}
          onClick={onToggleBypass}
          title={isBypassed ? 'EQ Bypassed (Flat)' : 'EQ Engaged'}
        >
          {isBypassed ? <VolumeX size={13} /> : <Volume2 size={13} />}
          <span>{isBypassed ? 'Bypassed' : 'EQ On'}</span>
        </button>

        {/* Export / Integrations */}
        <button
          className="header-btn-icon"
          onClick={onOpenExportModal}
          title="Export Eureka JSON / CamillaDSP / Python script"
        >
          <Share2 size={14} />
        </button>
      </div>
    </header>
  );
}
