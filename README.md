# ai-nvr-core

Lightweight AI NVR/CCTV engine — RTSP cameras → OpenCV → YOLO → event alerts.

## Requirements

- Ubuntu 20.04+ / Debian
- Node.js ≥ 18
- `libopencv-dev` (≥ 4.x, includes DNN module)
- `ffmpeg`
- YOLO model: `.onnx` (YOLOv8/YOLO11) or Darknet `.weights`+`.cfg`

```sh
# Ubuntu / Debian
sudo apt-get install -y libopencv-dev ffmpeg
npm install ai-nvr-core
```

## Quick Start

```js
const NVR = require('ai-nvr-core');

const nvr = new NVR({
  model:   '/models/yolov8n.onnx',
  names:   '/models/coco.names',
  cameras: [
    { id: 'cam1', url: 'rtsp://admin:pass@192.168.1.100/stream1' },
    { id: 'cam2', url: 'rtsp://admin:pass@192.168.1.101/stream1' },
  ],
  rules: [
    {
      id:       'intruder',
      type:     'object_presence',
      classes:  ['person'],
      severity: 'high',
    },
    {
      id:        'zone_alert',
      type:      'zone_intrusion',
      classes:   ['person', 'car'],
      zone:      [[0,0],[640,0],[640,360],[0,360]],  // pixel polygon
      severity:  'critical',
    },
  ],
  webhooks: [{ url: 'http://localhost:4000/alert' }],
});

nvr.on('event',     (alert) => console.log('ALERT:', JSON.stringify(alert)));
nvr.on('detection', (det)   => console.log('RAW:',   det.objects.length, 'objects'));
nvr.on('error',     (err)   => console.error('ERR:', err.message));

nvr.enableWebSocket(9000);  // optional: push alerts to ws://localhost:9000
nvr.start();

// Graceful shutdown
process.on('SIGINT', () => { nvr.stop(); process.exit(0); });
```

## API

### `new NVR(opts)`

| Option         | Type     | Default     | Description                                      |
|----------------|----------|-------------|--------------------------------------------------|
| `model`        | string   | —           | Path to `.onnx` or `.weights` file               |
| `config`       | string   | `''`        | Path to darknet `.cfg` (omit for ONNX)           |
| `names`        | string   | —           | Path to class names (one per line)               |
| `cameras`      | array    | `[]`        | `[{ id, url, reconnectDelay? }]`                 |
| `rules`        | array    | `[]`        | EventEngine rules (see below)                    |
| `cuda`         | boolean  | `false`     | Enable CUDA acceleration                         |
| `frameMode`    | string   | `'native'`  | `'native'` (C++ queue) or `'js'` (FFmpeg sub)    |
| `queueSize`    | number   | `30`        | Native frame queue depth                         |
| `webhooks`     | array    | `[]`        | `[{ url, events? }]`                             |
| `outputFile`   | string   | `null`      | Append detection NDJSON to file                  |

### Methods

```js
nvr.start()                    // start all cameras + detection
nvr.stop()                     // graceful shutdown
nvr.addRule(rule)              // add rule at runtime
nvr.removeRule(id)             // remove rule by id
nvr.enableWebSocket(port)      // start WS server, returns nvr (chainable)
```

### Events emitted

```js
nvr.on('event',              (alert)  => {})  // rule matched
nvr.on('detection',          (det)    => {})  // raw detection (all frames with objects)
nvr.on('error',              (err)    => {})  // error
nvr.on('camera:connected',   (camId)  => {})  // camera came online
nvr.on('camera:disconnected',(camId)  => {})  // camera disconnected
```

### Detection event shape

```json
{
  "camera_id": "cam1",
  "timestamp": 1710000000000,
  "objects": [
    { "class": "person", "confidence": 0.97, "bbox": [120, 80, 60, 180] }
  ]
}
```

### Alert event shape

```json
{
  "rule_id":   "intruder",
  "rule_type": "object_presence",
  "camera_id": "cam1",
  "timestamp": 1710000000000,
  "severity":  "high",
  "objects":   [...]
}
```

## Rules Reference

```js
// Detect any person
{ id: 'r1', type: 'object_presence', classes: ['person'] }

// Person enters polygon zone
{ id: 'r2', type: 'zone_intrusion', classes: ['person'], zone: [[x,y],...] }

// More than 3 vehicles
{ id: 'r3', type: 'object_count', classes: ['car','truck'], threshold: 3 }

// Person lingering > 30s
{ id: 'r4', type: 'loitering', classes: ['person'], duration: 30000 }

// Any detection outside 08:00–18:00
{ id: 'r5', type: 'after_hours', classes: ['person'], hours: '08:00-18:00' }
```

## Docker

```sh
# Build
docker compose build

# Run (mount your models and config)
docker compose up -d

# Logs
docker compose logs -f
```

Example `config/config.json` (loaded by your app, not auto-loaded by the library):

```json
{
  "model": "/app/models/yolov8n.onnx",
  "names": "/app/models/coco.names",
  "cameras": [
    { "id": "cam1", "url": "rtsp://admin:pass@192.168.1.100/stream" }
  ]
}
```

## Building the native addon manually

```sh
npm run build          # release
npm run build:debug    # debug symbols
```

The addon is built automatically on `npm install` inside the Docker image.

## YOLO models

Download pre-trained ONNX weights:

```sh
# YOLOv8n (nano, ~6 MB, fast CPU)
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt
pip install ultralytics
yolo export model=yolov8n.pt format=onnx imgsz=640

# COCO class names
wget https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/cfg/datasets/coco.yaml
```

## Architecture

```
RTSP Camera
    ↓
[native mode]  C++ CameraCapture (OpenCV VideoCapture + FFmpeg RTSP/TCP)
[js mode]      FFmpeg subprocess → JPEG frames
    ↓
FrameQueue (bounded, thread-safe, drops oldest on overflow)
    ↓
Worker thread → YoloDetector (cv::dnn, YOLOv8 ONNX or Darknet)
    ↓
ThreadSafeFunction → Node.js EventEngine (rule evaluation)
    ↓
Webhook / WebSocket / NDJSON file
```

## License

MIT
