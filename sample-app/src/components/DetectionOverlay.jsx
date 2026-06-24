import { useState, useEffect, useRef } from 'react';

export default function DetectionOverlay({ channel }) {
  const [tags, setTags] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.camera_id !== channel) return;
        if (!msg.objects?.length) return;

        const labels = [...new Set(msg.objects.map(o => o.class))];
        const id = Date.now();
        setTags(prev => [...prev.slice(-2), { id, labels }]);
        setTimeout(() => setTags(prev => prev.filter(t => t.id !== id)), 3500);
      } catch {}
    };

    return () => ws.close();
  }, [channel]);

  if (!tags.length) return null;
  return (
    <div className="det-overlay">
      {tags.map(({ id, labels }) => (
        <span key={id} className="det-tag">{labels.join(', ')}</span>
      ))}
    </div>
  );
}
