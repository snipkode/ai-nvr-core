'use strict';
const express = require('express');
const http    = require('http');
const { WebSocketServer } = require('ws');
const { spawn } = require('child_process');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });
const PORT   = process.env.PORT || 3000;

// SSE clients untuk MJPEG
const clients = new Set();

// Spawn ffmpeg → baca frame JPEG dari kamera Android (Termux)
// Di Termux: kamera tersedia via /dev/video0 atau pakai URL RTSP dari IP Webcam app
const CAM_SOURCE = process.env.CAM || '/dev/video0';

let ffmpegProc = null;
let frameBuf   = Buffer.alloc(0);
const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

function buildFfmpegArgs() {
  const fs = require('fs');
  if (CAM_SOURCE.startsWith('rtsp://') || CAM_SOURCE.startsWith('http')) {
    return ['-i', CAM_SOURCE];
  }
  if (fs.existsSync(CAM_SOURCE)) {
    return ['-f', 'v4l2', '-i', CAM_SOURCE];
  }
  // VPS fallback: synthetic test source
  console.log('No camera device found — using ffmpeg testsrc');
  return ['-f', 'lavfi', '-i', 'testsrc=size=640x480:rate=15'];
}

function startCapture() {
  const inputArgs = buildFfmpegArgs();
  ffmpegProc = spawn('ffmpeg', [
    ...inputArgs,
    '-f', 'image2pipe', '-vcodec', 'mjpeg',
    '-q:v', '5', '-vf', 'fps=15',
    'pipe:1'
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  ffmpegProc.stdout.on('data', (chunk) => {
    frameBuf = Buffer.concat([frameBuf, chunk]);
    let start = 0;
    while (true) {
      const s = frameBuf.indexOf(SOI, start);
      if (s === -1) break;
      const e = frameBuf.indexOf(EOI, s + 2);
      if (e === -1) break;
      const frame = frameBuf.slice(s, e + 2);
      broadcast(frame);
      start = e + 2;
    }
    if (start > 0) frameBuf = frameBuf.slice(start);
    if (frameBuf.length > 1024 * 1024) frameBuf = Buffer.alloc(0);
  });

  ffmpegProc.on('exit', () => {
    ffmpegProc = null;
    console.log('ffmpeg exited, retrying in 3s...');
    setTimeout(startCapture, 3000);
  });

  console.log(`Capturing from ${CAM_SOURCE}`);
}

function broadcast(jpegBuf) {
  const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBuf.length}\r\n\r\n`;
  for (const res of clients) {
    try {
      res.write(Buffer.from(header));
      res.write(jpegBuf);
      res.write('\r\n');
    } catch {
      clients.delete(res);
    }
  }
}

// MJPEG stream endpoint
app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// Serve HTML
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast alert to all WS clients
function broadcastAlert(alert) {
  const msg = JSON.stringify(alert);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// Demo: send a fake alert every 5s so you can see it working
setInterval(() => {
  broadcastAlert({
    rule_id: 'demo',
    rule_type: 'object_presence',
    camera_id: 'cam1',
    timestamp: Date.now(),
    severity: 'medium',
    objects: [{ class: 'person', confidence: 0.92 }]
  });
}, 5000);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Stream: http://0.0.0.0:${PORT}/stream`);
  startCapture();
});

process.on('SIGINT', () => {
  if (ffmpegProc) ffmpegProc.kill();
  process.exit(0);
});
