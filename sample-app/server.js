'use strict';
const express  = require('express');
const https    = require('https');
const http     = require('http');
const { WebSocketServer } = require('ws');
const { readFileSync } = require('fs');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// HTTPS server (required for getUserMedia in browser)
let server;
try {
  server = https.createServer({
    key:  readFileSync(path.join(__dirname, 'key.pem')),
    cert: readFileSync(path.join(__dirname, 'cert.pem')),
  }, app);
  console.log('HTTPS mode');
} catch {
  server = http.createServer(app);
  console.log('HTTP mode (getUserMedia may not work outside localhost)');
}

const wss = new WebSocketServer({ server });

// MJPEG HTTP clients
const mjpegClients = new Set();

function broadcastMjpeg(jpegBuf) {
  const header = `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpegBuf.length}\r\n\r\n`;
  for (const res of mjpegClients) {
    try {
      res.write(Buffer.from(header));
      res.write(jpegBuf);
      res.write('\r\n');
    } catch { mjpegClients.delete(res); }
  }
}

function broadcastAlert(data) {
  const msg = JSON.stringify(data);
  for (const ws of wss.clients) {
    if (ws.role === 'viewer' && ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'https://localhost').searchParams.get('role') || 'viewer';
  ws.role = role;

  if (role === 'sender') {
    ws.on('message', (data, isBinary) => { if (isBinary) broadcastMjpeg(data); });
    console.log('Camera sender connected');
    ws.on('close', () => console.log('Camera sender disconnected'));
  }
});

app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection':   'keep-alive',
  });
  mjpegClients.add(res);
  req.on('close', () => mjpegClients.delete(res));
});

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server: https://0.0.0.0:${PORT}`);
  console.log(`Camera: https://0.0.0.0:${PORT}/camera.html`);
  console.log(`Viewer: https://0.0.0.0:${PORT}/`);
});

process.on('SIGINT', () => process.exit(0));
