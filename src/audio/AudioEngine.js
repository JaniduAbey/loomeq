// AuraEQ Real-Time Web Audio DSP Engine
// Provides multi-band biquad filtering, room acoustics, compressor, analyzer, and procedural audio synthesis.

export const STANDARD_FREQUENCIES_10 = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const STANDARD_FREQUENCIES_5 = [60, 250, 1000, 4000, 12000];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sourceNode = null;
    this.audioElement = null;
    this.synthLoopInterval = null;
    this.isPlaying = false;
    this.currentTrackId = 'funk_bass';
    this.isBypassed = false;
    this.masterVolume = 0.85;

    // Filter banks
    this.bandFilters = []; // 10-band graphic / smart filters
    this.roomFilter = null; // Room boundary compensation
    this.dialogueFilter = null; // Vocal presence boost
    this.bassBoostFilter = null; // Smart dynamic bass boost
    this.compressorNode = null; // Night mode compressor
    this.dryGainNode = null;
    this.wetGainNode = null;
    this.pannerNode = null;
    this.masterGainNode = null;
    this.analyserNode = null;

    // Track states
    this.onStateChangeCallbacks = new Set();
    this.onTimeUpdateCallbacks = new Set();

    // Night mode & acoustic states
    this.acousticSettings = {
      roomPlacement: 'free', // 'free' | 'wall' | 'corner' | 'bookshelf'
      dialogueBoost: false,
      dialogueBoostAmount: 3.5, // dB
      dynamicBass: false,
      dynamicBassAmount: 4.0, // dB
      nightMode: false,
      stereoBalance: 0, // -1 to 1
    };
  }

  init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Create Analyser
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.82;

    // Master Gain
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    // Stereo Panner
    if (this.ctx.createStereoPanner) {
      this.pannerNode = this.ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0, this.ctx.currentTime);
    }

    // A/B Bypass Gain Nodes
    this.wetGainNode = this.ctx.createGain();
    this.wetGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    this.dryGainNode = this.ctx.createGain();
    this.dryGainNode.gain.setValueAtTime(0, this.ctx.currentTime);

    // Night Mode Compressor
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(1, this.ctx.currentTime); // Off initially (ratio=1)
    this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Dialogue Clarity Filter (Peaking at 3kHz, Q=1.4)
    this.dialogueFilter = this.ctx.createBiquadFilter();
    this.dialogueFilter.type = 'peaking';
    this.dialogueFilter.frequency.setValueAtTime(3000, this.ctx.currentTime);
    this.dialogueFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);
    this.dialogueFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Dynamic Bass Boost Filter (Low-shelf at 90Hz)
    this.bassBoostFilter = this.ctx.createBiquadFilter();
    this.bassBoostFilter.type = 'lowshelf';
    this.bassBoostFilter.frequency.setValueAtTime(90, this.ctx.currentTime);
    this.bassBoostFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Room Boundary Compensation Filter (Low-shelf)
    this.roomFilter = this.ctx.createBiquadFilter();
    this.roomFilter.type = 'lowshelf';
    this.roomFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
    this.roomFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Build 10-band EQ chain
    this.bandFilters = STANDARD_FREQUENCIES_10.map((freq, index) => {
      const filter = this.ctx.createBiquadFilter();
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === STANDARD_FREQUENCIES_10.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.setValueAtTime(1.4, this.ctx.currentTime);
      }
      filter.frequency.setValueAtTime(freq, this.ctx.currentTime);
      filter.gain.setValueAtTime(0, this.ctx.currentTime);
      return filter;
    });

    // Connect the 10 bands sequentially
    for (let i = 0; i < this.bandFilters.length - 1; i++) {
      this.bandFilters[i].connect(this.bandFilters[i + 1]);
    }

    // Connect last band to room, bass boost, dialogue, compressor, then wetGain
    const lastBand = this.bandFilters[this.bandFilters.length - 1];
    lastBand.connect(this.roomFilter);
    this.roomFilter.connect(this.bassBoostFilter);
    this.bassBoostFilter.connect(this.dialogueFilter);
    this.dialogueFilter.connect(this.compressorNode);
    this.compressorNode.connect(this.wetGainNode);

    // Recombine wet and dry to panner, master, analyser, destination
    if (this.pannerNode) {
      this.wetGainNode.connect(this.pannerNode);
      this.dryGainNode.connect(this.pannerNode);
      this.pannerNode.connect(this.masterGainNode);
    } else {
      this.wetGainNode.connect(this.masterGainNode);
      this.dryGainNode.connect(this.masterGainNode);
    }

    // Local Monitor Gain (Allows muting headset output during tab capture to eliminate double echo)
    this.localMonitorGainNode = this.ctx.createGain();
    this.localMonitorGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    this.isHeadsetMuted = false;
    this.isStreamingToSpeaker = false;

    this.masterGainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.localMonitorGainNode);
    this.localMonitorGainNode.connect(this.ctx.destination);

    // Live PCM Chunk Streamer for Google Home
    try {
      this.streamProcessorNode = this.ctx.createScriptProcessor(4096, 2, 2);
      this.masterGainNode.connect(this.streamProcessorNode);
      // Connect to zero-gain dummy node so it doesn't leak into destination
      const dummyGain = this.ctx.createGain();
      dummyGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.streamProcessorNode.connect(dummyGain);
      dummyGain.connect(this.ctx.destination);

      this.streamProcessorNode.onaudioprocess = (e) => {
        if (!this.isStreamingToSpeaker) return;

        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.getChannelData(1);
        const len = left.length;
        const pcm = new Int16Array(len * 2);

        for (let i = 0; i < len; i++) {
          const l = Math.max(-1, Math.min(1, left[i]));
          const r = Math.max(-1, Math.min(1, right[i]));
          pcm[i * 2] = l < 0 ? l * 0x8000 : l * 0x7fff;
          pcm[i * 2 + 1] = r < 0 ? r * 0x8000 : r * 0x7fff;
        }

        fetch('/api/live-audio-chunk', {
          method: 'POST',
          body: pcm.buffer,
          headers: { 'Content-Type': 'application/octet-stream' },
        }).catch(() => {});
      };
    } catch (e) {
      console.warn('ScriptProcessor not available:', e);
    }

    // Create an underlying HTML5 Audio element for custom uploads / streams
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.loop = true;
    this.audioElement.addEventListener('timeupdate', () => {
      this.notifyTimeUpdate(this.audioElement.currentTime, this.audioElement.duration || 0);
    });
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      this.notifyStateChange();
    });

    this.sourceNode = this.ctx.createMediaElementSource(this.audioElement);
    // Split input to both wet path (band 0) and dry path (dryGainNode)
    this.sourceNode.connect(this.bandFilters[0]);
    this.sourceNode.connect(this.dryGainNode);
  }

  async ensureContextActive() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // --- EQ Band Adjustments ---
  setBandGain(index, gainDb) {
    if (!this.bandFilters[index]) return;
    const clampedGain = Math.max(-12, Math.min(12, gainDb));
    this.bandFilters[index].gain.setTargetAtTime(clampedGain, this.ctx.currentTime, 0.04);
  }

  setAllBands(gains) {
    gains.forEach((gain, i) => {
      if (this.bandFilters[i]) {
        this.setBandGain(i, gain);
      }
    });
  }

  // Google Home 2-Band Mode: maps Bass to lower bands and Treble to higher bands
  setGoogleHome2Band(bassDb, trebleDb) {
    // Bass (-6 to +6 dB): affects 31Hz, 63Hz, 125Hz, 250Hz smoothly
    const clampedBass = Math.max(-6, Math.min(6, bassDb));
    const clampedTreble = Math.max(-6, Math.min(6, trebleDb));

    this.setBandGain(0, clampedBass * 1.0); // 31Hz
    this.setBandGain(1, clampedBass * 0.95); // 63Hz
    this.setBandGain(2, clampedBass * 0.8); // 125Hz
    this.setBandGain(3, clampedBass * 0.4); // 250Hz
    this.setBandGain(4, 0); // 500Hz
    this.setBandGain(5, 0); // 1kHz
    this.setBandGain(6, 0); // 2kHz
    this.setBandGain(7, clampedTreble * 0.4); // 4kHz
    this.setBandGain(8, clampedTreble * 0.85); // 8kHz
    this.setBandGain(9, clampedTreble * 1.0); // 16kHz
  }

  // Nest Studio 5-Band Mode: maps 5 bands to the 10 physical filters
  setNestStudio5Band([bSub, bBass, bMid, bPresence, bTreble]) {
    this.setBandGain(0, bSub);
    this.setBandGain(1, (bSub + bBass) / 2);
    this.setBandGain(2, bBass);
    this.setBandGain(3, (bBass + bMid) / 2);
    this.setBandGain(4, bMid);
    this.setBandGain(5, bMid);
    this.setBandGain(6, (bMid + bPresence) / 2);
    this.setBandGain(7, bPresence);
    this.setBandGain(8, (bPresence + bTreble) / 2);
    this.setBandGain(9, bTreble);
  }

  // --- Acoustic and Smart Audio Controls ---
  setRoomPlacement(placement) {
    this.acousticSettings.roomPlacement = placement;
    if (!this.roomFilter || !this.ctx) return;

    // Corner: heavy boundary bass buildup -> apply -4.5dB low shelf cut
    // Wall: moderate bass buildup -> apply -2.5dB low shelf cut
    // Bookshelf: resonance near 200Hz -> slight -1.5dB cut
    // Free: unconstrained acoustic -> 0dB
    let compensationGain = 0;
    if (placement === 'corner') compensationGain = -4.5;
    else if (placement === 'wall') compensationGain = -2.5;
    else if (placement === 'bookshelf') compensationGain = -1.5;
    else compensationGain = 0;

    this.roomFilter.gain.setTargetAtTime(compensationGain, this.ctx.currentTime, 0.05);
  }

  setDialogueBoost(enabled, amount = 3.5) {
    this.acousticSettings.dialogueBoost = enabled;
    this.acousticSettings.dialogueBoostAmount = amount;
    if (!this.dialogueFilter || !this.ctx) return;
    const gain = enabled ? amount : 0;
    this.dialogueFilter.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
  }

  setDynamicBass(enabled, amount = 4.0) {
    this.acousticSettings.dynamicBass = enabled;
    this.acousticSettings.dynamicBassAmount = amount;
    if (!this.bassBoostFilter || !this.ctx) return;
    const gain = enabled ? amount : 0;
    this.bassBoostFilter.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
  }

  setNightMode(enabled) {
    this.acousticSettings.nightMode = enabled;
    if (!this.compressorNode || !this.ctx) return;
    // When enabled, ratio increases to 8:1 with aggressive threshold
    const ratio = enabled ? 8 : 1;
    const threshold = enabled ? -28 : 0;
    this.compressorNode.ratio.setTargetAtTime(ratio, this.ctx.currentTime, 0.05);
    this.compressorNode.threshold.setTargetAtTime(threshold, this.ctx.currentTime, 0.05);
  }

  setStereoBalance(balance) {
    this.acousticSettings.stereoBalance = balance;
    if (!this.pannerNode || !this.ctx) return;
    this.pannerNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, balance)), this.ctx.currentTime, 0.05);
  }

  // --- Bypass Switch (A/B Test) ---
  setBypass(bypassed) {
    this.isBypassed = bypassed;
    if (!this.wetGainNode || !this.dryGainNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (bypassed) {
      // Route dry only
      this.wetGainNode.gain.setTargetAtTime(0, now, 0.02);
      this.dryGainNode.gain.setTargetAtTime(1, now, 0.02);
    } else {
      // Route through EQ chain
      this.wetGainNode.gain.setTargetAtTime(1, now, 0.02);
      this.dryGainNode.gain.setTargetAtTime(0, now, 0.02);
    }
    this.notifyStateChange();
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.03);
    }
  }

  // --- Frequency Response Calculation for Curve Visualizer ---
  // Calculates combined dB response of all biquad filters across test frequencies
  getCombinedFrequencyResponse(frequencies) {
    const numPoints = frequencies.length;
    const magCombined = new Float32Array(numPoints).fill(1.0);
    const tempMag = new Float32Array(numPoints);
    const tempPhase = new Float32Array(numPoints);

    if (!this.ctx || this.isBypassed) {
      return new Float32Array(numPoints).fill(0); // 0 dB flat
    }

    // Multiply frequency response magnitudes through all 10 bands
    this.bandFilters.forEach((filter) => {
      filter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) {
        magCombined[i] *= tempMag[i];
      }
    });

    // Include room filter
    if (this.roomFilter) {
      this.roomFilter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) magCombined[i] *= tempMag[i];
    }

    // Include dialogue filter
    if (this.dialogueFilter) {
      this.dialogueFilter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) magCombined[i] *= tempMag[i];
    }

    // Include dynamic bass filter
    if (this.bassBoostFilter) {
      this.bassBoostFilter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) magCombined[i] *= tempMag[i];
    }

    // Convert magnitude ratio to dB: 20 * log10(magnitude)
    const dbValues = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      dbValues[i] = 20 * Math.log10(Math.max(1e-5, magCombined[i]));
    }
    return dbValues;
  }

  // --- Real-time Spectrum Data ---
  getSpectrumData(outputArray) {
    if (!this.analyserNode) {
      outputArray.fill(0);
      return;
    }
    this.analyserNode.getByteFrequencyData(outputArray);
  }

  // --- Procedural Synth & Audio Player Tracks ---
  async playTrack(trackId, fileBlob = null) {
    await this.ensureContextActive();
    this.stopPlayback();

    this.currentTrackId = trackId;

    if (trackId === 'custom_file' && fileBlob) {
      const url = URL.createObjectURL(fileBlob);
      this.audioElement.src = url;
      await this.audioElement.play();
      this.isPlaying = true;
      this.notifyStateChange();
      return;
    }

    if (trackId === 'captured_tab') {
      // Tab capture is handled via captureTabOrSystemAudio
      return;
    }

    // Procedural synthesis engine for instant offline sound demo
    this.startProceduralAudio(trackId);
    this.isPlaying = true;
    this.notifyStateChange();
  }

  // Live Google Chrome Tab / System Sound Capture
  async captureTabOrSystemAudio() {
    await this.ensureContextActive();
    this.stopPlayback();

    try {
      // Request system/tab media stream with audio and suppress local echo
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          suppressLocalAudioPlayback: true,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        systemAudio: 'include',
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        // User didn't check "Share audio" checkbox
        stream.getTracks().forEach((t) => t.stop());
        throw new Error('No audio track selected. Make sure to check "Also share tab audio" or "Share system audio" in the popup!');
      }

      // Stop any previous capture
      this.stopTabCapture();

      this.capturedStream = stream;
      this.capturedSourceNode = this.ctx.createMediaStreamSource(stream);

      // Connect captured live audio directly into the EQ chain
      this.capturedSourceNode.connect(this.bandFilters[0]);
      this.capturedSourceNode.connect(this.dryGainNode);

      // MUTE local monitor in headsets by default to prevent double hearing / echo!
      if (this.localMonitorGainNode) {
        this.localMonitorGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        this.isHeadsetMuted = true;
      }

      this.currentTrackId = 'captured_tab';
      this.isPlaying = true;
      this.notifyStateChange();

      // Listen for when user stops sharing via browser bar
      audioTracks[0].addEventListener('ended', () => {
        this.stopTabCapture();
      });

      return stream;
    } catch (err) {
      console.warn('Tab capture cancelled or failed:', err.message);
      throw err;
    }
  }

  toggleHeadsetMonitor() {
    this.isHeadsetMuted = !this.isHeadsetMuted;
    if (this.localMonitorGainNode && this.ctx) {
      this.localMonitorGainNode.gain.setValueAtTime(this.isHeadsetMuted ? 0 : 1, this.ctx.currentTime);
    }
    this.notifyStateChange();
    return !this.isHeadsetMuted;
  }

  setHeadsetMuted(muted) {
    this.isHeadsetMuted = muted;
    if (this.localMonitorGainNode && this.ctx) {
      this.localMonitorGainNode.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
    this.notifyStateChange();
  }

  setLiveSpeakerStreaming(enabled) {
    this.isStreamingToSpeaker = enabled;
    if (enabled && this.ctx) {
      fetch(`/api/set-sample-rate?rate=${this.ctx.sampleRate}`, { method: 'POST' }).catch(() => {});
    }
    this.notifyStateChange();
  }

  stopTabCapture() {
    this.isStreamingToSpeaker = false;
    if (this.localMonitorGainNode && this.ctx) {
      this.localMonitorGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
      this.isHeadsetMuted = false;
    }
    if (this.capturedStream) {
      this.capturedStream.getTracks().forEach((t) => t.stop());
      this.capturedStream = null;
    }
    if (this.capturedSourceNode) {
      try {
        this.capturedSourceNode.disconnect();
      } catch (e) {}
      this.capturedSourceNode = null;
    }
    if (this.currentTrackId === 'captured_tab') {
      this.isPlaying = false;
      this.currentTrackId = 'funk_bass';
      this.notifyStateChange();
    }
  }

  // Play official Google Cast chime sound in browser
  playLocalConnectChime() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const now = this.ctx.currentTime;
    // Harmonic Cast two-tone chime: Tone 1 (C5: 523.25 Hz) then Tone 2 (G5: 783.99 Hz)
    const playTone = (freq, startTime, duration) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.28, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGainNode || this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playTone(523.25, now, 0.28);
    playTone(783.99, now + 0.16, 0.48);
  }

  startProceduralAudio(type) {
    if (!this.ctx) return;
    this.stopProceduralAudio();

    if (type === 'pink_noise') {
      this.playPinkNoise();
    } else if (type === 'sine_sweep') {
      this.playSineSweep();
    } else {
      // Musical synth loops: 'funk_bass', 'synthwave', 'acoustic_vocal'
      this.playMusicalLoop(type);
    }
  }

  playMusicalLoop(genre) {
    const bpm = genre === 'funk_bass' ? 104 : genre === 'synthwave' ? 122 : 92;
    const stepTime = 60 / bpm / 4; // 16th note in seconds
    let step = 0;

    // Pattern definitions
    const bassPatterns = {
      funk_bass: [40, null, 40, 43, null, 45, null, 48, 47, 45, 43, null, 40, null, 38, 40], // E minor funk
      synthwave: [36, 36, 48, 36, 36, 48, 36, 48, 41, 41, 53, 41, 43, 43, 55, 43], // 80s driving bass
      acoustic_vocal: [45, null, null, 45, 48, null, 52, null, 43, null, null, 43, 47, null, 50, null],
    };

    const leadPatterns = {
      funk_bass: [null, null, 64, null, null, 67, null, 71, null, null, 69, null, 67, 64, null, null],
      synthwave: [60, 63, 67, 72, 60, 63, 67, 72, 65, 68, 72, 77, 67, 70, 74, 79],
      acoustic_vocal: [69, 72, 76, null, 69, 72, 76, null, 67, 71, 74, null, 67, 71, 74, null],
    };

    const pattern = bassPatterns[genre] || bassPatterns.funk_bass;
    const leadPattern = leadPatterns[genre] || leadPatterns.funk_bass;

    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;

      const now = this.ctx.currentTime;
      const currentStep = step % 16;

      // 1. Kick on steps 0, 4, 8, 12
      if (currentStep % 4 === 0) {
        this.triggerKick(now);
      }

      // 2. Snare / Clap on steps 4, 12
      if (currentStep === 4 || currentStep === 12) {
        this.triggerSnare(now);
      }

      // 3. Hi-hat on every 8th note
      if (currentStep % 2 === 0) {
        this.triggerHiHat(now, currentStep % 4 === 0 ? 0.3 : 0.6);
      }

      // 4. Bass note
      const bassMidi = pattern[currentStep];
      if (bassMidi) {
        this.triggerSynthBass(now, midiToFreq(bassMidi), stepTime * 1.8, genre);
      }

      // 5. Melodic/Chords
      const leadMidi = leadPattern[currentStep];
      if (leadMidi) {
        this.triggerLead(now, midiToFreq(leadMidi), stepTime * 2.2, genre);
      }

      step++;
      this.notifyTimeUpdate(step * stepTime, 60);
    };

    // Run interval
    this.synthLoopInterval = setInterval(tick, stepTime * 1000);
    tick(); // initial tick
  }

  triggerKick(time) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    gain.gain.setValueAtTime(0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    osc.start(time);
    osc.stop(time + 0.25);
  }

  triggerSnare(time) {
    if (!this.ctx) return;
    // Noise burst + mid tone
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    noise.start(time);
  }

  triggerHiHat(time, vol = 0.5) {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.05;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.2;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7500, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    noise.start(time);
  }

  triggerSynthBass(time, freq, duration, genre) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = genre === 'synthwave' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(genre === 'synthwave' ? 900 : 450, time);
    filter.frequency.exponentialRampToValueAtTime(150, time + duration * 0.8);

    gain.gain.setValueAtTime(0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    osc.start(time);
    osc.stop(time + duration);
  }

  triggerLead(time, freq, duration, genre) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = genre === 'acoustic_vocal' ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    osc.start(time);
    osc.stop(time + duration);
  }

  playPinkNoise() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
      b6 = white * 0.115926;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    noiseSource.connect(this.bandFilters[0]);
    noiseSource.connect(this.dryGainNode);
    noiseSource.start();
    this.activeNoiseSource = noiseSource;
  }

  playSineSweep() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const duration = 10; // 10s sweep 20Hz -> 20kHz
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(20, now);
    osc.frequency.exponentialRampToValueAtTime(20000, now + duration);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.setValueAtTime(0.2, now + duration - 0.2);
    gain.gain.linearRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.bandFilters[0]);
    gain.connect(this.dryGainNode);

    osc.start(now);
    osc.stop(now + duration);
    this.activeSweepOsc = osc;

    // Loop sweep every 10s
    this.synthLoopInterval = setInterval(() => {
      this.playSineSweep();
    }, duration * 1000);
  }

  stopProceduralAudio() {
    if (this.synthLoopInterval) {
      clearInterval(this.synthLoopInterval);
      this.synthLoopInterval = null;
    }
    if (this.activeNoiseSource) {
      try { this.activeNoiseSource.stop(); } catch (e) {}
      this.activeNoiseSource = null;
    }
    if (this.activeSweepOsc) {
      try { this.activeSweepOsc.stop(); } catch (e) {}
      this.activeSweepOsc = null;
    }
  }

  stopPlayback() {
    this.isPlaying = false;
    this.stopProceduralAudio();
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.notifyStateChange();
  }

  pause() {
    this.isPlaying = false;
    this.stopProceduralAudio();
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.notifyStateChange();
  }

  resume() {
    if (!this.isPlaying) {
      this.playTrack(this.currentTrackId);
    }
  }

  // --- Subscriptions ---
  subscribeStateChange(cb) {
    this.onStateChangeCallbacks.add(cb);
    return () => this.onStateChangeCallbacks.delete(cb);
  }

  notifyStateChange() {
    this.onStateChangeCallbacks.forEach((cb) => cb({
      isPlaying: this.isPlaying,
      currentTrackId: this.currentTrackId,
      isBypassed: this.isBypassed,
      isHeadsetMuted: this.isHeadsetMuted,
      isStreamingToSpeaker: this.isStreamingToSpeaker,
    }));
  }

  subscribeTimeUpdate(cb) {
    this.onTimeUpdateCallbacks.add(cb);
    return () => this.onTimeUpdateCallbacks.delete(cb);
  }

  notifyTimeUpdate(current, duration) {
    this.onTimeUpdateCallbacks.forEach((cb) => cb({ current, duration }));
  }
}

function midiToFreq(midiNote) {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Singleton instance
export const audioEngine = new AudioEngine();
