import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MonitorPlay, PlusCircle } from 'lucide-react';

function fmt(ts) {
  return new Date(ts).toLocaleTimeString();
}

export default function Dashboard() {
  const [channels, setChannels] = useState([]);
  const [detCount, setDetCount] = useState(0);
  const [activity, setActivity] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    fetch('/api/channels').then(r => r.json()).then(setChannels).catch(() => {});
  }, []);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (!msg.objects?.length) return;
        setDetCount(c => c + 1);
        setActivity(prev => [{
          camera_id: msg.camera_id,
          objects: msg.objects.map(o => o.class),
          ts: msg.timestamp,
        }, ...prev].slice(0, 5));
      } catch {}
    };
    return () => ws.close();
  }, []);

  const active = channels.filter(c => c.active !== false).length;

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header"><h1>Dashboard</h1></div>

      <div className="cards">
        <div className="card">
          <div className="card-label">Total Channels</div>
          <div className="card-value">{channels.length}</div>
        </div>
        <div className="card">
          <div className="card-label">Active Streams</div>
          <div className="card-value">{active}</div>
        </div>
        <div className="card">
          <div className="card-label">Detections</div>
          <div className="card-value">{detCount}</div>
        </div>
        <div className="card">
          <div className="card-label">Model</div>
          <div className="card-value" style={{ fontSize: 14, paddingTop: 8 }}>YOLOv8n</div>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={() => nav('/live')}>
          <MonitorPlay size={15} />Live Grid
        </button>
        <button className="btn btn-ghost" onClick={() => nav('/cameras')}>
          <PlusCircle size={15} />Add Camera
        </button>
      </div>

      <div className="section-title">Recent Activity</div>
      {activity.length === 0 ? (
        <p className="tip">No detections yet — waiting for events…</p>
      ) : (
        <div className="activity-list">
          {activity.map((a, i) => (
            <div key={i} className="activity-item">
              <span className="badge live"><span className="dot" />Live</span>
              <span><strong>{a.camera_id}</strong> — {[...new Set(a.objects)].join(', ')}</span>
              <span className="activity-time">{fmt(a.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
