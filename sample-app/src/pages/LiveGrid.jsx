import { useState, useEffect } from 'react';
import { Icon } from '../components/Icons';
import CameraCard from '../components/CameraCard';

const LAYOUTS = [
  { key: 1, label: '1×1' },
  { key: 2, label: '1×2' },
  { key: 4, label: '2×2' },
];

export default function LiveGrid() {
  const [channels, setChannels] = useState([]);
  const [layout, setLayout]     = useState(4);

  useEffect(() => {
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
    const t = setInterval(() => fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, []);

  const slots = channels.slice(0, layout);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Compact header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
        <Icon name="grid" size={16} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Live Grid</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {LAYOUTS.map(({ key, label }) => (
            <button key={key} onClick={() => setLayout(key)} style={{
              padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: layout === key ? 'var(--accent)' : 'var(--bg3)',
              color: layout === key ? '#fff' : 'var(--txt2)',
            }}>{label}</button>
          ))}
        </div>
        <button onClick={() => fetch('/api/channels').then(r => r.json()).then(setChannels)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, color: 'var(--txt3)' }} title="Refresh">
          <Icon name="activity" size={16} />
        </button>
      </div>

      {/* Grid — fills remaining height */}
      <div style={{ flex: 1, padding: 10, minHeight: 0, overflow: 'auto' }}>
        {channels.length === 0 ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <div style={{ fontWeight: 600 }}>Tidak ada kamera</div>
            <a href="/cameras" className="btn btn-primary btn-sm">+ Tambah Kamera</a>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: layout === 1 ? '1fr' : 'repeat(2, 1fr)',
            gap: 8,
            height: layout === 1 ? '100%' : undefined,
          }}>
            {slots.map(ch => (
              <div key={ch.id} style={{ aspectRatio: layout === 1 ? undefined : '16/9', height: layout === 1 ? '100%' : undefined, borderRadius: 'var(--r2)', overflow: 'hidden' }}>
                <CameraCard channel={ch.id} name={ch.name || ch.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
