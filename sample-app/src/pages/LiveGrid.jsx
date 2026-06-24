import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icons';
import CameraCard from '../components/CameraCard';

const LAYOUTS = [
  { key: 1, label: '1×1', cols: 1 },
  { key: 2, label: '1×2', cols: 2 },
  { key: 4, label: '2×2', cols: 2 },
];

export default function LiveGrid() {
  const [channels, setChannels] = useState([]);
  const [layout, setLayout]     = useState(4);
  const [filter, setFilter]     = useState('all');
  const [zoomed, setZoomed]     = useState(null); // channel obj

  const load = () =>
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') setZoomed(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visible = filter === 'all' ? channels : channels.filter(c => c.id === filter);
  const slots   = visible.slice(0, layout);
  const cols    = LAYOUTS.find(l => l.key === layout)?.cols ?? 2;
  const isGrid  = layout === 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <div className="page-header" style={{ marginBottom: 12 }}>
          <Icon name="grid" size={20} color="var(--accent)" />
          <h1 style={{ marginLeft: 6 }}>Live Grid</h1>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {LAYOUTS.map(({ key, label }) => (
              <button key={key} onClick={() => setLayout(key)} className={`btn btn-sm ${layout === key ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 12 }}>
                {label}
              </button>
            ))}
            <button onClick={load} className="icon-btn" title="Refresh" style={{ marginLeft: 2 }}>
              <Icon name="activity" size={16} />
            </button>
          </div>
        </div>

        {/* ── Camera filter chips ── */}
        {channels.length > 1 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
              Semua ({channels.length})
            </Chip>
            {channels.map(c => (
              <Chip key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}
                dot={c.active ? 'var(--success)' : 'var(--txt3)'}>
                {c.name || c.id}
              </Chip>
            ))}
          </div>
        )}

        <div style={{ borderBottom: '1px solid var(--border)' }} />
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, padding: 14, minHeight: 0, overflowY: 'auto' }}>
        {channels.length === 0 ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <Icon name="camera" size={40} color="var(--txt3)" />
            <div style={{ fontWeight: 600 }}>Tidak ada kamera</div>
            <Link to="/cameras" className="btn btn-primary btn-sm">
              <Icon name="plus" size={13} />Tambah Kamera
            </Link>
          </div>
        ) : slots.length === 0 ? (
          <div className="empty-state">
            <Icon name="videoOff" size={32} color="var(--txt3)" />
            <div>Kamera tidak ditemukan</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 10,
            height: layout === 1 ? 'calc(100% - 4px)' : undefined,
          }}>
            {slots.map(ch => (
              <div key={ch.id}
                onClick={() => isGrid && setZoomed(ch)}
                style={{
                  aspectRatio: layout === 1 ? undefined : '16/9',
                  height: layout === 1 ? '100%' : undefined,
                  borderRadius: 'var(--r2)', overflow: 'hidden',
                  cursor: isGrid ? 'zoom-in' : 'default',
                }}>
                <CameraCard channel={ch.id} name={ch.name || ch.id} hideFs={isGrid} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Zoom modal ── */}
      {zoomed && (
        <div
          onClick={() => setZoomed(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)',
            zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, animation: 'fadeIn .15s',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 900, aspectRatio: '16/9', borderRadius: 'var(--r2)', overflow: 'hidden', position: 'relative' }}>
            <CameraCard channel={zoomed.id} name={zoomed.name || zoomed.id} />
            <button
              onClick={() => setZoomed(null)}
              style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex', backdropFilter: 'blur(4px)' }}>
              <Icon name="close" size={18} color="#fff" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, dot, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
      fontSize: 12, fontWeight: 500,
      background: active ? 'var(--accent)' : 'var(--bg2)',
      color: active ? '#fff' : 'var(--txt2)',
      border: active ? 'none' : '1px solid var(--border)',
      transition: 'background .12s, color .12s',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
      {children}
    </button>
  );
}
