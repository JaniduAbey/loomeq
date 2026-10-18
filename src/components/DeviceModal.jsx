import React, { useState, useEffect } from 'react';
import { X, Cast, Wifi, Plus, RefreshCw, CheckCircle, Server, Radio, ShieldCheck } from 'lucide-react';
import { deviceService } from '../services/deviceService';

export function DeviceModal({ isOpen, onClose, activeDevice, onSelectDevice }) {
  const [devices, setDevices] = useState(deviceService.getDevices());
  const [isScanning, setIsScanning] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customIp, setCustomIp] = useState('192.168.1.');
  const [customPort, setCustomPort] = useState('8008');

  useEffect(() => {
    const unsub = deviceService.subscribe(() => {
      setDevices([...deviceService.getDevices()]);
      setIsScanning(deviceService.isScanning);
    });
    return unsub;
  }, []);

  if (!isOpen) return null;

  const handleScan = async () => {
    setIsScanning(true);
    await deviceService.scanNetwork();
    setDevices([...deviceService.getDevices()]);
    setIsScanning(false);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customIp) return;
    const newDev = deviceService.addCustomDevice({
      name: customName || 'Custom Wireless Speaker',
      ip: customIp,
      port: customPort,
      type: 'google_home',
    });
    setDevices([...deviceService.getDevices()]);
    onSelectDevice(newDev);
    setShowAddForm(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Radio size={20} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Real Wireless Smart Speakers</h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Live mDNS discovery & CastV2 TLS endpoints on your Wi-Fi
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Active Physical Speakers Detected: <strong style={{ color: '#fff' }}>{devices.length}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-outline"
                onClick={handleScan}
                disabled={isScanning}
                style={{ fontSize: '0.78rem', padding: '6px 14px', background: isScanning ? 'rgba(99,102,241,0.2)' : 'transparent' }}
              >
                <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
                <span>{isScanning ? 'Probing Wi-Fi Subnet...' : 'Scan Real Wi-Fi Network'}</span>
              </button>
              <button
                className="btn-outline"
                onClick={() => setShowAddForm(!showAddForm)}
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              >
                <Plus size={13} />
                <span>Add IP</span>
              </button>
            </div>
          </div>

          {/* Add custom device form */}
          {showAddForm && (
            <form
              onSubmit={handleAddCustom}
              style={{
                background: 'var(--bg-surface-elevated)',
                padding: '14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                border: '1px solid var(--border-glass)',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Device Name</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Master Bedroom Nest"
                    style={{
                      width: '100%',
                      background: '#0c0f17',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>IP Address</label>
                  <input
                    type="text"
                    required
                    value={customIp}
                    onChange={(e) => setCustomIp(e.target.value)}
                    placeholder="192.168.1.12"
                    style={{
                      width: '100%',
                      background: '#0c0f17',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn-outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 14px' }}>
                  Connect Target
                </button>
              </div>
            </form>
          )}

          {/* Devices List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {devices.length === 0 ? (
              <div
                style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px dashed var(--border-glass)',
                }}
              >
                <RefreshCw size={24} className="animate-spin" color="#818cf8" style={{ margin: '0 auto 12px auto' }} />
                <h4 style={{ fontSize: '0.9rem', marginBottom: '4px' }}>Scanning for Google Cast & Smart Speakers...</h4>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Listening for mDNS broadcasts and probing local subnet (192.168.1.0/24).
                </p>
              </div>
            ) : (
              devices.map((dev) => {
                const isSelected = activeDevice && activeDevice.ip === dev.ip;
                return (
                  <div
                    key={dev.id || dev.ip}
                    onClick={() => {
                      onSelectDevice(dev);
                      onClose();
                    }}
                    style={{
                      padding: '14px 18px',
                      borderRadius: 'var(--radius-lg)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-surface-elevated)',
                      border: `1px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--border-subtle)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: 'var(--radius-md)',
                          background: isSelected ? 'var(--color-brand-gradient)' : '#1a2234',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isSelected ? 'var(--glow-primary)' : 'none',
                        }}
                      >
                        <Radio size={20} color="#fff" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                            {dev.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <ShieldCheck size={11} />
                            <span>REAL PHYSICAL DEVICE</span>
                          </span>
                          {isSelected && <CheckCircle size={15} color="#818cf8" />}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span style={{ color: '#cbd5e1' }}>{dev.model}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{dev.ip} (Port {dev.castPort || 8009})</span>
                          <span>•</span>
                          <span>Source: {dev.discoverySource}</span>
                          {dev.ssid && (
                            <>
                              <span>•</span>
                              <span>Wi-Fi: {dev.ssid}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <div style={{ color: '#34d399', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Wifi size={13} />
                        <span>Connected</span>
                      </div>
                      
                      {/* Action buttons: Play Chime & Cast */}
                      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-outline"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            gap: '5px',
                          }}
                          onClick={() => {
                            deviceService.playSpeakerChime(dev);
                          }}
                          title="Sound connection chime on this speaker"
                        >
                          <Bell size={12} />
                          <span>Play Chime</span>
                        </button>

                        <button
                          className="btn-outline"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            gap: '5px',
                          }}
                          onClick={() => {
                            deviceService.castMediaToSpeaker(dev, 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', {
                              title: 'AuraEQ Live Audio Demo',
                              artist: 'Google Cast Speaker',
                            });
                          }}
                          title="Stream test audio to this speaker"
                        >
                          <Cast size={12} />
                          <span>Stream Test</span>
                        </button>

                        <button
                          className="btn-outline"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            borderRadius: '6px',
                            color: '#f87171',
                            gap: '5px',
                          }}
                          onClick={() => {
                            deviceService.disconnectSpeaker(dev);
                          }}
                          title="Disconnect from Google Home speaker"
                        >
                          <X size={12} />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-outline"
            onClick={handleScan}
            disabled={isScanning}
          >
            <RefreshCw size={13} className={isScanning ? 'animate-spin' : ''} />
            <span>Rescan Subnet</span>
          </button>
          <button className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
