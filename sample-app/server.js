import express from 'express';
import https from 'https';
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { YoloDetector } from './detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const REC_DIR = path.join(__dirname, 'recordings');
mkdirSync(REC_DIR, { recursive: true });

const app = express();
app.use(express.json());
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// ── Detector ──────────────────────────────────────────────────────────────────
const detector = new YoloDetector('/root/models/yolov8n.onnx', '/root/models/coco.names', 0.4);
detector.load().then(() => console.log('✓ YOLO loaded')).catch(e => console.warn('YOLO skip:', e.message));

// ── Recording helpers ─────────────────────────────────────────────────────────
// autoRemove: { value: number, unit: 'days'|'months'|'years' }
function autoRemoveMs({ value, unit }) {
  const v = Number(value) || 0;
  if (unit === 'years')  return v * 365 * 24 * 3600 * 1000;
  if (unit === 'months') return v * 30  * 24 * 3600 * 1000;
  return v * 24 * 3600 * 1000; // days
}

function startRecording(channelId) {
  const dir = path.join(REC_DIR, channelId);
  mkdirSync(dir, { recursive: true });
  const pattern = path.join(dir, '%Y%m%d_%H%M%S.mp4');
  // segment every 5 minutes (300s)
  const proc = spawn('ffmpeg', [
    '-f', 'mjpeg', '-i', `http://localhost:${PORT}/stream/${channelId}`,
    '-c:v', 'libx264', '-crf', '28', '-preset', 'ultrafast',
    '-f', 'segment', '-segment_time', '300',
    '-segment_format', 'mp4',
    '-strftime', '1', pattern,
  ], { stdio: 'ignore' });
  proc.on('error', e => console.error(`rec[${channelId}] error:`, e.message));
  return proc;
}

function pruneRecordings(channelId, maxMs) {
  if (!maxMs || maxMs <= 0) return;
  const dir = path.join(REC_DIR, channelId);
  if (!existsSync(dir)) return;
  const now = Date.now();
  for (const f of readdirSync(dir)) {
    const fp = path.join(dir, f);
    try {
      if (now - statSync(fp).mtimeMs > maxMs) { unlinkSync(fp); console.log(`pruned ${fp}`); }
    } catch {}
  }
}

// ── CameraManager ─────────────────────────────────────────────────────────────
// channel schema: { id, type, url?, name, recording, autoRemove:{value,unit}, mjpegClients, wsViewers, ffmpegProc, recProc, lastFrame, lastDet }
class CameraManager {
  constructor() { this.channels = new Map(); }

  get(id) { return this.channels.get(id); }

  _make(id, type, url, name) {
    return { id, type, url: url||null, name: name||id, recording: false, autoRemove: { value: 0, unit: 'days' }, mjpegClients: new Set(), wsViewers: new Set(), ffmpegProc: null, recProc: null, lastFrame: null, lastDet: 0 };
  }

  addBrowser(id, name) {
    if (!this.channels.has(id)) this.channels.set(id, this._make(id, 'browser', null, name||id));
    return this.channels.get(id);
  }

  addRtsp(id, url, name) {
    if (this.channels.has(id)) return null;
    const ch = this._make(id, 'rtsp', url, name);
    this.channels.set(id, ch);
    this._startStream(id, ch);
    return ch;
  }

  _startStream(id, ch) {
    const proc = spawn('ffmpeg', ['-rtsp_transport','tcp','-i',ch.url,'-f','image2pipe','-vcodec','mjpeg','-q:v','5','-vf','fps=15','pipe:1'], { stdio: ['ignore','pipe','ignore'] });
    ch.ffmpegProc = proc;
    let buf = Buffer.alloc(0);
    const SOI = Buffer.from([0xFF, 0xD8]), EOI = Buffer.from([0xFF, 0xD9]);
    proc.stdout.on('data', chunk => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length > 4 * 1024 * 1024) buf = Buffer.alloc(0); // safety cap
      let s, e;
      while ((s = buf.indexOf(SOI)) !== -1 && (e = buf.indexOf(EOI, s + 2)) !== -1) {
        const frame = buf.slice(s, e + 2);
        buf = buf.slice(e + 2);
        this._onFrame(id, ch, frame);
      }
    });
    proc.on('exit', () => {
      ch.ffmpegProc = null;
      if (this.channels.has(id)) setTimeout(() => { if (this.channels.has(id)) this._startStream(id, ch); }, 3000);
    });
  }

  _onFrame(id, ch, frame) {
    ch.lastFrame = frame;
    broadcastMjpeg(ch, frame);
    maybeDetect(id, ch, frame);
  }

  update(id, patch) {
    const ch = this.channels.get(id);
    if (!ch) return null;
    if (patch.name      !== undefined) ch.name       = patch.name;
    if (patch.autoRemove !== undefined) ch.autoRemove = patch.autoRemove;
    if (patch.recording !== undefined) {
      if (patch.recording && !ch.recording) {
        ch.recProc = startRecording(id);
      } else if (!patch.recording && ch.recording) {
        ch.recProc?.kill('SIGTERM'); ch.recProc = null;
      }
      ch.recording = patch.recording;
    }
    return ch;
  }

  onBrowserFrame(id, frame) {
    const ch = this.get(id);
    if (ch) this._onFrame(id, ch, frame);
  }

  remove(id) {
    const ch = this.channels.get(id);
    if (!ch) return false;
    ch.ffmpegProc?.kill('SIGKILL');
    ch.recProc?.kill('SIGTERM');
    for (const r of ch.mjpegClients) try { r.end(); } catch {}
    this.channels.delete(id);
    return true;
  }

  list() {
    return [...this.channels.entries()].map(([id, ch]) => ({
      id, type: ch.type, url: ch.url, name: ch.name,
      recording: ch.recording, autoRemove: ch.autoRemove,
      active: ch.type === 'browser' ? !!ch.lastFrame : !!ch.ffmpegProc,
      viewers: ch.mjpegClients.size + ch.wsViewers.size,
    }));
  }
}

const mgr = new CameraManager();

// ── Prune job every 1h ────────────────────────────────────────────────────────
setInterval(() => {
  for (const ch of mgr.channels.values()) {
    const ms = autoRemoveMs(ch.autoRemove);
    if (ms > 0) pruneRecordings(ch.id, ms);
  }
}, 3600 * 1000);

// ── MJPEG helpers ─────────────────────────────────────────────────────────────
function broadcastMjpeg(ch, frame) {
  const h = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`;
  for (const r of ch.mjpegClients) {
    try { r.write(Buffer.from(h)); r.write(frame); r.write('\r\n'); }
    catch { ch.mjpegClients.delete(r); }
  }
}

async function maybeDetect(channelId, ch, frame) {
  const now = Date.now();
  if (now - ch.lastDet < 300) return;
  ch.lastDet = now;
  try {
    const det = await detector.detect(frame, channelId);
    if (det?.objects?.length) {
      const msg = JSON.stringify({ type: 'detection', channel: channelId, camera_id: channelId, timestamp: det.timestamp, objects: det.objects });
      for (const ws of ch.wsViewers) if (ws.readyState === 1) ws.send(msg);
      // Also broadcast to global viewers (no channel filter)
      for (const ws of wss.clients) if (ws.role === 'global' && ws.readyState === 1) ws.send(msg);
    }
  } catch {}
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
let server;
try {
  server = https.createServer({ key: readFileSync('key.pem'), cert: readFileSync('cert.pem') }, app);
  console.log('HTTPS mode');
} catch { server = http.createServer(app); console.log('HTTP mode'); }

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const p = new URL(req.url, 'https://x').searchParams;
  const role = p.get('role') || 'global';
  const channelId = p.get('channel');
  ws.role = role;

  if (role === 'sender' && channelId) {
    const name = p.get('name') || channelId;
    const ch = mgr.addBrowser(channelId, name);
    ws.on('message', (data, isBinary) => { if (isBinary) mgr.onBrowserFrame(channelId, Buffer.from(data)); });
    ws.on('close', () => { ch.lastFrame = null; console.log(`sender left [${channelId}]`); });
    console.log(`sender connected [${channelId}]`);
  } else if (role === 'viewer' && channelId) {
    const ch = mgr.get(channelId) || mgr.addBrowser(channelId);
    ch.wsViewers.add(ws);
    ws.on('close', () => ch.wsViewers.delete(ws));
  }
  // global = dashboard WS, just receives all detection events
});

// ── REST ──────────────────────────────────────────────────────────────────────
app.options('/{*path}', (_, res) => res.sendStatus(204));

app.get('/api/channels', (_, res) => res.json(mgr.list()));

app.post('/api/channels', (req, res) => {
  const { id, url, name } = req.body;
  if (!id || !url) return res.status(400).json({ error: 'id and url required' });
  const ch = mgr.addRtsp(id.trim(), url.trim(), name?.trim());
  if (!ch) return res.status(409).json({ error: 'Channel ID already exists' });
  res.status(201).json({ id, type: 'rtsp', url, name: name||id, active: true });
});

app.put('/api/channels/:id', (req, res) => {
  const ch = mgr.update(req.params.id, req.body);
  if (!ch) return res.status(404).json({ error: 'not found' });
  res.json({ id: ch.id, recording: ch.recording, autoRemove: ch.autoRemove, name: ch.name });
});

app.delete('/api/channels/:id', (req, res) => {
  if (!mgr.remove(req.params.id)) return res.status(404).json({ error: 'not found' });
  res.sendStatus(204);
});

app.get('/api/recordings', (_, res) => {
  if (!existsSync(REC_DIR)) return res.json([]);
  const cams = readdirSync(REC_DIR).filter(f => statSync(path.join(REC_DIR, f)).isDirectory());
  res.json(cams);
});

app.get('/api/recordings/:channelId', (req, res) => {
  const dir = path.join(REC_DIR, req.params.channelId);
  if (!existsSync(dir)) return res.json([]);
  const files = readdirSync(dir).map(f => {
    const fp = path.join(dir, f);
    const { size, mtimeMs } = statSync(fp);
    return { name: f, size, mtime: mtimeMs, url: `/recordings/${req.params.channelId}/${f}` };
  }).sort((a, b) => b.mtime - a.mtime);
  res.json(files);
});

// Serve recording files
app.use('/recordings', express.static(REC_DIR));

app.get('/stream/:channelId', (req, res) => {
  const ch = mgr.get(req.params.channelId);
  if (!ch) return res.status(404).send('channel not found');
  res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  ch.mjpegClients.add(res);
  if (ch.lastFrame) { const h = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${ch.lastFrame.length}\r\n\r\n`; res.write(Buffer.from(h)); res.write(ch.lastFrame); res.write('\r\n'); }
  req.on('close', () => ch.mjpegClients.delete(res));
});

// ── SPA ───────────────────────────────────────────────────────────────────────
const dist = path.join(__dirname, 'dist');
app.use(express.static(dist));
app.use((_, res) => {
  const idx = path.join(dist, 'index.html');
  existsSync(idx) ? res.sendFile(idx) : res.status(404).send('Run: npm run build');
});

server.listen(PORT, '0.0.0.0', () => console.log(`listening on port ${PORT}`));
process.on('SIGINT', () => { [...mgr.channels.keys()].forEach(id => mgr.remove(id)); process.exit(0); });
