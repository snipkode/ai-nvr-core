import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Video } from 'lucide-react';

export default function CameraManager() {
  const [channels, setChannels] = useState([]);
  const [form, setForm] = useState({ id: '', url: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const load = () =>
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.id.trim() || !form.url.trim()) return setError('ID and URL are required.');
    setLoading(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setForm({ id: '', url: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id) => {
    await fetch(`/api/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header"><h1>Cameras</h1></div>

      <div className="section-title">Channels ({channels.length})</div>
      <div className="channel-list">
        {channels.length === 0 && <p className="tip">No channels yet.</p>}
        {channels.map(ch => (
          <div key={ch.id} className="channel-item">
            <span className={`badge ${ch.active !== false ? 'live' : 'offline'}`}>
              <span className="dot" />{ch.active !== false ? 'Active' : 'Offline'}
            </span>
            <div style={{ flex: 1 }}>
              <div className="channel-id">{ch.id}</div>
              {ch.url && <div className="channel-url">{ch.url}</div>}
            </div>
            <button className="btn btn-sm btn-danger btn-icon" onClick={() => remove(ch.id)} title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <hr className="divider" />
      <div className="section-title">Add RTSP Camera</div>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={add} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
        <div className="form-group">
          <label className="form-label">Channel ID</label>
          <input className="form-input" placeholder="cam1"
            value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">RTSP URL</label>
          <input className="form-input" placeholder="rtsp://192.168.x.x:8080/h264_ulaw.sdp"
            value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          <span className="tip">Example: rtsp://192.168.x.x:8080/h264_ulaw.sdp</span>
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Adding…' : 'Add Camera'}
        </button>
      </form>

      <hr className="divider" />
      <div className="section-title">Browser Camera</div>
      <p className="tip" style={{ marginBottom: 10 }}>Use your device's webcam as a live stream source.</p>
      <button className="btn btn-ghost" onClick={() => nav('/camera')}>
        <Video size={15} />Open Sender
      </button>
    </div>
  );
}
