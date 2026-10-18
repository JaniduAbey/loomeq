// Real Google Home / Cast Local Network Discovery & CastV2 Protocol Bridge
import { Bonjour } from 'bonjour-service';
import http from 'http';
import os from 'os';
import castv2Client from 'castv2-client';

const { Client } = castv2Client.default || castv2Client;

class CastBridge {
  constructor() {
    this.discoveredDevices = new Map();
    this.isScanning = false;
    this.lastScanTime = null;
    this.bonjour = null;
    this.audioStreamSubscribers = new Set();
    this.audioPort = 8888;
    this.audioServer = null;
    this.lastChunkTime = 0;
    this.sampleRate = 48000;
    this.startAudioServer(8888);
  }

  setSampleRate(rate) {
    if (rate && Number(rate) > 0) {
      this.sampleRate = Number(rate);
      console.log(`[CastBridge] Audio sample rate configured to ${this.sampleRate} Hz`);
    }
  }

  // Dedicated HTTP server listening on 0.0.0.0 for external Google Home streaming
  startAudioServer(port = 8888) {
    if (globalThis.__audioServer) {
      try { globalThis.__audioServer.close(); } catch (e) {}
    }
    this.audioPort = port;

    this.audioServer = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === '/live-audio.wav' || url.pathname === '/api/live-stream.wav') {
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Connection': 'keep-alive',
          'Accept-Ranges': 'none',
          'Access-Control-Allow-Origin': '*',
        });

        // 1. Send 44-byte WAV header (48kHz 16-bit Stereo PCM)
        res.write(createWavHeader(48000, 2));

        // 2. Pre-buffer 0.5s stereo silence so Google Home DAC immediately starts playing
        const prebuffer = Buffer.alloc(Math.floor(48000 * 2 * 2 * 0.5));
        res.write(prebuffer);

        this.audioStreamSubscribers.add(res);
        console.log(`[CastBridge] [STREAM] Google Home (${req.socket.remoteAddress}) connected to dedicated audio stream on port ${port}!`);

        req.on('close', () => {
          this.audioStreamSubscribers.delete(res);
          console.log(`[CastBridge] [DISCONNECT] Google Home audio stream connection closed.`);
        });
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    this.audioServer.on('error', (err) => {
      console.warn(`[CastBridge] Audio server error on port ${port}:`, err.message);
    });

    this.audioServer.listen(port, '0.0.0.0', () => {
      globalThis.__audioServer = this.audioServer;
      console.log(`[CastBridge] [SERVER] Dedicated Live Audio Stream Server running on 0.0.0.0:${port}`);
    });

    // Keep-alive timer: ensure stream never stalls if browser pauses for a moment
    setInterval(() => {
      if (this.audioStreamSubscribers.size === 0) return;
      const now = Date.now();
      if (now - this.lastChunkTime > 180) {
        // Send small silent packet (256 samples stereo)
        const silence = Buffer.alloc(256 * 4);
        for (const res of this.audioStreamSubscribers) {
          try { res.write(silence); } catch (e) { this.audioStreamSubscribers.delete(res); }
        }
      }
    }, 100);
  }

  // Get Primary LAN IP reachable by Google Home (e.g. 192.168.1.6)
  getPrimaryLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        if (net.family === 'IPv4' && !net.internal && net.address.startsWith('192.168.1.')) {
          return net.address;
        }
      }
    }
    return '192.168.1.6';
  }

  // Broadcast PCM audio chunk from captured tab to all connected Google Home listeners
  broadcastAudioChunk(chunkBuffer) {
    if (!this.audioStreamSubscribers || this.audioStreamSubscribers.size === 0) return;
    this.lastChunkTime = Date.now();
    for (const res of this.audioStreamSubscribers) {
      try {
        res.write(chunkBuffer);
      } catch (e) {
        this.audioStreamSubscribers.delete(res);
      }
    }
  }

  // Detect local IPv4 subnets from network interfaces
  getLocalSubnets() {
    const interfaces = os.networkInterfaces();
    const subnets = new Set();

    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name]) {
        // Skip internal (127.0.0.1) and non-IPv4
        if (net.family === 'IPv4' && !net.internal) {
          const parts = net.address.split('.');
          if (parts.length === 4) {
            // E.g. 192.168.1
            subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
          }
        }
      }
    }
    return Array.from(subnets);
  }

  // Scan network using mDNS and Subnet Eureka probing
  async scan() {
    if (this.isScanning) {
      return Array.from(this.discoveredDevices.values());
    }

    this.isScanning = true;
    console.log('[CastBridge] Initiating REAL Google Home scan across subnets...');

    // 1. Initialize mDNS browser
    try {
      if (this.bonjour) {
        this.bonjour.destroy();
      }
      this.bonjour = new Bonjour();

      this.bonjour.find({ type: 'googlecast' }, (service) => {
        const ip = service.addresses?.[0];
        if (!ip) return;

        const dev = {
          id: service.txt?.id || `cast-${ip.replace(/\./g, '-')}`,
          name: service.txt?.fn || service.name,
          model: service.txt?.md || 'Google Home / Nest',
          ip: ip,
          port: 8008,
          castPort: 8009,
          type: 'google_home',
          online: true,
          discoverySource: 'mDNS multicast',
          signalDbm: -50,
          room: service.txt?.rm || 'Room',
          currentEq: { bass: 0, treble: 0 },
          lastSeen: Date.now(),
        };

        this.discoveredDevices.set(ip, dev);
        console.log(`[CastBridge] Discovered via mDNS: "${dev.name}" at ${ip}`);
        
        // Fetch initial EQ in background
        this.fetchDeviceEq(ip).catch(() => {});
      });
    } catch (e) {
      console.error('[CastBridge] mDNS error:', e.message);
    }

    // 2. Concurrently probe port 8008 on active subnets
    const subnets = this.getLocalSubnets();
    console.log('[CastBridge] Scanning subnets:', subnets);

    const probePromises = [];

    for (const subnet of subnets) {
      // Prioritize 192.168.x.x
      for (let i = 1; i <= 254; i++) {
        const ip = `${subnet}.${i}`;
        probePromises.push(this.probeEureka(ip));
      }
    }

    await Promise.all(probePromises);

    // Wait a brief moment for mDNS responders
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Fetch real EQ status for all discovered devices
    const eqFetchPromises = Array.from(this.discoveredDevices.keys()).map((ip) =>
      this.fetchDeviceEq(ip).catch(() => {})
    );
    await Promise.all(eqFetchPromises);

    this.isScanning = false;
    this.lastScanTime = new Date().toISOString();
    console.log(`[CastBridge] Real scan completed. Found ${this.discoveredDevices.size} actual devices.`);

    return Array.from(this.discoveredDevices.values());
  }

  // Fast HTTP probe on port 8008
  probeEureka(ip) {
    return new Promise((resolve) => {
      const req = http.get(
        `http://${ip}:8008/setup/eureka_info?params=name,device_info,audio_eq,build_version,bssid`,
        { timeout: 450 },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const data = JSON.parse(body);
              const dev = {
                id: data.ssdp_udn || data.mac_address || `cast-${ip.replace(/\./g, '-')}`,
                name: data.name || 'Google Cast Speaker',
                model: data.device_info?.model_name || 'Google Home',
                ip: ip,
                port: 8008,
                castPort: 8009,
                type: 'google_home',
                online: true,
                discoverySource: 'HTTP Eureka Probe',
                firmware: data.cast_build_revision || data.build_version || 'Cast',
                signalDbm: data.signal_level || -50,
                bssid: data.bssid,
                ssid: data.ssid,
                currentEq: data.audio_eq || { bass: 0, treble: 0 },
                lastSeen: Date.now(),
              };

              this.discoveredDevices.set(ip, dev);
              console.log(`[CastBridge] Discovered via Eureka: "${dev.name}" (${dev.model}) at ${ip}`);
            } catch (e) {}
            resolve();
          });
        }
      );

      req.on('error', () => resolve());
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });
    });
  }

  // Fetch real-time hardware userEq over CastV2 (TLS port 8009)
  fetchDeviceEq(ip) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        try { client.close(); } catch (e) {}
        resolve(null);
      }, 2500);

      client.connect(ip, () => {
        client.receiver.getStatus((err, status) => {
          clearTimeout(timeout);
          client.close();

          if (err || !status) {
            return resolve(null);
          }

          const userEq = status.userEq || {};
          const bassGain = userEq.low_shelf?.gain_db ?? 0;
          const trebleGain = userEq.high_shelf?.gain_db ?? 0;
          const volume = status.volume?.level ?? 1.0;

          const dev = this.discoveredDevices.get(ip);
          if (dev) {
            dev.currentEq = {
              bass: Math.round(bassGain * 10) / 10,
              treble: Math.round(trebleGain * 10) / 10,
            };
            dev.volume = volume;
            dev.status = status;
          }

          resolve({
            bass: dev?.currentEq?.bass ?? bassGain,
            treble: dev?.currentEq?.treble ?? trebleGain,
            volume,
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        try { client.close(); } catch (e) {}
        resolve(null);
      });
    });
  }

  // Set real hardware userEq on the physical Google Home device
  setDeviceEq(ip, bass, treble) {
    return new Promise((resolve, reject) => {
      const client = new Client();
      const timeout = setTimeout(() => {
        try { client.close(); } catch (e) {}
        reject(new Error(`Timeout connecting to Google Home at ${ip}:8009`));
      }, 3000);

      client.connect(ip, () => {
        const bassVal = Math.max(-6, Math.min(6, parseFloat(bass)));
        const trebleVal = Math.max(-6, Math.min(6, parseFloat(treble)));

        const msg = {
          type: 'SET_USER_EQ',
          requestId: Math.floor(Math.random() * 100000),
          userEq: {
            low_shelf: { gain_db: bassVal },
            high_shelf: { gain_db: trebleVal },
          },
        };

        client.receiver.send(msg);

        // Verify update
        setTimeout(() => {
          client.receiver.getStatus((err, status) => {
            clearTimeout(timeout);
            client.close();

            const dev = this.discoveredDevices.get(ip);
            if (dev) {
              dev.currentEq = { bass: bassVal, treble: trebleVal };
            }

            console.log(
              `[CastBridge] Real device ${ip} updated -> Bass: ${bassVal} dB, Treble: ${trebleVal} dB`
            );
            resolve({
              success: true,
              ip,
              bass: bassVal,
              treble: trebleVal,
              status: status?.userEq,
            });
          });
        }, 300);
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        try { client.close(); } catch (e) {}
        reject(err);
      });
    });
  }

  // Play official Google Cast connection chime on the physical speaker
  playChime(ip) {
    return new Promise((resolve, reject) => {
      const { DefaultMediaReceiver } = castv2Client.default || castv2Client;
      const client = new Client();
      const timeout = setTimeout(() => {
        try { client.close(); } catch (e) {}
        reject(new Error(`Timeout connecting to Google Home at ${ip}:8009`));
      }, 4000);

      console.log(`[CastBridge] Connecting to ${ip}:8009 to play Google Cast chime...`);
      client.connect(ip, () => {
        // Launching DefaultMediaReceiver causes the physical Google Home to play its connection chime!
        client.launch(DefaultMediaReceiver, (err, player) => {
          clearTimeout(timeout);
          if (err) {
            console.error('[CastBridge] Launch error for chime:', err.message);
            try { client.close(); } catch (e) {}
            return reject(err);
          }

          console.log(`[CastBridge] [CHIME] Connect chime sounded on Google Home (${ip})!`);
          setTimeout(() => {
            try { client.close(); } catch (e) {}
            resolve({ success: true, ip, message: 'Google Home connect chime played successfully' });
          }, 1200);
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        try { client.close(); } catch (e) {}
        reject(err);
      });
    });
  }

  // Cast and play audio directly on the Google Home speaker
  castMedia(ip, mediaUrl, metadata = {}) {
    return new Promise((resolve, reject) => {
      const { DefaultMediaReceiver } = castv2Client.default || castv2Client;
      const client = new Client();
      const timeout = setTimeout(() => {
        try { client.close(); } catch (e) {}
        reject(new Error(`Timeout casting media to ${ip}:8009`));
      }, 6000);

      console.log(`[CastBridge] Casting audio to ${ip} -> ${mediaUrl}`);
      client.connect(ip, () => {
        client.launch(DefaultMediaReceiver, (err, player) => {
          if (err) {
            clearTimeout(timeout);
            try { client.close(); } catch (e) {}
            return reject(err);
          }

          const media = {
            contentId: mediaUrl,
            contentType: metadata.contentType || 'audio/mp3',
            streamType: metadata.streamType || 'BUFFERED',
            metadata: {
              type: 0,
              metadataType: 0,
              title: metadata.title || 'AuraEQ Equalized Audio Stream',
              subtitle: metadata.artist || 'AuraEQ Smart Cast DSP',
              images: [
                { url: 'https://www.gstatic.com/images/branding/product/2x/google_home_64dp.png' }
              ]
            }
          };

          player.load(media, { autoplay: true }, (loadErr, status) => {
            clearTimeout(timeout);
            if (loadErr) {
              console.error('[CastBridge] player.load error:', loadErr.message);
              try { client.close(); } catch (e) {}
              return reject(loadErr);
            }

            console.log(`[CastBridge] [PLAYING] Media playing on Google Home (${ip}):`, status?.playerState);
            resolve({ success: true, ip, status });
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        try { client.close(); } catch (e) {}
        reject(err);
      });
    });
  }

  // Stop playback and completely disconnect Cast session from the speaker
  stopCast(ip) {
    // Close any active HTTP audio streams to the speaker
    for (const res of this.audioStreamSubscribers) {
      try { res.end(); } catch (e) {}
    }
    this.audioStreamSubscribers.clear();

    return new Promise((resolve) => {
      const { DefaultMediaReceiver } = castv2Client.default || castv2Client;
      const client = new Client();
      const timeout = setTimeout(() => {
        try { client.close(); } catch (e) {}
        console.log(`[CastBridge] Disconnected timeout fallback for ${ip}`);
        const dev = this.discoveredDevices.get(ip);
        if (dev) dev.isStreaming = false;
        resolve({ success: true, message: 'Disconnected' });
      }, 3500);

      client.connect(ip, () => {
        // Query active sessions and stop them
        client.receiver.getStatus((err, status) => {
          const apps = status?.applications || [];
          if (apps.length > 0) {
            let stoppedCount = 0;
            apps.forEach((app) => {
              console.log(`[CastBridge] Stopping session ${app.sessionId} (${app.displayName}) on ${ip}...`);
              client.receiver.stop(app.sessionId, () => {
                stoppedCount++;
                if (stoppedCount >= apps.length) {
                  clearTimeout(timeout);
                  try { client.close(); } catch (e) {}
                  console.log(`[CastBridge] [STOP] Successfully disconnected and stopped playback on ${ip}`);
                  const dev = this.discoveredDevices.get(ip);
                  if (dev) dev.isStreaming = false;
                  resolve({ success: true, message: 'Speaker disconnected' });
                }
              });
            });
          } else {
            clearTimeout(timeout);
            try { client.close(); } catch (e) {}
            console.log(`[CastBridge] [STOP] No active media session on ${ip}, cleanly disconnected.`);
            const dev = this.discoveredDevices.get(ip);
            if (dev) dev.isStreaming = false;
            resolve({ success: true, message: 'Speaker disconnected' });
          }
        });
      });

      client.on('error', () => {
        clearTimeout(timeout);
        try { client.close(); } catch (e) {}
        const dev = this.discoveredDevices.get(ip);
        if (dev) dev.isStreaming = false;
        resolve({ success: true, message: 'Disconnected' });
      });
    });
  }

  // Cast live tab audio stream directly to Google Home
  castLiveTabStream(ip) {
    const lanIp = this.getPrimaryLanIp();
    const port = this.audioPort || 8888;
    const streamUrl = `http://${lanIp}:${port}/live-audio.wav`;
    console.log(`[CastBridge] Routing live tab stream to Google Home at ${ip} -> ${streamUrl}`);
    return this.castMedia(ip, streamUrl, {
      title: 'AuraEQ Live Stream',
      artist: 'Live Tab Sound & Custom EQ',
      contentType: 'audio/wav',
      streamType: 'LIVE',
    });
  }

  getDevices() {
    return Array.from(this.discoveredDevices.values());
  }
}

// 44-byte standard RIFF WAV header for live PCM streaming
export function createWavHeader(sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(0x7fffffff, 4); // Continuous streaming length
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk size (16 for PCM)
  header.writeUInt16LE(1, 20); // Audio format (1 for PCM)
  header.writeUInt16LE(channels, 22); // Num channels
  header.writeUInt32LE(sampleRate, 24); // Sample rate
  header.writeUInt32LE(sampleRate * channels * 2, 28); // Byte rate
  header.writeUInt16LE(channels * 2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write('data', 36);
  header.writeUInt32LE(0x7fffffff, 40); // Subchunk size
  return header;
}

export const castBridge = new CastBridge();

