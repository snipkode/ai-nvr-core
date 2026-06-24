'use strict';
const ort  = require('onnxruntime-node');
const fs   = require('fs');
const path = require('path');

const INPUT_SIZE = 640;

// Load COCO class names
function loadNames(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').map(l => l.trim());
}

class YoloDetector {
  constructor(modelPath, namesPath, confThresh = 0.45, nmsThresh = 0.5) {
    this.modelPath  = modelPath;
    this.names      = loadNames(namesPath);
    this.confThresh = confThresh;
    this.nmsThresh  = nmsThresh;
    this.session    = null;
  }

  async load() {
    this.session = await ort.InferenceSession.create(this.modelPath);
  }

  // jpegBuf: Buffer of JPEG image
  async detect(jpegBuf, cameraId = 'cam') {
    if (!this.session) return null;

    // Decode JPEG → raw pixels using canvas-less approach via sharp or jimp
    // We use the built-in approach: write temp file + use Jimp
    const { Jimp } = require('jimp');
    const img = await Jimp.fromBuffer(jpegBuf);
    const origW = img.bitmap.width;
    const origH = img.bitmap.height;

    // Resize to 640x640
    img.resize({ w: INPUT_SIZE, h: INPUT_SIZE });

    // Build float32 tensor [1, 3, 640, 640] in RGB
    const tensor = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);
    const pixels = img.bitmap.data; // RGBA
    for (let i = 0; i < INPUT_SIZE * INPUT_SIZE; i++) {
      tensor[i]                          = pixels[i * 4]     / 255; // R
      tensor[INPUT_SIZE * INPUT_SIZE + i]     = pixels[i * 4 + 1] / 255; // G
      tensor[INPUT_SIZE * INPUT_SIZE * 2 + i] = pixels[i * 4 + 2] / 255; // B
    }

    const inputTensor = new ort.Tensor('float32', tensor, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const feeds = { [this.session.inputNames[0]]: inputTensor };
    const results = await this.session.run(feeds);

    const output = results[this.session.outputNames[0]]; // [1, 84, 8400]
    return this._parse(output, origW, origH, cameraId);
  }

  _parse(output, origW, origH, cameraId) {
    const data = output.data;   // Float32Array
    const rows = 8400;
    const nc   = this.names.length;  // 80
    const xScale = origW / INPUT_SIZE;
    const yScale = origH / INPUT_SIZE;

    const boxes = [], scores = [], classIds = [];

    for (let i = 0; i < rows; i++) {
      // output is [1, 84, 8400] → data layout: col-major
      const cx = data[0 * rows + i];
      const cy = data[1 * rows + i];
      const w  = data[2 * rows + i];
      const h  = data[3 * rows + i];

      let maxConf = 0, maxClass = 0;
      for (let c = 0; c < nc; c++) {
        const conf = data[(4 + c) * rows + i];
        if (conf > maxConf) { maxConf = conf; maxClass = c; }
      }

      if (maxConf < this.confThresh) continue;

      boxes.push([
        (cx - w / 2) * xScale,
        (cy - h / 2) * yScale,
        w * xScale,
        h * yScale,
      ]);
      scores.push(maxConf);
      classIds.push(maxClass);
    }

    // Simple NMS
    const keep = nms(boxes, scores, this.nmsThresh);
    const objects = keep.map(i => ({
      class:      this.names[classIds[i]],
      confidence: Math.round(scores[i] * 100) / 100,
      bbox:       boxes[i].map(Math.round),
    }));

    return { camera_id: cameraId, timestamp: Date.now(), objects };
  }
}

function nms(boxes, scores, thresh) {
  const idxs = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep = [];
  const suppressed = new Uint8Array(boxes.length);
  for (const i of idxs) {
    if (suppressed[i]) continue;
    keep.push(i);
    for (const j of idxs) {
      if (suppressed[j] || i === j) continue;
      if (iou(boxes[i], boxes[j]) > thresh) suppressed[j] = 1;
    }
  }
  return keep;
}

function iou([ax, ay, aw, ah], [bx, by, bw, bh]) {
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const inter = ix * iy;
  return inter / (aw * ah + bw * bh - inter);
}

module.exports = YoloDetector;
