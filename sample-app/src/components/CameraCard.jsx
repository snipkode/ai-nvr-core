import { useState, useRef } from 'react';
import { Icon } from './Icons';
import DetectionOverlay from './DetectionOverlay';

export default function CameraCard({ channel, name, hideFs }) {
  const [live, setLive]   = useState(true);
  const [fs, setFs]       = useState(false);
  const wrapRef = useRef(null);

  const toggleFs = () => {
    const el = wrapRef.current;
    if (!document.fullscreenElement) {
      el?.requestFullscreen?.().then(() => setFs(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setFs(false)).catch(() => {});
    }
  };

  // Update fs state when user presses Escape
  if (typeof document !== 'undefined') {
    document.onfullscreenchange = () => setFs(!!document.fullscreenElement);
  }

  return (
    <div ref={wrapRef} style={{ height: '100%', position: 'relative', background: '#000', borderRadius: 'inherit', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Stream */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {live && (
          <img
            src={`/stream/${channel}`}
            alt={name}
            onLoad={() => setLive(true)}
            onError={() => setLive(false)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {!live && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--txt3)' }}>
            <Icon name="videoOff" size={32} color="var(--txt3)" />
            <span style={{ fontSize: 12 }}>Offline</span>
          </div>
        )}
        <DetectionOverlay channel={channel} />
      </div>

      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 10px 6px', background: 'linear-gradient(transparent,rgba(0,0,0,.75))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || channel}</span>
          <span className={`badge ${live ? 'live' : 'offline'}`} style={{ fontSize: 10, padding: '1px 6px' }}>
            <span className="dot" />{live ? 'Live' : 'Offline'}
          </span>
        </div>
        {!hideFs && (
          <button
            onClick={toggleFs}
            title="Fullscreen"
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', backdropFilter: 'blur(4px)', minWidth: 32, minHeight: 32, justifyContent: 'center' }}
          >
            <Icon name={fs ? 'exitFs' : 'fullscreen'} size={18} color="#fff" />
          </button>
        )}
      </div>
    </div>
  );
}
