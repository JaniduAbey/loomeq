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
    this.googleBassFilter = null; // Dedicated 160Hz Low Shelf
    this.googleTrebleFilter = null; // Dedicated 3200Hz High Shelf
    this.googleBassGain = 0;
    this.googleTrebleGain = 0;
    this.currentBands10 = new Array(10).fill(0);

    // Master Input Bus (routes all audio through dedicated shelves and filters)
    this.inputBus = null;

    // Auto-Gain Loudness Normalizer (eliminates volume jumps when boosting bass/treble)
    this.autoGainNode = null;
    this.isAutoGainEnabled = true;

    // Analog Color & Tube Drive
    this.tubeSaturationNode = null;
    this.tubeDrive = 0.0; // 0 to 1

    // Spatial Stereo Width (0.0 = Mono, 1.0 = Normal, 2.0 = Super Wide)
    this.stereoWidth = 1.0;
    this.widthSplitter = null;
    this.widthMerger = null;
    this.gainLL = null;
    this.gainLR = null;
    this.gainRL = null;
    this.gainRR = null;

    // Acoustic & Compressor
    this.roomFilter = null;
    this.dialogueFilter = null;
    this.bassBoostFilter = null;
    this.compressorNode = null;
    this.dryGainNode = null;
    this.wetGainNode = null;
    this.pannerNode = null;
    this.masterGainNode = null;

    // Dual Channel Analysers for Hardware LED Meters
    this.analyserNode = null;
    this.analyserL = null;
    this.analyserR = null;
    this.channelSplitterNode = null;

    // Track states
    this.onStateChangeCallbacks = new Set();
    this.onTimeUpdateCallbacks = new Set();

    // Night mode & acoustic states
    this.acousticSettings = {
      roomPlacement: 'free',
      dialogueBoost: false,
      dialogueBoostAmount: 3.5,
      dynamicBass: false,
      dynamicBassAmount: 4.0,
      nightMode: false,
      stereoBalance: 0,
    };
  }

  init() {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Analyser (1024-FFT)
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 1024;
    this.analyserNode.smoothingTimeConstant = 0.82;

    // Dual Channel Analysers for Hardware LED Meter Bridge (L & R Peak/RMS)
    this.analyserL = this.ctx.createAnalyser();
    this.analyserL.fftSize = 256;
    this.analyserR = this.ctx.createAnalyser();
    this.analyserR.fftSize = 256;
    this.channelSplitterNode = this.ctx.createChannelSplitter(2);
    this.channelSplitterNode.connect(this.analyserL, 0);
    this.channelSplitterNode.connect(this.analyserR, 1);

    // Master Gain & Auto-Gain Loudness Normalizer
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    this.autoGainNode = this.ctx.createGain();
    this.autoGainNode.gain.setValueAtTime(1.0, this.ctx.currentTime);

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

    // Master Input Bus
    this.inputBus = this.ctx.createGain();
    this.inputBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

    // Tube Saturation WaveShaper
    this.tubeSaturationNode = this.ctx.createWaveShaper();
    this.tubeSaturationNode.curve = this.createDistortionCurve(0);
    this.tubeSaturationNode.oversample = '4x';

    // Dedicated Google Home 2-Band Shelf Filters
    this.googleBassFilter = this.ctx.createBiquadFilter();
    this.googleBassFilter.type = 'lowshelf';
    this.googleBassFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
    this.googleBassFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    this.googleTrebleFilter = this.ctx.createBiquadFilter();
    this.googleTrebleFilter.type = 'highshelf';
    this.googleTrebleFilter.frequency.setValueAtTime(3200, this.ctx.currentTime);
    this.googleTrebleFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Night Mode Compressor
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-24, this.ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(30, this.ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(1, this.ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Dialogue Clarity Filter
    this.dialogueFilter = this.ctx.createBiquadFilter();
    this.dialogueFilter.type = 'peaking';
    this.dialogueFilter.frequency.setValueAtTime(3000, this.ctx.currentTime);
    this.dialogueFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);
    this.dialogueFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Dynamic Bass Boost Filter
    this.bassBoostFilter = this.ctx.createBiquadFilter();
    this.bassBoostFilter.type = 'lowshelf';
    this.bassBoostFilter.frequency.setValueAtTime(90, this.ctx.currentTime);
    this.bassBoostFilter.gain.setValueAtTime(0, this.ctx.currentTime);

    // Room Boundary Filter
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

    // Wire 10 graphic bands sequentially
    for (let i = 0; i < this.bandFilters.length - 1; i++) {
      this.bandFilters[i].connect(this.bandFilters[i + 1]);
    }

    // Mid/Side Spatial Stereo Width Matrix
    this.widthSplitter = this.ctx.createChannelSplitter(2);
    this.widthMerger = this.ctx.createChannelMerger(2);
    this.gainLL = this.ctx.createGain();
    this.gainLR = this.ctx.createGain();
    this.gainRL = this.ctx.createGain();
    this.gainRR = this.ctx.createGain();

    this.gainLL.gain.setValueAtTime(1.0, this.ctx.currentTime);
    this.gainLR.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.gainRL.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.gainRR.gain.setValueAtTime(1.0, this.ctx.currentTime);

    this.widthSplitter.connect(this.gainLL, 0);
    this.widthSplitter.connect(this.gainRL, 0);
    this.widthSplitter.connect(this.gainRR, 1);
    this.widthSplitter.connect(this.gainLR, 1);

    this.gainLL.connect(this.widthMerger, 0, 0);
    this.gainLR.connect(this.widthMerger, 0, 0);
    this.gainRL.connect(this.widthMerger, 0, 1);
    this.gainRR.connect(this.widthMerger, 0, 1);

    // Route Input Bus to wet Google shelves and dry bypass
    this.inputBus.connect(this.googleBassFilter);
    this.inputBus.connect(this.dryGainNode);

    // Wet chain connection:
    // inputBus -> googleBass -> googleTreble -> 10-band chain -> room -> bassBoost -> dialogue -> tubeSat -> autoGain -> compressor -> stereoWidth -> wetGain
    this.googleBassFilter.connect(this.googleTrebleFilter);
    this.googleTrebleFilter.connect(this.bandFilters[0]);

    const lastBand = this.bandFilters[this.bandFilters.length - 1];
    lastBand.connect(this.roomFilter);
    this.roomFilter.connect(this.bassBoostFilter);
    this.bassBoostFilter.connect(this.dialogueFilter);
    this.dialogueFilter.connect(this.tubeSaturationNode);
    this.tubeSaturationNode.connect(this.autoGainNode);
    this.autoGainNode.connect(this.compressorNode);
    this.compressorNode.connect(this.widthSplitter);
    this.widthMerger.connect(this.wetGainNode);

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
    this.masterGainNode.connect(this.channelSplitterNode);
    this.analyserNode.connect(this.localMonitorGainNode);
    this.localMonitorGainNode.connect(this.ctx.destination);

    // Live PCM Chunk Streamer for Google Home
    try {
      this.streamProcessorNode = this.ctx.createScriptProcessor(4096, 2, 2);
      this.masterGainNode.connect(this.streamProcessorNode);
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

    // HTML5 Audio element
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
    this.sourceNode.connect(this.inputBus);
  }

  createDistortionCurve(amount) {
    const k = amount * 40;
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; ++i) {
      const x = (i * 2) / n - 1;
      if (k === 0) {
        curve[i] = x;
      } else {
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }
    return curve;
  }

  setTubeWarmth(driveAmount) {
    this.tubeDrive = Math.max(0, Math.min(1, driveAmount));
    if (this.tubeSaturationNode) {
      this.tubeSaturationNode.curve = this.createDistortionCurve(this.tubeDrive);
    }
  }

  setAutoGainEnabled(enabled) {
    this.isAutoGainEnabled = enabled;
    this.updateAutoGain();
  }

  // Auto-gain loudness compensation: ensures boosting bass or treble shapes the tone without blowing out the volume
  updateAutoGain() {
    if (!this.autoGainNode || !this.ctx) return;
    if (!this.isAutoGainEnabled) {
      this.autoGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.02);
      return;
    }

    const bassBoost = Math.max(0, this.googleBassGain);
    const trebleBoost = Math.max(0, this.googleTrebleGain);
    const graphicAvg = this.currentBands10.reduce((acc, g) => acc + Math.max(0, g), 0) / 10;

    // Fletcher-Munson dynamic loudness compensation
    const compDb = -(bassBoost * 0.35 + trebleBoost * 0.2 + graphicAvg * 0.4);
    const compGain = Math.max(0.28, Math.min(1.15, Math.pow(10, compDb / 20)));
    this.autoGainNode.gain.setTargetAtTime(compGain, this.ctx.currentTime, 0.02);
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
    this.currentBands10[index] = clampedGain;
    this.bandFilters[index].gain.setTargetAtTime(clampedGain, this.ctx.currentTime, 0.015);
    this.updateAutoGain();
  }

  setAllBands(gains) {
    gains.forEach((gain, i) => {
      if (this.bandFilters[i]) {
        this.setBandGain(i, gain);
      }
    });
  }

  // Google Home 2-Band Mode: updates dedicated hardware-matching low & high shelf filters smoothly
  setGoogleHome2Band(bassDb, trebleDb) {
    const clampedBass = Math.max(-6, Math.min(6, bassDb));
    const clampedTreble = Math.max(-6, Math.min(6, trebleDb));

    this.googleBassGain = clampedBass;
    this.googleTrebleGain = clampedTreble;

    if (this.googleBassFilter && this.ctx) {
      this.googleBassFilter.gain.setTargetAtTime(clampedBass, this.ctx.currentTime, 0.015);
    }
    if (this.googleTrebleFilter && this.ctx) {
      this.googleTrebleFilter.gain.setTargetAtTime(clampedTreble, this.ctx.currentTime, 0.015);
    }

    this.updateAutoGain();
  }

  // Get stereo meter levels for hardware 24-segment LED bar
  getStereoMeterLevels() {
    if (!this.analyserL || !this.analyserR) {
      return { leftPeak: 0, rightPeak: 0, leftRms: 0, rightRms: 0 };
    }

    const bufL = new Float32Array(this.analyserL.fftSize);
    const bufR = new Float32Array(this.analyserR.fftSize);
    this.analyserL.getFloatTimeDomainData(bufL);
    this.analyserR.getFloatTimeDomainData(bufR);

    let sumL = 0, peakL = 0;
    for (let i = 0; i < bufL.length; i++) {
      const abs = Math.abs(bufL[i]);
      if (abs > peakL) peakL = abs;
      sumL += abs * abs;
    }

    let sumR = 0, peakR = 0;
    for (let i = 0; i < bufR.length; i++) {
      const abs = Math.abs(bufR[i]);
      if (abs > peakR) peakR = abs;
      sumR += abs * abs;
    }

    return {
      leftPeak: Math.min(1.2, peakL),
      rightPeak: Math.min(1.2, peakR),
      leftRms: Math.min(1.0, Math.sqrt(sumL / bufL.length)),
      rightRms: Math.min(1.0, Math.sqrt(sumR / bufR.length)),
    };
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

  setStereoWidth(width) {
    this.stereoWidth = Math.max(0, Math.min(2.0, width));
    if (!this.gainLL || !this.ctx) return;
    const w = this.stereoWidth;
    const direct = 0.5 * (1 + w);
    const cross = 0.5 * (1 - w);
    const now = this.ctx.currentTime;
    this.gainLL.gain.setTargetAtTime(direct, now, 0.02);
    this.gainRR.gain.setTargetAtTime(direct, now, 0.02);
    this.gainLR.gain.setTargetAtTime(cross, now, 0.02);
    this.gainRL.gain.setTargetAtTime(cross, now, 0.02);
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

    // Include dedicated Google Home bass/treble shelf filters
    if (this.googleBassFilter) {
      this.googleBassFilter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) magCombined[i] *= tempMag[i];
    }
    if (this.googleTrebleFilter) {
      this.googleTrebleFilter.getFrequencyResponse(frequencies, tempMag, tempPhase);
      for (let i = 0; i < numPoints; i++) magCombined[i] *= tempMag[i];
    }

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

    // Auto-gain offset in dB
    const autoGainDb = this.autoGainNode && this.autoGainEnabled 
      ? 20 * Math.log10(Math.max(1e-4, this.autoGainNode.gain.value))
      : 0;

    // Convert magnitude ratio to dB: 20 * log10(magnitude) + autoGainDb
    const dbValues = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      dbValues[i] = (20 * Math.log10(Math.max(1e-5, magCombined[i]))) + autoGainDb;
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

      // Connect captured live audio directly into the EQ input bus
      this.capturedSourceNode.connect(this.inputBus);

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
    gain.connect(this.inputBus);

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
    gain.connect(this.inputBus);

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
    gain.connect(this.inputBus);

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
    gain.connect(this.inputBus);

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
    gain.connect(this.inputBus);

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

    noiseSource.connect(this.inputBus);
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
    gain.connect(this.inputBus);

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
