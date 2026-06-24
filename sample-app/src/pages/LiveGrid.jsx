import { useState, useEffect } from 'react';
import { Grid2x2, Square, LayoutGrid } from 'lucide-react';
import CameraCard from '../components/CameraCard';

const LAYOUTS = [
  { key: 1, icon: Square,     label: '1' },
  { key: 2, icon: LayoutGrid, label: '2' },
  { key: 4, icon: Grid2x2,    label: '4' },
];

export default function LiveGrid() {
  const [channels, setChannels] = useState([]);
  const [layout, setLayout] = useState(4);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/channels')
      .then(r => r.json())
      .then(setChannels)
      .catch(() => setError('Could not load channels'));
  }, []);

  const slots = channels.slice(0, layout);

  return (
    <div className="page" style={{ animation: 'fadeIn .3s' }}>
      <div className="page-header">
        <h1>Live Grid</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {LAYOUTS.map(({ key, icon: Icon, label }) => (
            <button key={key}
              className={`btn btn-sm btn-icon${layout === key ? ' btn-primary' : ' btn-ghost'}`}
              onClick={() => setLayout(key)}
              title={`${label} camera${key > 1 ? 's' : ''}`}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {channels.length === 0 && !error ? (
        <p className="tip">No channels configured. <a href="/cameras" style={{ color: 'var(--accent)' }}>Add a camera</a>.</p>
      ) : (
        <div className={`cam-grid-${layout}`} style={{ height: layout === 1 ? 480 : undefined }}>
          {slots.map(ch => (
            <div key={ch.id} className="cam-cell">
              <CameraCard channel={ch.id} name={ch.name || ch.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
