import { useState } from 'react';
import { VideoOff } from 'lucide-react';
import DetectionOverlay from './DetectionOverlay';

export default function CameraCard({ channel, name }) {
  const [live, setLive] = useState(true);

  return (
    <div className="cam-card" style={{ height: '100%' }}>
      <div className="stream-wrap" style={{ height: 'calc(100% - 36px)' }}>
        {live ? (
          <img
            src={`/stream/${channel}`}
            alt={name || channel}
            onLoad={() => setLive(true)}
            onError={() => setLive(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        {!live && (
          <div className="stream-empty">
            <VideoOff size={28} />
            <span>{channel}</span>
          </div>
        )}
        <DetectionOverlay channel={channel} />
      </div>
      <div className="cam-card-bar">
        <span>{name || channel}</span>
        <span className={`badge ${live ? 'live' : 'offline'}`}>
          <span className="dot" />
          {live ? 'Live' : 'Offline'}
        </span>
      </div>
    </div>
  );
}
