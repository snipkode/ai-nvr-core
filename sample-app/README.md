# sample-app

Live view kamera dari Termux ke browser via MJPEG stream + Express.

## Setup di Termux

```sh
# Install dependensi
pkg install ffmpeg nodejs

# Clone repo
git clone https://github.com/snipkode/ai-nvr-core
cd ai-nvr-core/sample-app
npm install

# Jalankan (kamera /dev/video0)
npm start

# Atau pakai IP Webcam app (Android)
CAM=rtsp://192.168.x.x:8080/h264_ulaw.sdp node server.js
```

## Akses dari browser

Buka `http://<IP-Termux>:3000` di browser HP/PC yang sama jaringan.

## Environment Variables

| Var   | Default         | Keterangan                              |
|-------|-----------------|-----------------------------------------|
| `CAM` | `/dev/video0`   | Source kamera: path v4l2 atau RTSP URL  |
| `PORT` | `3000`         | Port HTTP server                        |

## Cara dapat IP Termux

```sh
ip addr show | grep 'inet ' | grep -v 127
```
