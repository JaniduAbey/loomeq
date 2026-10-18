import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { castBridge, createWavHeader } from './server/castBridge.js';

function castApiPlugin() {
  return {
    name: 'cast-api-bridge',
    configureServer(server) {
      // Trigger initial real scan in background
      castBridge.scan().catch((err) => console.error('Initial scan error:', err));

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost:5173');

        // GET /api/live-stream.wav -> Real-time HTTP chunked WAV stream for Google Home
        if (req.method === 'GET' && url.pathname === '/api/live-stream.wav') {
          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Accept-Ranges': 'none',
            'Access-Control-Allow-Origin': '*',
          });
          res.write(createWavHeader(44100, 2));
          // Pre-buffer 0.4s of 16-bit stereo silence so Google Home immediately transitions to PLAYING
          const prebuffer = Buffer.alloc(Math.floor(44100 * 2 * 2 * 0.4));
          res.write(prebuffer);
          castBridge.audioStreamSubscribers.add(res);
          console.log(`[CastBridge] Google Home speaker connected to live audio stream!`);

          req.on('close', () => {
            castBridge.audioStreamSubscribers.delete(res);
            console.log(`[CastBridge] Google Home speaker disconnected from stream.`);
          });
          return;
        }

        // POST /api/live-audio-chunk -> Browser sends PCM buffer of captured YouTube / tab audio
        if (req.method === 'POST' && url.pathname === '/api/live-audio-chunk') {
          const chunks = [];
          req.on('data', (c) => chunks.push(c));
          req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            castBridge.broadcastAudioChunk(buffer);
            res.statusCode = 200;
            res.end('ok');
          });
          return;
        }

        // POST /api/set-sample-rate?rate=... -> browser syncs its audio context sample rate
        if (req.method === 'POST' && url.pathname === '/api/set-sample-rate') {
          const rate = url.searchParams.get('rate');
          castBridge.setSampleRate(rate);
          res.statusCode = 200;
          res.end('ok');
          return;
        }

        // POST /api/devices/cast-live -> command Google Home to start streaming live tab audio
        if (req.method === 'POST' && url.pathname === '/api/devices/cast-live') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = await castBridge.castLiveTabStream(data.ip);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // GET /api/devices -> returns real discovered devices
        if (req.method === 'GET' && url.pathname === '/api/devices') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(castBridge.getDevices()));
          return;
        }

        // POST /api/scan -> triggers fresh scan
        if (req.method === 'POST' && url.pathname === '/api/scan') {
          const devices = await castBridge.scan();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(devices));
          return;
        }

        // GET /api/devices/eq?ip=... -> get real EQ
        if (req.method === 'GET' && url.pathname === '/api/devices/eq') {
          const ip = url.searchParams.get('ip');
          if (!ip) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Missing IP' }));
            return;
          }
          const eq = await castBridge.fetchDeviceEq(ip);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(eq || {}));
          return;
        }

        // POST /api/devices/eq -> set real EQ on physical device
        if (req.method === 'POST' && url.pathname === '/api/devices/eq') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body);
              const result = await castBridge.setDeviceEq(data.ip, data.bass, data.treble);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // POST /api/devices/chime -> play connection chime on physical speaker
        if (req.method === 'POST' && url.pathname === '/api/devices/chime') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = await castBridge.playChime(data.ip);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // POST /api/devices/cast-media -> stream audio to Google Home speaker
        if (req.method === 'POST' && url.pathname === '/api/devices/cast-media') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              // Pure high-fidelity stereo MP3 audio (plays natively on audio-only Google Home speakers)
              const mediaUrl = data.url || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
              const result = await castBridge.castMedia(data.ip, mediaUrl, data.metadata);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // POST /api/devices/stop-cast or /api/devices/disconnect -> stop media playback and disconnect
        if (req.method === 'POST' && (url.pathname === '/api/devices/stop-cast' || url.pathname === '/api/devices/disconnect')) {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const data = JSON.parse(body || '{}');
              const result = await castBridge.stopCast(data.ip);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), castApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    cors: true,
  },
});

