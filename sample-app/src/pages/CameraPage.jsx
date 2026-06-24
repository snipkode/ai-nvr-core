import { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Copy } from 'lucide-react';

const CHANNEL = `browser-${Math.random().toString(36).slice(2, 8)}`;
const FPS = 15;

export default function CameraPage() {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?role=sender&channel=${CHANNEL}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStreaming(true);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        timerRef.current = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const v = videoRef.current;
          canvas.width = v.videoWidth || 640;
          canvas.height = v.videoHeight || 480;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(blob => blob && ws.send(blob), 'image/jpeg', 0.75);
        }, 1000 / FPS);
      };
      ws.onclose = () => stop(false);
      ws.onerror = () => setError('WebSocket error');
    } catch (err) {
      setError(err.message);
    }
  };

  const stop = (closeWs = true) => {
    clearInterval(timerRef.current);
    if (closeWs) wsRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
  };

  useEffect(() => () => stop(), []);

  const copy = () => {
    navigator.clipboard.writeText(CHANNEL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header"><h1>Browser Camera Sender</h1></div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 540 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="card-label">Channel ID</div>
            <code style={{ color: 'var(--accent)', fontSize: 13 }}>{CHANNEL}</code>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={copy}>
            <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <p className="tip">Add this channel ID in <a href="/cameras" style={{ color: 'var(--accent)' }}>Cameras</a> to view the stream.</p>

        {error && <div className="alert-error">{error}</div>}

        <div className="stream-wrap">
          <video ref={videoRef} muted playsInline
            style={{ width: '100%', minHeight: 200, background: '#000', display: 'block' }} />
          {!streaming && (
            <div className="stream-empty">
              <VideoOff size={28} />
              <span>Camera preview will appear here</span>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!streaming ? (
            <button className="btn btn-primary" onClick={start}>
              <Video size={15} />Start Streaming
            </button>
          ) : (
            <button className="btn btn-danger" onClick={() => stop()}>
              <VideoOff size={15} />Stop Streaming
            </button>
          )}
          {streaming && (
            <span className="badge streaming"><span className="dot" />Streaming</span>
          )}
        </div>
      </div>
    </div>
  );
}
