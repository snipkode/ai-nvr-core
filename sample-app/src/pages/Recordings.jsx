import { useState, useEffect } from 'react';
import { Icon } from '../components/Icons';

function fmt(ms) {
  return new Date(ms).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const YEARS  = () => { const y = new Date().getFullYear(); return Array.from({ length: 5 }, (_, i) => y - i); };
const MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

export default function Recordings() {
  const [camIds, setCamIds]       = useState([]);   // from recording folders
  const [camFilter, setCamFilter] = useState('all');
  const [year, setYear]           = useState(new Date().getFullYear());
  const [month, setMonth]         = useState(null);
  const [day, setDay]             = useState(null);
  const [files, setFiles]         = useState([]);
  const [loading, setLoading]     = useState(false);

  // Load camera IDs from recording folders
  useEffect(() => {
    fetch('/api/recordings').then(r => r.json()).then(setCamIds).catch(() => {});
  }, []);

  // Load all recordings for selected camera(s)
  useEffect(() => {
    const targets = camFilter === 'all' ? camIds : [camFilter];
    if (!targets.length) { setFiles([]); return; }
    setLoading(true);
    Promise.all(targets.map(id =>
      fetch(`/api/recordings/${id}`).then(r => r.json()).then(fs => fs.map(f => ({ ...f, camId: id }))).catch(() => [])
    )).then(all => { setFiles(all.flat()); setLoading(false); });
  }, [camFilter, camIds]);

  // Filter by year / month / day
  const filtered = files.filter(f => {
    const d = new Date(f.mtime);
    if (d.getFullYear() !== year) return false;
    if (month !== null && d.getMonth() !== month) return false;
    if (day   !== null && d.getDate()  !== day)   return false;
    return true;
  });

  // Available days in the current month/year for the day picker
  const activeDays = [...new Set(
    files
      .filter(f => {
        const d = new Date(f.mtime);
        return d.getFullYear() === year && (month === null || d.getMonth() === month);
      })
      .map(f => new Date(f.mtime).getDate())
  )].sort((a, b) => a - b);

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>

      {/* ── Header ── */}
      <div className="page-header">
        <Icon name="video" size={20} color="var(--accent)" />
        <h1 style={{ marginLeft: 6 }}>Rekaman</h1>
        <span className="badge" style={{ marginLeft: 6, background: 'var(--bg3)', color: 'var(--txt2)' }}>
          {filtered.length} file
        </span>
      </div>

      {/* ── Camera chips ── */}
      {camIds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <Chip active={camFilter === 'all'} onClick={() => { setCamFilter('all'); setDay(null); }}>
            Semua Kamera
          </Chip>
          {camIds.map(id => (
            <Chip key={id} active={camFilter === id} onClick={() => { setCamFilter(id); setDay(null); }}>
              <Icon name="camera" size={12} />{id}
            </Chip>
          ))}
        </div>
      )}

      {/* ── Date filter row ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20, overflow: 'hidden' }}>
        <select className="form-input" style={{ width: 'auto', padding: '4px 10px', fontSize: 13, flexShrink: 0 }}
          value={year} onChange={e => { setYear(+e.target.value); setMonth(null); setDay(null); }}>
          {YEARS().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', flex: 1 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', paddingBottom: 2 }}>
            <Chip active={month === null} onClick={() => { setMonth(null); setDay(null); }} small>Semua</Chip>
            {MONTHS.map((m, i) => (
              <Chip key={i} active={month === i} onClick={() => { setMonth(i); setDay(null); }} small>{m}</Chip>
            ))}
          </div>
        </div>
      </div>

      {/* ── Day picker (only when a month is selected) ── */}
      {month !== null && activeDays.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', paddingBottom: 2 }}>
            <Chip active={day === null} onClick={() => setDay(null)} small>Semua Hari</Chip>
            {activeDays.map(d => (
              <Chip key={d} active={day === d} onClick={() => setDay(d)} small>{d}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* ── Gallery ── */}
      {loading ? (
        <div className="empty-state"><Icon name="activity" size={28} color="var(--txt3)" /><span>Memuat…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Icon name="video" size={40} color="var(--txt3)" />
          <div style={{ fontWeight: 600 }}>Tidak ada rekaman</div>
          <div style={{ fontSize: 13 }}>Aktifkan rekaman di pengaturan kamera</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {filtered.map(f => <RecCard key={f.url} file={f} />)}
        </div>
      )}
    </div>
  );
}

function RecCard({ file }) {
  return (
    <div className="card rec-card" style={{ padding: 0, overflow: 'hidden' }}>
      <video
        src={file.url}
        controls
        preload="metadata"
        className="rec-thumb"
      />
      <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{fmt(file.mtime)}</span>
          <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{fmtSize(file.size)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <a href={file.url} download className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
            <Icon name="play" size={12} />Unduh
          </a>
          <span className="badge" style={{ background: 'var(--bg3)', color: 'var(--txt2)', alignSelf: 'center' }}>
            {file.camId}
          </span>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, small, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: small ? '4px 10px' : '5px 13px',
      borderRadius: 20, border: active ? 'none' : '1px solid var(--border)',
      cursor: 'pointer', fontSize: small ? 12 : 13, fontWeight: 500,
      background: active ? 'var(--accent)' : 'var(--bg2)',
      color: active ? '#fff' : 'var(--txt2)',
      transition: 'background .12s, color .12s',
    }}>
      {children}
    </button>
  );
}
