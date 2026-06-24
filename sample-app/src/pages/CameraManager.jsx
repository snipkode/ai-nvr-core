import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icons';

function Toggle({ checked, onChange }) {
  return (
    <label className="switch" onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="switch-slider" />
    </label>
  );
}

function CameraItem({ ch, onDelete, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [rec, setRec]   = useState(ch.recording);
  const [ar, setAr]     = useState(ch.autoRemove || { value: 0, unit: 'days' });
  const [saving, setSaving] = useState(false);

  const save = async (patch) => {
    setSaving(true);
    await fetch(`/api/channels/${encodeURIComponent(ch.id)}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    onUpdate();
  };

  const handleRec = (val) => { setRec(val); save({ recording: val }); };

  return (
    <div className="camera-item">
      <div className="camera-header" onClick={() => setOpen(o => !o)}>
        <div className="camera-thumb">
          <img src={`/stream/${ch.id}`} alt={ch.name} onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div className="camera-meta">
          <div className="camera-name">{ch.name || ch.id}</div>
          <div className="camera-url">{ch.url || 'Browser Camera'}</div>
        </div>
        <div className="camera-actions">
          {ch.active
            ? <span className="badge live"><span className="dot" />Live</span>
            : <span className="badge offline">Offline</span>}
          {rec && <span className="badge recording"><span className="dot" />Rec</span>}
          <button className="icon-btn" onClick={e => { e.stopPropagation(); onDelete(ch.id); }} style={{ color: 'var(--danger)' }}>
            <Icon name="trash" size={15} />
          </button>
          <Icon name={open ? 'chevUp' : 'chevDown'} size={16} color="var(--txt3)" />
        </div>
      </div>

      {open && (
        <div className="camera-settings">
          <div className="toggle-wrap">
            <div className="toggle-info">
              <div className="toggle-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="video" size={14} color="var(--danger)" />Rekam Otomatis</div>
              <div className="toggle-sub">Simpan video ke server setiap 5 menit</div>
            </div>
            <Toggle checked={rec} onChange={handleRec} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="trash" size={13} />Hapus Rekaman Otomatis Setelah</div>
            <div className="autoremove-row">
              <input className="form-input" type="number" min={0} placeholder="0"
                value={ar.value} onChange={e => setAr(a => ({ ...a, value: e.target.value }))} />
              <select className="form-input" value={ar.unit} onChange={e => setAr(a => ({ ...a, unit: e.target.value }))}>
                <option value="days">Hari</option>
                <option value="months">Bulan</option>
                <option value="years">Tahun</option>
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => save({ autoRemove: ar })} disabled={saving}>
                {saving ? '…' : 'Simpan'}
              </button>
            </div>
            <div className="form-hint">
              {ar.value > 0
                ? `Rekaman lebih dari ${ar.value} ${ar.unit === 'days' ? 'hari' : ar.unit === 'months' ? 'bulan' : 'tahun'} akan dihapus otomatis.`
                : 'Set 0 = tidak pernah dihapus otomatis.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CameraManager() {
  const [channels, setChannels] = useState([]);
  const [step, setStep]   = useState('list');
  const [form, setForm]   = useState({ id: '', url: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
  useEffect(() => { load(); }, []);

  const addRtsp = async (e) => {
    e.preventDefault();
    if (!form.id.trim() || !form.url.trim()) return setError('ID dan URL wajib diisi.');
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/channels', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: form.id.trim(), url: form.url.trim(), name: form.name.trim() || form.id.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Gagal');
      setForm({ id: '', url: '', name: '' }); setStep('list'); load();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!confirm(`Hapus kamera "${id}"?`)) return;
    await fetch(`/api/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header">
        <h1>Kamera</h1>
        {step === 'list'
          ? <button className="btn btn-primary btn-sm" onClick={() => setStep('choose')}><Icon name="plus" size={14} />Tambah</button>
          : <button className="btn btn-ghost btn-sm" onClick={() => { setStep('list'); setError(''); }}>← Kembali</button>}
      </div>

      {/* Step: choose type */}
      {step === 'choose' && (
        <>
          <p className="tip" style={{ marginBottom: 14 }}>Pilih sumber kamera:</p>
          <div className="step-wizard">
            <div className="step-option" onClick={() => setStep('rtsp')}>
              <div className="step-option-icon"><Icon name="wifi" size={28} color="var(--accent)" /></div>
              <div className="step-option-label">IP Camera / RTSP</div>
              <div className="step-option-desc">Kamera IP, CCTV, atau HP dengan app IP Webcam / DroidCam</div>
            </div>
            <div className="step-option" onClick={() => setStep('browser')}>
              <div className="step-option-icon"><Icon name="camera" size={28} color="var(--accent)" /></div>
              <div className="step-option-label">Kamera HP / Browser</div>
              <div className="step-option-desc">Gunakan kamera HP atau laptop langsung via browser</div>
            </div>
          </div>
        </>
      )}

      {/* Step: RTSP form */}
      {step === 'rtsp' && (
        <>
          <p className="tip" style={{ marginBottom: 14 }}>
            Install <strong>IP Webcam</strong> di HP Android → Start Server → masukkan URL di bawah.
          </p>
          {error && <div className="alert-error">{error}</div>}
          <form onSubmit={addRtsp} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440 }}>
            <div className="form-group">
              <label className="form-label">Nama Kamera</label>
              <input className="form-input" placeholder="Contoh: Pintu Depan"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">ID Unik</label>
              <input className="form-input" placeholder="cam1"
                value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
              <span className="form-hint">Huruf kecil, tanpa spasi. Contoh: cam1, pintu-depan</span>
            </div>
            <div className="form-group">
              <label className="form-label">RTSP URL</label>
              <input className="form-input" placeholder="rtsp://192.168.x.x:8080/h264_ulaw.sdp"
                value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              <span className="form-hint">
                IP Webcam: <code style={{ color: 'var(--accent)' }}>rtsp://192.168.x.x:8080/h264_ulaw.sdp</code>
              </span>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ alignSelf: 'flex-start' }}>
              {loading ? 'Menghubungkan…' : <><Icon name="plus" size={14} />Tambah Kamera</>}
            </button>
          </form>
        </>
      )}

      {/* Step: browser */}
      {step === 'browser' && (
        <div style={{ maxWidth: 440 }}>
          <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>
            Buka <strong>Camera Sender</strong> di HP atau laptop yang ingin dijadikan kamera,
            lalu tekan <strong>"Start Camera"</strong>.
          </p>
          <Link to="/camera" className="btn btn-primary"><Icon name="video" size={15} />Buka Camera Sender</Link>
        </div>
      )}

      {/* Camera list */}
      {step === 'list' && (
        channels.length === 0
          ? <div className="empty-state">
              <Icon name="camera" size={40} color="var(--txt3)" />
              <div style={{ fontWeight: 600 }}>Belum ada kamera</div>
              <div style={{ fontSize: 13 }}>Tekan "+ Tambah" untuk mulai</div>
            </div>
          : <>
              <div className="section-title">{channels.length} Kamera</div>
              {channels.map(ch => <CameraItem key={ch.id} ch={ch} onDelete={remove} onUpdate={load} />)}
            </>
      )}
    </div>
  );
}
