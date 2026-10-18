import React, { useState } from 'react';
import { X, Sparkles, Plus, Trash2, Check, Download, Bookmark } from 'lucide-react';
import { presetService } from '../services/presetService';
import { downloadJsonFile } from '../services/exportService';

export function PresetManager({
  isOpen,
  onClose,
  activePresetId,
  onApplyPreset,
  currentEqState,
}) {
  const [presets, setPresets] = useState(presetService.getAllPresets());
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  if (!isOpen) return null;

  const handleSaveCurrent = (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    const saved = presetService.saveCustomPreset({
      name: customName,
      description: customDesc || 'User configured custom equalizer profile',
      bass: currentEqState.bass,
      treble: currentEqState.treble,
      bands10: currentEqState.bands10,
      bands5: currentEqState.bands5,
      acoustic: {
        roomPlacement: currentEqState.roomPlacement,
        dialogueBoost: currentEqState.dialogueBoost,
        dynamicBass: currentEqState.dynamicBass,
        nightMode: currentEqState.nightMode,
      },
    });

    setPresets(presetService.getAllPresets());
    onApplyPreset(saved);
    setCustomName('');
    setCustomDesc('');
    setShowSaveForm(false);
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    presetService.deleteCustomPreset(id);
    setPresets(presetService.getAllPresets());
  };

  const handleExportAll = () => {
    downloadJsonFile('auraeq_presets.json', presets);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#a5b4fc" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Equalizer Sound Profiles</h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Choose a calibrated profile or save your current tuning
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-outline"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                onClick={() => setShowSaveForm(!showSaveForm)}
              >
                <Plus size={13} />
                <span>Save Current</span>
              </button>
              <button
                className="btn-outline"
                style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                onClick={handleExportAll}
                title="Download all presets as JSON"
              >
                <Download size={13} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Save Preset Form */}
          {showSaveForm && (
            <form
              onSubmit={handleSaveCurrent}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bookmark size={15} color="#818cf8" />
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Save Current Custom Profile</span>
              </div>
              <input
                type="text"
                required
                placeholder="Profile Name (e.g. My Warm Soundbar)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                style={{
                  background: '#0c0f17',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '0.82rem',
                }}
              />
              <input
                type="text"
                placeholder="Short description (optional)"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                style={{
                  background: '#0c0f17',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '7px 10px',
                  fontSize: '0.82rem',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn-outline" onClick={() => setShowSaveForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '6px 14px' }}>
                  Save Profile
                </button>
              </div>
            </form>
          )}

          {/* Preset Cards List */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {presets.map((preset) => {
              const isSelected = activePresetId === preset.id;
              const isCustom = preset.id.startsWith('custom-');

              return (
                <div
                  key={preset.id}
                  onClick={() => {
                    onApplyPreset(preset);
                    onClose();
                  }}
                  style={{
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.16)' : 'var(--bg-surface-elevated)',
                    border: `1px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff' }}>
                        {preset.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#a5b4fc',
                        }}
                      >
                        {preset.category}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                      {preset.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    <span>
                      Bass: {preset.bass > 0 ? `+${preset.bass}` : preset.bass}dB | Treble: {preset.treble > 0 ? `+${preset.treble}` : preset.treble}dB
                    </span>
                    {isCustom && (
                      <button
                        className="btn-icon"
                        style={{ width: '24px', height: '24px', color: '#f43f5e' }}
                        onClick={(e) => handleDelete(preset.id, e)}
                        title="Delete custom preset"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
