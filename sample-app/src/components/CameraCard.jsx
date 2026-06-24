import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icons';
import DetectionOverlay from './DetectionOverlay';

export default function CameraCard({ channel, name, hideFs, rotate = 0 }) {
  const [src, setSrc]         = useState(`/stream/${channel}`);
  const [live, setLive]       = useState(true);
  const [connecting, setConn] = useState(true); // true until first frame
  const [fs, setFs]           = useState(false);
  const wrapRef  = useRef(null);
  const retryRef = useRef(null);

  const retry = () => {
    retryRef.current = setTimeout(() => {
      setSrc(`/stream/${channel}?t=${Date.now()}`);
      setLive(true);
      setConn(true);
    }, 3000);
  };

  useEffect(() => () => clearTimeout(retryRef.current), []);

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
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#000', borderRadius: fs ? 0 : 'inherit', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Stream */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {live && (
          <img
            src={src}
            alt={name}
            onLoad={() => { setLive(true); setConn(false); }}
            onError={() => { setLive(false); setConn(false); retry(); }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              transform: rotate ? `rotate(${rotate}deg)` : undefined,
              ...(rotate === 90 || rotate === 270 ? { width: '100%', height: '100%', objectFit: 'contain' } : {})
            }}
          />
        )}
        {/* Connecting overlay */}
        {live && connecting && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(0,0,0,.6)' }}>
            <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>Menghubungkan…</span>
          </div>
        )}
        {/* Progress bar at top */}
        {live && connecting && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,.1)' }}>
            <div style={{ height: '100%', background: 'var(--accent)', animation: 'streamProgress 2s ease-in-out infinite', transformOrigin: 'left' }} />
          </div>
        )}
        {!live && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--txt3)' }}>
            <Icon name="videoOff" size={32} color="var(--txt3)" />
            <span style={{ fontSize: 12 }}>Offline — retry 3s…</span>
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
