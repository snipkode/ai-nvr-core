import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Camera, MonitorPlay, Video, Cpu, PlusCircle } from 'lucide-react';

function fmt(ts) { return new Date(ts).toLocaleTimeString(); }

export default function Dashboard() {
  const [channels, setChannels] = useState([]);
  const [detCount, setDetCount] = useState(0);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}`);
    ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (!msg.objects?.length) return;
        setDetCount(c => c + 1);
        setActivity(p => [{ id: msg.channel, objects: msg.objects.map(o => o.class), ts: msg.timestamp }, ...p].slice(0, 5));
      } catch {}
    };
    return () => ws.close();
  }, []);

  const active = channels.filter(c => c.active).length;
  const recording = channels.filter(c => c.recording).length;

  const showGuide = channels.length === 0;

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header">
        <h1>Dashboard</h1>
        <Link to="/cameras" className="btn btn-primary btn-sm"><PlusCircle size={14} />Add Camera</Link>
      </div>

      {/* Onboarding guide for first-time users */}
      {showGuide && (
        <>
          <p style={{ fontSize: 14, color: 'var(--txt2)', marginBottom: 16 }}>
            Selamat datang! Ikuti langkah berikut untuk mulai memantau kamera. 👋
          </p>
          <div className="guide-steps">
            {[
              { n: 1, title: 'Tambah Kamera', desc: 'Hubungkan IP Camera atau gunakan kamera HP Anda sebagai sumber video.', to: '/cameras', cta: 'Tambah Kamera' },
              { n: 2, title: 'Lihat Live Stream', desc: 'Pantau semua kamera sekaligus dari halaman Live Grid.', to: '/live', cta: 'Buka Live Grid' },
              { n: 3, title: 'Aktifkan Rekaman', desc: 'Nyalakan tombol rekam di pengaturan kamera. Rekaman otomatis tersimpan.', to: '/cameras', cta: 'Pengaturan Kamera' },
            ].map(s => (
              <div key={s.n} className="guide-step">
                <div className="guide-num">{s.n}</div>
                <div style={{ flex: 1 }}>
                  <div className="guide-step-title">{s.title}</div>
                  <div className="guide-step-desc">{s.desc}</div>
                </div>
                <Link to={s.to} className="btn btn-ghost btn-sm">{s.cta}</Link>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Stats */}
      <div className="cards">
        {[
          { icon: '📹', label: 'Total Kamera', value: channels.length, color: 'var(--accent)', bg: 'rgba(59,130,246,.1)' },
          { icon: '🟢', label: 'Aktif',        value: active,          color: 'var(--success)', bg: 'rgba(34,197,94,.1)' },
          { icon: '⏺️', label: 'Merekam',     value: recording,       color: 'var(--danger)',  bg: 'rgba(239,68,68,.1)' },
          { icon: '🔍', label: 'Deteksi',      value: detCount,        color: 'var(--purple)',  bg: 'rgba(139,92,246,.1)' },
        ].map(({ icon, label, value, color, bg }) => (
          <div className="card" key={label}>
            <div className="card-icon" style={{ background: bg, fontSize: 18 }}>{icon}</div>
            <div className="card-label">{label}</div>
            <div className="card-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {channels.length > 0 && (
        <div className="actions">
          <Link to="/live"    className="btn btn-primary"><MonitorPlay size={15} />Live Grid</Link>
          <Link to="/cameras" className="btn btn-ghost"  ><Camera size={15} />Kelola Kamera</Link>
        </div>
      )}

      {/* Activity */}
      {activity.length > 0 && (
        <>
          <div className="section-title">Deteksi Terbaru</div>
          <div className="activity-list">
            {activity.map((a, i) => (
              <div key={i} className="activity-item">
                <span className="badge live"><span className="dot" />AI</span>
                <span><strong>{a.id}</strong> — {[...new Set(a.objects)].join(', ')}</span>
                <span className="activity-time">{fmt(a.ts)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
