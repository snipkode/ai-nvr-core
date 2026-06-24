import express from 'express';
import https from 'https';
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { YoloDetector } from './detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use((_, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); next(); });

// ── Detector ─────────────────────────────────────────────────────────────────
const detector = new YoloDetector('/root/models/yolov8n.onnx', '/root/models/coco.names', 0.4);
detector.load().then(() => console.log('✓ YOLO loaded')).catch(e => console.warn('YOLO skip:', e.message));

// ── CameraManager ─────────────────────────────────────────────────────────────
// channel: { type:'browser'|'rtsp', url?, mjpegClients:Set, wsViewers:Set, ffmpegProc?, lastFrame?, lastDet }
class CameraManager {
  constructor() { this.channels = new Map(); }

  get(id) { return this.channels.get(id); }

  addBrowser(id) {
    if (!this.channels.has(id)) this.channels.set(id, { type: 'browser', mjpegClients: new Set(), wsViewers: new Set(), lastFrame: null, lastDet: 0 });
    return this.channels.get(id);
  }

  addRtsp(id, url) {
    if (this.channels.has(id)) return null;
    const ch = { type: 'rtsp', url, mjpegClients: new Set(), wsViewers: new Set(), ffmpegProc: null, lastFrame: null, lastDet: 0 };
    this.channels.set(id, ch);
    this._startFfmpeg(id, ch, url);
    return ch;
  }

  remove(id) {
    const ch = this.channels.get(id);
    if (!ch) return false;
    if (ch.ffmpegProc) { ch.ffmpegProc.kill('SIGKILL'); ch.ffmpegProc = null; }
    for (const r of ch.mjpegClients) try { r.end(); } catch {}
    this.channels.delete(id);
    return true;
  }

  _startFfmpeg(id, ch, url) {
    const proc = spawn('ffmpeg', ['-rtsp_transport','tcp','-i',url,'-f','image2pipe','-vcodec','mjpeg','-q:v','5','-vf','fps=15','pipe:1'], { stdio: ['ignore','pipe','ignore'] });
    ch.ffmpegProc = proc;
    let buf = Buffer.alloc(0);
    proc.stdout.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      let soi, eoi;
      while ((soi = buf.indexOf(Buffer.from([0xFF,0xD8]))) !== -1 && (eoi = buf.indexOf(Buffer.from([0xFF,0xD9]), soi + 2)) !== -1) {
        const frame = buf.slice(soi, eoi + 2);
        buf = buf.slice(eoi + 2);
        ch.lastFrame = frame;
        broadcastMjpeg(ch, frame);
        maybeDetect(id, ch, frame);
      }
    });
    proc.on('exit', (code) => {
      if (this.channels.has(id)) { console.log(`ffmpeg[${id}] exited ${code}, restarting in 3s`); setTimeout(() => { if (this.channels.has(id)) this._startFfmpeg(id, ch, url); }, 3000); }
    });
  }

  list() {
    return [...this.channels.entries()].map(([id, ch]) => ({
      id, type: ch.type, url: ch.url, active: ch.type === 'browser' ? true : !!ch.ffmpegProc, viewers: ch.mjpegClients.size + ch.wsViewers.size
    }));
  }
}

const mgr = new CameraManager();

// ── MJPEG helpers ─────────────────────────────────────────────────────────────
function broadcastMjpeg(ch, frame) {
  const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
  for (const res of ch.mjpegClients) try { res.write(Buffer.from(header)); res.write(frame); res.write('\r\n'); } catch { ch.mjpegClients.delete(res); }
}

async function maybeDetect(channelId, ch, frame) {
  const now = Date.now();
  if (now - ch.lastDet < 300) return;
  ch.lastDet = now;
  try {
    const det = await detector.detect(frame, channelId);
    if (det?.objects?.length) {
      const msg = JSON.stringify({ type: 'detection', channel: channelId, ...det });
      for (const ws of ch.wsViewers) if (ws.readyState === 1) ws.send(msg);
    }
  } catch {}
}

// ── Server ────────────────────────────────────────────────────────────────────
let server;
try {
  server = https.createServer({ key: readFileSync('key.pem'), cert: readFileSync('cert.pem') }, app);
  console.log('HTTPS mode');
} catch { server = http.createServer(app); console.log('HTTP mode'); }

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const params = new URL(req.url, 'https://x').searchParams;
  const role = params.get('role');
  const channelId = params.get('channel') || 'default';

  if (role === 'sender') {
    const ch = mgr.addBrowser(channelId);
    ws.on('message', (data, isBinary) => {
      if (!isBinary) return;
      ch.lastFrame = data;
      broadcastMjpeg(ch, data);
      maybeDetect(channelId, ch, data);
    });
    ws.on('close', () => console.log(`sender left [${channelId}]`));
    console.log(`sender connected [${channelId}]`);
  } else {
    // viewer
    const ch = mgr.get(channelId) || mgr.addBrowser(channelId);
    ch.wsViewers.add(ws);
    if (ch.lastFrame) ws.send(JSON.stringify({ type: 'frame', channel: channelId })); // notify ready
    ws.on('close', () => ch.wsViewers.delete(ws));
  }
});

// ── REST API ──────────────────────────────────────────────────────────────────
app.options('/{*path}', (_, res) => res.sendStatus(204));

app.get('/api/channels', (_, res) => res.json(mgr.list()));

app.post('/api/channels', (req, res) => {
  const { id, url } = req.body;
  if (!id || !url) return res.status(400).json({ error: 'id and url required' });
  const ch = mgr.addRtsp(id, url);
  if (!ch) return res.status(409).json({ error: 'channel exists' });
  res.status(201).json({ id, type: 'rtsp', url, active: true });
});

app.delete('/api/channels/:id', (req, res) => {
  if (!mgr.remove(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.sendStatus(204);
});

// ── MJPEG stream ──────────────────────────────────────────────────────────────
app.get('/stream/:channelId', (req, res) => {
  const ch = mgr.get(req.params.channelId);
  if (!ch) return res.status(404).send('channel not found');
  res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  ch.mjpegClients.add(res);
  if (ch.lastFrame) broadcastMjpeg({ mjpegClients: new Set([res]) }, ch.lastFrame);
  req.on('close', () => ch.mjpegClients.delete(res));
});

// ── Static / SPA ──────────────────────────────────────────────────────────────
const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
app.use((_, res) => {
  const idx = path.join(dist, 'index.html');
  existsSync(idx) ? res.sendFile(idx) : res.status(404).send('Build not found — run: npm run build');
});

server.listen(PORT, '0.0.0.0', () => console.log(`listening on port ${PORT}`));
process.on('SIGINT', () => { [...mgr.channels.keys()].forEach(id => mgr.remove(id)); process.exit(0); });
