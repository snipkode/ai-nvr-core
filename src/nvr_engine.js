'use strict';
const { EventEmitter } = require('events');
const path = require('path');
const EventEngine = require('./event_engine');
const RtspStream  = require('./stream');

let addon;
try {
  addon = require(path.join(__dirname, '..', 'build', 'Release', 'ai_nvr_core'));
} catch {
  addon = null; // graceful: JS-only mode (no inference)
}

/**
 * NvrEngine — main orchestrator.
 *
 * Usage:
 *   const engine = new NvrEngine({ model, config, names, cameras, rules });
 *   engine.on('event', handler);
 *   engine.start();
 *
 * Emits:
 *   'event'       — detection alert  { rule_id, camera_id, timestamp, objects, severity }
 *   'detection'   — raw detection    { camera_id, timestamp, objects[] }
 *   'error'       — Error object
 *   'camera:connected'    — cameraId
 *   'camera:disconnected' — cameraId
 */
class NvrEngine extends EventEmitter {
  constructor(opts = {}) {
    super();
    const {
      model,                     // path to .onnx or .weights
      config   = '',             // path to .cfg (darknet) or same as model for ONNX
      names    = '',             // path to class names file
      cameras  = [],             // [{ id, url, reconnectDelay? }]
      rules    = [],             // EventEngine rules
      cuda     = false,          // CUDA acceleration
      frameMode = 'native',      // 'native' (C++ queue) | 'js' (per-frame JS decode)
      confThreshold = 0.5,       // unused here, passed to addon via startCapture
      queueSize = 30,            // native frame queue depth
      webhooks  = [],            // [{ url, events? }]
      outputFile = null,         // path to append detection NDJSON (optional)
    } = opts;

    this._opts = { model, config, names, cameras, cuda, frameMode, queueSize, webhooks, outputFile };
    this._eventEngine = new EventEngine();
    this._streams = [];
    this._running = false;
    this._wss = null;            // WebSocket server (set via enableWebSocket)

    for (const rule of rules) this._eventEngine.addRule(rule);

    this._eventEngine.on('alert', (alert) => {
      this.emit('event', alert);
      this._dispatchOutput(alert);
    });
  }

  /** Add / remove rules at runtime */
  addRule(rule)       { this._eventEngine.addRule(rule); }
  removeRule(id)      { this._eventEngine.removeRule(id); }

  /** Start a WebSocket server on given port for real-time event push */
  enableWebSocket(port = 9000) {
    const { WebSocketServer } = require('ws');
    this._wss = new WebSocketServer({ port });
    this._wss.on('error', err => this.emit('error', err));
    return this;
  }

  async start() {
    if (this._running) return;
    const { model, config, names, cameras, cuda, frameMode, queueSize } = this._opts;

    // Load model if addon available
    if (addon && model) {
      const ok = addon.loadModel(model, config || model, names, cuda);
      if (!ok) this.emit('error', new Error('Failed to load YOLO model'));
    }

    if (frameMode === 'native' && addon && model) {
      // C++ captures + detects, fires callback per-detection-event
      addon.startCapture(
        cameras.map(c => ({ id: c.id, url: c.url, reconnectDelay: c.reconnectDelay || 3 })),
        (jsonStr) => {
          try {
            const det = JSON.parse(jsonStr);
            this.emit('detection', det);
            this._eventEngine.process(det);
          } catch { /* malformed json */ }
        },
        queueSize
      );
    } else {
      // JS mode: FFmpeg subprocess per camera, optional addon per-frame inference
      for (const cam of cameras) {
        const stream = new RtspStream(cam);
        stream.on('frame', (jpegBuf) => this._onFrame(cam.id, jpegBuf));
        stream.on('connected',    id => this.emit('camera:connected', id));
        stream.on('disconnected', id => this.emit('camera:disconnected', id));
        stream.on('error',       err => this.emit('error', err));
        stream.start();
        this._streams.push(stream);
      }
    }

    this._running = true;
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    if (addon) addon.stopCapture();
    for (const s of this._streams) s.stop();
    this._streams = [];
    if (this._wss) this._wss.close();
  }

  // ─── private ───────────────────────────────────────────────────────────────

  _onFrame(cameraId, jpegBuf) {
    if (!addon || !addon.isModelLoaded()) return;
    const jsonStr = addon.detectFrame(jpegBuf, cameraId);
    if (!jsonStr) return;
    try {
      const det = JSON.parse(jsonStr);
      if (!det.objects || det.objects.length === 0) return;
      this.emit('detection', det);
      this._eventEngine.process(det);
    } catch { /* ignore */ }
  }

  _dispatchOutput(data) {
    const payload = JSON.stringify(data);

    // WebSocket broadcast
    if (this._wss) {
      for (const client of this._wss.clients) {
        if (client.readyState === 1 /* OPEN */) client.send(payload);
      }
    }

    // Webhook HTTP POST
    for (const wh of this._opts.webhooks) {
      if (wh.events && !wh.events.includes(data.rule_type)) continue;
      this._postWebhook(wh.url, data).catch(err => this.emit('error', err));
    }

    // Append to NDJSON file
    if (this._opts.outputFile) {
      require('fs').appendFile(this._opts.outputFile, payload + '\n', () => {});
    }
  }

  async _postWebhook(url, data) {
    const http  = url.startsWith('https') ? require('https') : require('http');
    const body  = JSON.stringify(data);
    const u     = new URL(url);
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: u.hostname, port: u.port || (url.startsWith('https') ? 443 : 80),
        path: u.pathname + u.search, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => { res.resume(); res.on('end', resolve); });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }
}

module.exports = NvrEngine;
