// Equalizer Presets Service
// Includes Google Home defaults, acoustic calibration profiles, and user-saved presets.

export const FACTORY_PRESETS = [
  {
    id: 'flat',
    name: 'Flat / Studio Neutral',
    description: 'Completely uncolored reference response for balanced listening.',
    category: 'Reference',
    bass: 0,
    treble: 0,
    bands10: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    bands5: [0, 0, 0, 0, 0],
    acoustic: { roomPlacement: 'free', dialogueBoost: false, dynamicBass: false, nightMode: false },
  },
  {
    id: 'google-nest-warm',
    name: 'Google Nest Signature Warmth',
    description: 'Full-bodied sound signature tuned for Google Home / Nest Audio acoustics.',
    category: 'Smart Speaker',
    bass: 2.5,
    treble: 1.0,
    bands10: [2.5, 2.5, 2.0, 1.0, 0, 0, 0.5, 1.0, 1.2, 0.8],
    bands5: [2.5, 1.5, 0, 1.0, 1.0],
    acoustic: { roomPlacement: 'free', dialogueBoost: false, dynamicBass: true, nightMode: false },
  },
  {
    id: 'bass-heavy',
    name: 'Deep Bass & Club Punch',
    description: 'Accentuates sub-bass and kick drums without muddying upper mids.',
    category: 'Music',
    bass: 5.0,
    treble: 2.0,
    bands10: [6.0, 5.0, 3.5, 1.0, -1.0, -0.5, 0.5, 1.5, 2.5, 2.0],
    bands5: [5.5, 2.5, -0.5, 1.5, 2.0],
    acoustic: { roomPlacement: 'free', dialogueBoost: false, dynamicBass: true, nightMode: false },
  },
  {
    id: 'podcast-clarity',
    name: 'Podcast & Dialogue Clarity',
    description: 'Filters out low rumble and boosts intelligibility in voices and audiobooks.',
    category: 'Vocal',
    bass: -3.0,
    treble: 3.0,
    bands10: [-5.0, -3.5, -2.0, 0, 1.0, 2.5, 3.5, 3.0, 2.0, 1.0],
    bands5: [-4.0, -1.0, 2.0, 3.5, 1.5],
    acoustic: { roomPlacement: 'free', dialogueBoost: true, dynamicBass: false, nightMode: false },
  },
  {
    id: 'late-night',
    name: 'Late Night Cinema & TV',
    description: 'Dynamic range compression prevents loud jumps while keeping dialogue clear.',
    category: 'Living Room',
    bass: -2.0,
    treble: 0.5,
    bands10: [-3.0, -2.0, -1.0, 0, 1.5, 2.0, 2.0, 1.0, 0, -1.0],
    bands5: [-2.5, -0.5, 1.5, 1.5, -0.5],
    acoustic: { roomPlacement: 'free', dialogueBoost: true, dynamicBass: false, nightMode: true },
  },
  {
    id: 'acoustic-vocal',
    name: 'Acoustic & Classical Strings',
    description: 'Open soundstage, intimate vocals, and silky highs with clean air.',
    category: 'Music',
    bass: 1.0,
    treble: 2.5,
    bands10: [0.5, 1.0, 1.5, 1.0, 0.5, 1.0, 2.0, 2.5, 3.0, 2.5],
    bands5: [1.0, 1.2, 0.8, 2.2, 2.8],
    acoustic: { roomPlacement: 'free', dialogueBoost: false, dynamicBass: false, nightMode: false },
  },
  {
    id: 'corner-boundary',
    name: 'Corner Placement Compensator',
    description: 'Cuts artificial bass resonance when the smart speaker is placed in a corner.',
    category: 'Room Calibrated',
    bass: -4.0,
    treble: 1.0,
    bands10: [-5.5, -4.5, -3.0, -1.5, 0, 0, 0.5, 1.0, 1.0, 0.5],
    bands5: [-5.0, -2.0, 0, 1.0, 1.0],
    acoustic: { roomPlacement: 'corner', dialogueBoost: false, dynamicBass: false, nightMode: false },
  },
  {
    id: 'electronic-synth',
    name: 'Electronic / Synthwave',
    description: 'V-shaped curve with rich low end and shimmering bright synthesizer leads.',
    category: 'Music',
    bass: 4.0,
    treble: 3.5,
    bands10: [4.5, 4.0, 2.5, 0, -1.5, -1.0, 0.5, 2.5, 3.5, 4.0],
    bands5: [4.2, 1.0, -1.2, 2.5, 3.8],
    acoustic: { roomPlacement: 'free', dialogueBoost: false, dynamicBass: false, nightMode: false },
  },
];

const STORAGE_KEY = 'auraeq_user_presets_v1';

class PresetService {
  constructor() {
    this.customPresets = this.loadCustomPresets();
  }

  loadCustomPresets() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  getAllPresets() {
    return [...FACTORY_PRESETS, ...this.customPresets];
  }

  getPresetById(id) {
    return this.getAllPresets().find((p) => p.id === id) || FACTORY_PRESETS[0];
  }

  saveCustomPreset(preset) {
    const newPreset = {
      ...preset,
      id: 'custom-' + Date.now(),
      category: 'User Custom',
      createdAt: new Date().toISOString(),
    };
    this.customPresets.push(newPreset);
    this.persist();
    return newPreset;
  }

  deleteCustomPreset(id) {
    this.customPresets = this.customPresets.filter((p) => p.id !== id);
    this.persist();
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customPresets));
    } catch (e) {}
  }
}

export const presetService = new PresetService();
