import React, { useState } from 'react';
import { X, Code, Copy, Check, Terminal, Cpu, Info, Send } from 'lucide-react';
import {
  generateGoogleHomePayload,
  generatePythonPyChromecast,
  generateCamillaDspConfig,
  generateCurlCommand,
} from '../services/exportService';
import { deviceService } from '../services/deviceService';

export function DevIntegrationModal({ isOpen, onClose, activeDevice, eqState }) {
  const [activeTab, setActiveTab] = useState('curl');
  const [copied, setCopied] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  if (!isOpen) return null;

  const curlCode = generateCurlCommand(activeDevice.ip, eqState.bass, eqState.treble);
  const jsonPayload = generateGoogleHomePayload(eqState.bass, eqState.treble);
  const pythonCode = generatePythonPyChromecast(activeDevice.name, eqState.bass, eqState.treble);
  const camillaYaml = generateCamillaDspConfig(
    eqState.bands10,
    eqState.roomPlacement,
    eqState.nightMode
  );

  const getActiveCode = () => {
    switch (activeTab) {
      case 'curl':
        return curlCode;
      case 'json':
        return jsonPayload;
      case 'python':
        return pythonCode;
      case 'camilla':
        return camillaYaml;
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestSend = async () => {
    setSendResult('Transmitting Eureka API payload to device...');
    await deviceService.pushEqSettings(activeDevice, eqState);
    setSendResult(`Payload dispatched to ${activeDevice.ip}:8008. Check network log.`);
    setTimeout(() => setSendResult(null), 3500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: '720px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code size={20} color="#818cf8" />
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Google Home & Smart Speaker Integration</h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Direct API commands, Python script, and DSP configs
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Explanation Banner */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}
          >
            <Info size={18} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.75rem', lineHeight: '1.45', color: '#cbd5e1' }}>
              <strong>How Google Home EQ works:</strong> Google Home and Nest Audio speakers run the
              Google Cast Eureka local API service on <code>port 8008</code>. The official EQ adjustment
              range is <strong>-6.0 dB to +6.0 dB</strong> for Bass and Treble. Submitting a POST
              request to <code>/setup/set_eureka_info</code> immediately reconfigures the speaker's internal DSP.
            </div>
          </div>

          {/* Code Tabs */}
          <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <button
              className={`tab-btn ${activeTab === 'curl' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('curl')}
            >
              <Terminal size={13} />
              <span>cURL (Eureka API)</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'json' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('json')}
            >
              <span>JSON Payload</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'python' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('python')}
            >
              <span>Python (pychromecast)</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'camilla' ? 'active' : ''}`}
              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('camilla')}
            >
              <Cpu size={13} />
              <span>CamillaDSP (YAML)</span>
            </button>
          </div>

          {/* Active Code Block */}
          <div style={{ position: 'relative' }}>
            <pre className="code-box">{getActiveCode()}</pre>
            <button
              className="btn-outline"
              onClick={handleCopy}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                padding: '6px 10px',
                fontSize: '0.75rem',
                background: 'rgba(15, 20, 34, 0.85)',
              }}
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              <span>{copied ? 'Copied!' : 'Copy Code'}</span>
            </button>
          </div>

          {sendResult && (
            <div style={{ fontSize: '0.75rem', color: '#34d399', fontFamily: 'var(--font-mono)' }}>
              {sendResult}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn-outline" onClick={handleTestSend} title="Send POST request to active speaker">
            <Send size={14} />
            <span>Push Live to {activeDevice.name}</span>
          </button>
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
