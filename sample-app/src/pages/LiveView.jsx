import { useState } from 'react';
import { Video, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import DetectionOverlay from '../components/DetectionOverlay';

export default function LiveView() {
  const [live, setLive] = useState(false);
  const [key, setKey]   = useState(0);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Live View</h1>
        <span className={`badge ${live ? 'live' : 'offline'}`}>
          {live ? <><span className="dot" />LIVE</> : 'Offline'}
        </span>
      </div>

      <div className="stream-wrap" style={{ maxWidth: 960 }}>
        <img
          key={key}
          src="/stream"
          alt="MJPEG stream"
          onLoad={() => setLive(true)}
          onError={() => { setLive(false); setTimeout(() => setKey(k => k + 1), 3000); }}
        />
        <DetectionOverlay />
        {!live && (
          <div className="stream-empty">
            <WifiOff size={38} color="var(--txt3)" />
            <span style={{ color: 'var(--txt3)', fontSize: 14 }}>No stream</span>
            <Link to="/camera" className="btn btn-primary btn-sm" style={{ marginTop: 4 }}>Open Camera</Link>
          </div>
        )}
      </div>

      <p className="tip" style={{ marginTop: 10 }}>
        YOLO detection results appear as overlay. Open <Link to="/camera">Camera Sender</Link> first.
      </p>
    </div>
  );
}
