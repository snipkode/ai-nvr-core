import express from 'express';
import https from 'https';
import http from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, rmSync } from 'fs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';
import { YoloDetector } from './detector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const REC_DIR = path.join(__dirname, 'recordings');
mkdirSync(REC_DIR, { recursive: true });

// ── Persistence ───────────────────────────────────────────────────────────────
const DB_FILE = path.join(__dirname, 'data', 'db.json');
mkdirSync(path.dirname(DB_FILE), { recursive: true });
function dbLoad() {
  try { return JSON.parse(readFileSync(DB_FILE, 'utf8')); } catch { return { channels: [] }; }
}
function dbSave(channels) {
  writeFileSync(DB_FILE, JSON.stringify({ channels }, null, 2));
}

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
  // Use a segment list file so ffmpeg names segments by index, then we rename them
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const pattern = path.join(dir, `${ts}_%03d.mp4`);
  const proc = spawn('ffmpeg', [
    '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '15', '-i', 'pipe:0',
    '-c:v', 'libx264', '-crf', '28', '-preset', 'ultrafast',
    '-f', 'segment', '-segment_time', '300', '-segment_format', 'mp4',
    '-reset_timestamps', '1', pattern,
  ], { stdio: ['pipe', 'ignore', 'pipe'] });
  proc.stderr.on('data', () => {}); // drain stderr to avoid blocking
  proc.on('error', e => console.error(`rec[${channelId}] error:`, e.message));
  proc.on('exit', (code) => console.log(`rec[${channelId}] exited code=${code}`));
  proc.writeFrame = (jpegBuf) => {
    try { if (proc.stdin.writable) proc.stdin.write(jpegBuf); } catch {}
  };
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
    return { id, type, url: url||null, name: name||id, recording: false, autoRemove: { value: 0, unit: 'days' }, rotate: 0, mjpegClients: new Set(), wsViewers: new Set(), ffmpegProc: null, recProc: null, lastFrame: null, lastDet: 0 };
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
    const vf = 'fps=15,scale=640:-2';
    const isRtsp = ch.url.startsWith('rtsp://');
    const args = [
      ...(isRtsp ? ['-rtsp_transport','tcp'] : []),
      '-loglevel', 'error',
      '-i', ch.url,
      '-f','image2pipe','-vcodec','mjpeg','-q:v','5','-vf',vf,'pipe:1'
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore','pipe','pipe'] });
    ch.ffmpegProc = proc;
    proc.stderr.on('data', d => {
      const line = d.toString().trim().split('\n').pop();
      if (line && !line.startsWith('  ') && !line.startsWith('lib')) console.error(`stream[${id}]`, line);
    });
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
    if (ch.recording && ch.recProc?.writeFrame) ch.recProc.writeFrame(frame);
  }

  update(id, patch) {
    const ch = this.channels.get(id);
    if (!ch) return null;
    if (patch.name      !== undefined) ch.name       = patch.name;
    if (patch.autoRemove !== undefined) ch.autoRemove = patch.autoRemove;
    if (patch.url !== undefined && ch.type === 'rtsp' && patch.url.trim()) {
      ch.url = patch.url.trim();
      if (ch.ffmpegProc) ch.ffmpegProc.kill('SIGKILL'); // restarts via exit handler with new url
    }
    if (patch.rotate !== undefined) {
      ch.rotate = Number(patch.rotate) || 0;
    }
    if (patch.recording !== undefined) {
      if (patch.recording && !ch.recording) {
        ch.recProc = startRecording(id);
      } else if (!patch.recording && ch.recording) {
        const rp = ch.recProc;
        ch.recProc = null;
        if (rp) {
          try { rp.stdin.end(); } catch {}
          setTimeout(() => { try { rp.kill('SIGTERM'); } catch {} }, 2000);
        }
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
    try { ch.recProc?.stdin?.end(); } catch {}
    ch.recProc?.kill('SIGTERM');
    for (const r of ch.mjpegClients) try { r.end(); } catch {}
    this.channels.delete(id);
    return true;
  }

  list() {
    return [...this.channels.entries()].map(([id, ch]) => ({
      id, type: ch.type, url: ch.url, name: ch.name,
      recording: ch.recording, autoRemove: ch.autoRemove, rotate: ch.rotate,
      active: ch.type === 'browser' ? !!ch.lastFrame : !!ch.ffmpegProc,
      viewers: ch.mjpegClients.size + ch.wsViewers.size,
    }));
  }
}

const mgr = new CameraManager();

// ── Restore persisted channels ────────────────────────────────────────────────
{
  const { channels } = dbLoad();
  for (const c of channels) {
    if (c.type === 'rtsp' && c.url) {
      const ch = mgr.addRtsp(c.id, c.url, c.name);
      if (ch) {
        ch.recording  = c.recording  ?? false;
        ch.autoRemove = c.autoRemove ?? { value: 0, unit: 'days' };
        ch.rotate     = c.rotate     ?? 0;
        if (ch.recording) ch.recProc = startRecording(c.id);
      }
    }
  }
  console.log(`Loaded ${channels.length} channel(s) from db`);
}

// ── Persist helper ────────────────────────────────────────────────────────────
function persist() {
  dbSave(mgr.list().filter(c => c.type === 'rtsp').map(c => ({
    id: c.id, type: c.type, url: c.url, name: c.name,
    recording: c.recording, autoRemove: c.autoRemove, rotate: c.rotate,
  })));
}

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
  server = https.createServer({ key: readFileSync('/etc/letsencrypt/live/perumdati.tech-0001/privkey.pem'), cert: readFileSync('/etc/letsencrypt/live/perumdati.tech-0001/fullchain.pem') }, app);
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
  const { url, name } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const id = randomUUID().slice(0, 8);
  const ch = mgr.addRtsp(id, url.trim(), name?.trim());
  if (!ch) return res.status(409).json({ error: 'Channel ID already exists' });
  persist();
  res.status(201).json({ id, type: 'rtsp', url, name: name||id, active: true });
});

app.put('/api/channels/:id', (req, res) => {
  const ch = mgr.update(req.params.id, req.body);
  if (!ch) return res.status(404).json({ error: 'not found' });
  persist();
  res.json({ id: ch.id, recording: ch.recording, autoRemove: ch.autoRemove, name: ch.name });
});

app.delete('/api/channels/:id', (req, res) => {
  if (!mgr.remove(req.params.id)) return res.status(404).json({ error: 'not found' });
  const dir = path.join(REC_DIR, req.params.id);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  persist();
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
  const files = readdirSync(dir)
    .filter(f => f.endsWith('.mp4'))
    .map(f => {
      const fp = path.join(dir, f);
      const { size, mtimeMs } = statSync(fp);
      return { name: f, size, mtime: mtimeMs, url: `/recordings/${req.params.channelId}/${f}` };
    }).sort((a, b) => b.mtime - a.mtime);
  res.json(files);
});

app.delete('/api/recordings/:channelId', (req, res) => {
  const dir = path.join(REC_DIR, req.params.channelId);
  if (!existsSync(dir)) return res.status(404).json({ error: 'not found' });
  try { rmSync(dir, { recursive: true, force: true }); res.sendStatus(204); } catch { res.status(500).json({ error: 'delete failed' }); }
});

app.delete('/api/recordings/:channelId/:file', (req, res) => {
  const dir = path.join(REC_DIR, req.params.channelId);
  const fp = path.join(dir, path.basename(req.params.file));
  if (!existsSync(fp)) return res.status(404).json({ error: 'not found' });
  try {
    unlinkSync(fp);
    // Remove folder if empty
    if (readdirSync(dir).length === 0) rmSync(dir, { force: true });
    res.sendStatus(204);
  } catch { res.status(500).json({ error: 'delete failed' }); }
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
