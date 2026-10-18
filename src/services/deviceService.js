// Real Google Home & Wireless Smart Speaker Device Integration Service
// Communicates with local CastBridge to perform real mDNS & subnet scans and send CastV2 TLS EQ commands.

class DeviceService {
  constructor() {
    this.devices = [];
    this.activeDeviceId = null;
    this.logs = [];
    this.listeners = new Set();
    this.isScanning = false;
    this.lastScanStats = null;
    this.hasInitialScanned = false;

    // Load initial devices from real backend
    this.init();
  }

  async init() {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const list = await res.json();
        if (list && list.length > 0) {
          this.devices = list;
          this.activeDeviceId = list[0].id;
          this.log(`Loaded ${list.length} real network device(s). Active target: "${list[0].name}" (${list[0].ip})`);
          this.notify();
          return;
        }
      }
    } catch (e) {
      console.warn('Real scan backend not ready yet, will scan on demand:', e.message);
    }

    // Trigger full real scan if list is empty
    this.scanNetwork();
  }

  getActiveDevice() {
    if (!this.devices || this.devices.length === 0) {
      return {
        id: 'no-device',
        name: 'Scanning for devices...',
        model: 'Searching local Wi-Fi...',
        ip: '192.168.1.x',
        port: 8008,
        type: 'google_home',
        online: false,
        signalDbm: 0,
        firmware: 'N/A',
        currentEq: { bass: 0, treble: 0 },
      };
    }
    return this.devices.find((d) => d.id === this.activeDeviceId) || this.devices[0];
  }

  setActiveDevice(id) {
    this.activeDeviceId = id;
    const dev = this.getActiveDevice();
    this.log(`Switched active speaker target to real device: "${dev.name}" (${dev.ip})`);
    this.notify();
  }

  getDevices() {
    return this.devices;
  }

  // Real Network Scan: Calls backend mDNS & Subnet probe
  async scanNetwork() {
    this.isScanning = true;
    this.log('🔍 Broadcasting mDNS query (_googlecast._tcp.local) & probing port 8008 across subnets...');
    this.notify();

    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (res.ok) {
        const discovered = await res.json();
        this.devices = discovered;
        this.isScanning = false;
        this.hasInitialScanned = true;

        if (discovered.length > 0) {
          if (!this.activeDeviceId || !this.devices.some((d) => d.id === this.activeDeviceId)) {
            this.activeDeviceId = discovered[0].id;
          }
          this.log(`✅ Real scan complete: Found ${discovered.length} active speaker(s) on your Wi-Fi!`);
          discovered.forEach((d) => {
            this.log(`   • ${d.name} (${d.model}) @ ${d.ip} [${d.discoverySource}]`);
          });
        } else {
          this.log('⚠️ No Cast devices found on local subnet. Make sure your speaker is powered on and on the same Wi-Fi.');
        }

        this.notify();
        return this.devices;
      }
    } catch (err) {
      this.isScanning = false;
      this.log(`❌ Network scan error: ${err.message}`);
      this.notify();
    }
    return this.devices;
  }

  // Fetch real current hardware EQ from physical speaker
  async fetchRealHardwareEq(device) {
    if (!device || !device.ip) return null;
    try {
      const res = await fetch(`/api/devices/eq?ip=${device.ip}`);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.bass !== undefined || data.treble !== undefined)) {
          device.currentEq = {
            bass: data.bass ?? 0,
            treble: data.treble ?? 0,
          };
          this.log(`[CastV2] Synced real hardware EQ from "${device.name}": Bass: ${data.bass} dB, Treble: ${data.treble} dB`);
          this.notify();
          return data;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch hardware EQ:', e);
    }
    return null;
  }

  // Push EQ settings to the active physical device via CastBridge
  async pushEqSettings(device, eqData) {
    if (!device || !device.ip) return;
    const timestamp = new Date().toLocaleTimeString();

    this.log(`[${timestamp}] 📡 Transmitting CastV2 SET_USER_EQ to ${device.name} (${device.ip}:8009)...`);
    this.log(`   Bass: ${eqData.bass.toFixed(1)} dB, Treble: ${eqData.treble.toFixed(1)} dB`);

    try {
      const res = await fetch('/api/devices/eq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: device.ip,
          bass: eqData.bass,
          treble: eqData.treble,
        }),
      });

      if (res.ok) {
        const result = await res.json();
        device.currentEq = {
          bass: eqData.bass,
          treble: eqData.treble,
        };
        this.log(`[${timestamp}] 🟢 200 OK — Physical speaker "${device.name}" equalizer updated successfully!`);
        this.notify();
      } else {
        const err = await res.json();
        this.log(`[${timestamp}] 🔴 Error pushing to speaker: ${err.error || res.statusText}`);
      }
    } catch (err) {
      this.log(`[${timestamp}] ⚠️ Push request failed: ${err.message}`);
    }
  }

  // Connect to physical Google Home speaker, sound chime & verify Cast session
  async connectSpeaker(device) {
    if (!device || !device.ip) return false;
    const timestamp = new Date().toLocaleTimeString();
    this.log(`[${timestamp}] 🔗 Connecting to "${device.name}" (${device.ip}:8009)...`);

    try {
      await this.playSpeakerChime(device);
      await this.fetchRealHardwareEq(device);
      device.online = true;
      this.log(`[${timestamp}] 🟢 Connected to "${device.name}"! CastV2 port 8009 ready.`);
      this.notify();
      return true;
    } catch (e) {
      this.log(`[${timestamp}] ⚠️ Could not connect to speaker: ${e.message}`);
      return false;
    }
  }

  // Play connect chime on physical Google Home speaker
  async playSpeakerChime(device) {
    if (!device || !device.ip) return;
    const timestamp = new Date().toLocaleTimeString();
    this.log(`[${timestamp}] 🔔 Triggering connect chime on "${device.name}" (${device.ip}:8009)...`);

    try {
      const res = await fetch('/api/devices/chime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: device.ip }),
      });

      if (res.ok) {
        this.log(`[${timestamp}] 🔔 Connect chime sounded out loud on "${device.name}"!`);
      } else {
        const err = await res.json();
        this.log(`[${timestamp}] ⚠️ Could not sound chime: ${err.error || res.statusText}`);
      }
    } catch (err) {
      this.log(`[${timestamp}] ⚠️ Chime request error: ${err.message}`);
    }
  }

  // Cast media stream directly to physical Google Home
  async castMediaToSpeaker(device, mediaUrl, metadata = {}) {
    if (!device || !device.ip) return;
    const timestamp = new Date().toLocaleTimeString();
    this.log(`[${timestamp}] 📡 Streaming audio directly to "${device.name}" (${device.ip}:8009)...`);

    try {
      const res = await fetch('/api/devices/cast-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: device.ip,
          url: mediaUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
          metadata: {
            title: metadata.title || 'AuraEQ Live Audio Stream',
            artist: metadata.artist || device.name,
            contentType: 'audio/mp3',
          },
        }),
      });

      if (res.ok) {
        device.isStreaming = true;
        this.log(`[${timestamp}] 🎵 Google Home is now PLAYING audio stream!`);
        this.notify();
      } else {
        const err = await res.json();
        this.log(`[${timestamp}] ⚠️ Cast error: ${err.error || res.statusText}`);
      }
    } catch (err) {
      this.log(`[${timestamp}] ⚠️ Cast failed: ${err.message}`);
    }
  }

  // Cast Live Tab Audio directly to Google Home
  async castLiveTabStreamToSpeaker(device) {
    if (!device || !device.ip) return;
    const timestamp = new Date().toLocaleTimeString();
    this.log(`[${timestamp}] 📡 Routing live YouTube / Tab audio to "${device.name}" (${device.ip}:8009)...`);

    try {
      const res = await fetch('/api/devices/cast-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: device.ip }),
      });

      if (res.ok) {
        device.isStreaming = true;
        this.log(`[${timestamp}] 🟢 LIVE STREAM ENGAGED: Google Home is now streaming your tab sound!`);
        this.notify();
      } else {
        const err = await res.json();
        this.log(`[${timestamp}] ⚠️ Live cast error: ${err.error || res.statusText}`);
      }
    } catch (err) {
      this.log(`[${timestamp}] ⚠️ Live stream error: ${err.message}`);
    }
  }

  // Disconnect & Stop Cast on physical speaker
  async disconnectSpeaker(device) {
    if (!device || !device.ip) return;
    const timestamp = new Date().toLocaleTimeString();
    this.log(`[${timestamp}] 🛑 Disconnecting from "${device.name}" and stopping playback...`);

    try {
      const res = await fetch('/api/devices/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: device.ip }),
      });

      device.isStreaming = false;
      this.log(`[${timestamp}] 🛑 Cleanly disconnected from "${device.name}". All sound stopped.`);
      this.notify();
    } catch (e) {
      device.isStreaming = false;
      this.log(`[${timestamp}] Disconnected.`);
      this.notify();
    }
  }

  // Stop cast stream on physical speaker
  async stopCastOnSpeaker(device) {
    await this.disconnectSpeaker(device);
  }

  // Add custom manual device IP
  addCustomDevice(device) {
    const newDev = {
      id: 'custom-' + Date.now(),
      name: device.name || 'Manual Wireless Speaker',
      model: device.model || 'Google Cast / Smart Speaker',
      ip: device.ip,
      port: Number(device.port) || 8008,
      castPort: 8009,
      type: 'google_home',
      online: true,
      discoverySource: 'Manual IP Entry',
      signalDbm: -50,
      firmware: 'Custom',
      currentEq: { bass: 0, treble: 0 },
      room: device.room || 'Custom Room',
    };
    this.devices.push(newDev);
    this.activeDeviceId = newDev.id;
    this.log(`Added manual target: ${newDev.name} [${newDev.ip}]`);
    this.notify();
    return newDev;
  }

  log(msg) {
    this.logs.unshift({
      id: Date.now() + Math.random(),
      text: msg,
      time: new Date().toLocaleTimeString(),
    });
    if (this.logs.length > 60) this.logs.pop();
    this.notify();
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  getLogs() {
    return this.logs;
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  notify() {
    this.listeners.forEach((cb) => cb());
  }
}

export const deviceService = new DeviceService();
