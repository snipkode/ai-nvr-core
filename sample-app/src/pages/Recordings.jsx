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
  const [cams, setCams]           = useState([]); // [{id, name}]
  const [camFilter, setCamFilter] = useState('all');
  const [year, setYear]           = useState(new Date().getFullYear());
  const [month, setMonth]         = useState(null);
  const [day, setDay]             = useState(null);
  const [search, setSearch]       = useState('');
  const [files, setFiles]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(1);
  const PER_PAGE = 12;

  const loadCams = async () => {
    const [ids, channels] = await Promise.all([
      fetch('/api/recordings').then(r => r.json()).catch(() => []),
      fetch('/api/channels').then(r => r.json()).catch(() => []),
    ]);
    const nameMap = Object.fromEntries(channels.map(c => [c.id, c.name || c.id]));
    setCams(ids.map(id => ({ id, name: nameMap[id] || id })));
  };

  useEffect(() => { loadCams(); }, []);

  useEffect(() => {
    const targets = camFilter === 'all' ? cams.map(c => c.id) : [camFilter];
    if (!targets.length) { setFiles([]); return; }
    setLoading(true);
    Promise.all(targets.map(id =>
      fetch(`/api/recordings/${id}`).then(r => r.json()).then(fs => fs.map(f => ({ ...f, camId: id }))).catch(() => [])
    )).then(all => { setFiles(all.flat()); setLoading(false); setPage(1); });
  }, [camFilter, cams]);

  const camName = (id) => cams.find(c => c.id === id)?.name || id;

  const filtered = files.filter(f => {
    const d = new Date(f.mtime);
    if (d.getFullYear() !== year) return false;
    if (month !== null && d.getMonth() !== month) return false;
    if (day   !== null && d.getDate()  !== day)   return false;
    const q = search.toLowerCase();
    if (q && !f.name.toLowerCase().includes(q) && !camName(f.camId).toLowerCase().includes(q)) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageFiles  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeDays = [...new Set(
    files
      .filter(f => { const d = new Date(f.mtime); return d.getFullYear() === year && (month === null || d.getMonth() === month); })
      .map(f => new Date(f.mtime).getDate())
  )].sort((a, b) => a - b);

  const deleteFile = async (f) => {
    if (!confirm(`Hapus ${f.name}?`)) return;
    await fetch(`/api/recordings/${f.camId}/${f.name}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(x => x.url !== f.url));
  };

  const deleteAllCam = async (id) => {
    const name = camName(id);
    if (!confirm(`Hapus semua rekaman "${name}"?`)) return;
    await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.camId !== id));
    setCams(prev => prev.filter(c => c.id !== id));
    if (camFilter === id) setCamFilter('all');
  };

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>

      <div className="page-header">
        <Icon name="video" size={20} color="var(--accent)" />
        <h1 style={{ marginLeft: 6 }}>Rekaman</h1>
        <span className="badge" style={{ marginLeft: 6, background: 'var(--bg3)', color: 'var(--txt2)' }}>
          {filtered.length} file
        </span>
      </div>

      {/* ── Camera grid filter ── */}
      {cams.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 8, marginBottom: 16 }}>
          <CamCard id="all" label="Semua" active={camFilter === 'all'} onClick={() => { setCamFilter('all'); setDay(null); }} />
          {cams.map(({ id, name }) => (
            <CamCard key={id} id={id} label={name} active={camFilter === id}
              onClick={() => { setCamFilter(id); setDay(null); }}
              onDelete={() => deleteAllCam(id)} />
          ))}
        </div>
      )}

      {/* ── Search + year ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: 140 }}>
          <Icon name="activity" size={13} color="var(--txt3)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="form-input" placeholder="Cari nama file / kamera…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ paddingLeft: 28, fontSize: 13 }} />
        </div>
        <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 13, flexShrink: 0 }}
          value={year} onChange={e => { setYear(+e.target.value); setMonth(null); setDay(null); setPage(1); }}>
          {YEARS().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* ── Month chips ── */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', paddingBottom: 2 }}>
          <Chip active={month === null} onClick={() => { setMonth(null); setDay(null); setPage(1); }} small>Semua</Chip>
          {MONTHS.map((m, i) => (
            <Chip key={i} active={month === i} onClick={() => { setMonth(i); setDay(null); setPage(1); }} small>{m}</Chip>
          ))}
        </div>
      </div>

      {/* ── Day chips ── */}
      {month !== null && activeDays.length > 0 && (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap', paddingBottom: 2 }}>
            <Chip active={day === null} onClick={() => { setDay(null); setPage(1); }} small>Semua Hari</Chip>
            {activeDays.map(d => (
              <Chip key={d} active={day === d} onClick={() => { setDay(d); setPage(1); }} small>{d}</Chip>
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
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))', gap: 8 }}>
            {pageFiles.map(f => <RecCard key={f.url} file={f} camLabel={camName(f.camId)} onDelete={deleteFile} />)}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecCard({ file, camLabel, onDelete }) {
  return (
    <div className="card rec-card" style={{ padding: 0, overflow: 'hidden' }}>
      <video src={file.url} controls preload="metadata" className="rec-thumb" style={{ background: '#000' }} />
      <div style={{ padding: '8px 10px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            {camLabel}
          </span>
          <button className="btn btn-sm" style={{ color: 'var(--danger)', padding: '4px 8px' }}
            onClick={() => onDelete(file)} title="Hapus">
            <Icon name="trash" size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CamCard({ id, label, active, onClick, onDelete }) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onClick} style={{
        width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '10px 8px', borderRadius: 10,
        border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: active ? 'color-mix(in srgb, var(--accent) 12%, var(--bg2))' : 'var(--bg2)',
        cursor: 'pointer', transition: 'all .15s', minWidth: 0,
      }}>
        <Icon name="camera" size={18} color={active ? 'var(--accent)' : 'var(--txt3)'} />
        <span style={{ fontSize: 11, fontWeight: 600, color: active ? 'var(--accent)' : 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {label}
        </span>
      </button>
      {onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Hapus semua rekaman"
          style={{ position: 'absolute', top: 4, right: 4, background: 'var(--bg3)', border: 'none', borderRadius: 6, padding: '2px 4px', cursor: 'pointer', display: 'flex', opacity: 0.7 }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.7}>
          <Icon name="trash" size={11} color="var(--danger)" />
        </button>
      )}
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
