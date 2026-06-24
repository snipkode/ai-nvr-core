FROM ubuntu:22.04

ARG NODE_VERSION=20
ENV DEBIAN_FRONTEND=noninteractive

# ── System deps ────────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates gnupg \
      build-essential python3 \
      ffmpeg \
      libopencv-dev \
      libopencv-dnn-dev \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js ────────────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Install deps + build native addon ─────────────────────────────────────────
COPY package.json binding.gyp ./
RUN npm install

# ── Copy source ────────────────────────────────────────────────────────────────
COPY src ./src

# Models volume: mount your YOLO .onnx/.weights + .names files here
VOLUME ["/app/models"]

# Config volume: mount config.json here
VOLUME ["/app/config"]

CMD ["node", "-e", "require('./src/index.js'); console.log('ai-nvr-core ready')"]
