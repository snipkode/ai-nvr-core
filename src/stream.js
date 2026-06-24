'use strict';
const { EventEmitter } = require('events');

/**
 * Wraps a single RTSP camera + optional per-frame detection via the C++ addon.
 * Emits: 'frame' (Buffer), 'error' (Error), 'connected', 'disconnected'
 */
class RtspStream extends EventEmitter {
  constructor({ id, url, reconnectDelay = 3000 }) {
    super();
    this.id = id;
    this.url = url;
    this.reconnectDelay = reconnectDelay;
    this._running = false;
    this._proc = null;
  }

  /**
   * Start pulling JPEG frames via FFmpeg subprocess.
   * Each frame is emitted as a raw JPEG Buffer.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._spawn();
  }

  stop() {
    this._running = false;
    if (this._proc) {
      this._proc.kill('SIGTERM');
      this._proc = null;
    }
  }

  _spawn() {
    const { spawn } = require('child_process');
    // Output MJPEG frames to stdout; each frame is a complete JPEG
    this._proc = spawn('ffmpeg', [
      '-rtsp_transport', 'tcp',
      '-i', this.url,
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      '-q:v', '5',
      '-vf', 'fps=10',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    let buf = Buffer.alloc(0);
    const SOI = Buffer.from([0xff, 0xd8]);
    const EOI = Buffer.from([0xff, 0xd9]);

    this._proc.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // Extract complete JPEG frames
      let start = 0;
      while (true) {
        const s = buf.indexOf(SOI, start);
        if (s === -1) break;
        const e = buf.indexOf(EOI, s + 2);
        if (e === -1) break;
        this.emit('frame', buf.slice(s, e + 2));
        start = e + 2;
      }
      if (start > 0) buf = buf.slice(start);
      // Cap buffer to avoid memory growth if no valid frames
      if (buf.length > 2 * 1024 * 1024) buf = Buffer.alloc(0);
    });

    this._proc.on('exit', () => {
      this._proc = null;
      this.emit('disconnected', this.id);
      if (this._running) {
        setTimeout(() => this._spawn(), this.reconnectDelay);
      }
    });

    this._proc.on('error', (err) => this.emit('error', err));
    this.emit('connected', this.id);
  }
}

module.exports = RtspStream;
