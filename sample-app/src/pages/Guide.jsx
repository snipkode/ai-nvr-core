import { Link } from 'react-router-dom';
import { Icon } from '../components/Icons';

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div className="section-title" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Step({ n, title, desc, tip }) {
  return (
    <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{n}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.6 }}>{desc}</div>
        {tip && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--accent)', background: 'rgba(59,130,246,.08)', borderRadius: 8, padding: '5px 10px' }}>{tip}</div>}
      </div>
    </div>
  );
}

function InfoCard({ icon, color, bg, title, desc }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon name={icon} size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="page" style={{ animation: 'fadeIn .3s', maxWidth: 680 }}>

      {/* Header */}
      <div className="page-header">
        <Icon name="guide" size={20} color="var(--accent)" />
        <h1 style={{ marginLeft: 6 }}>Panduan Penggunaan</h1>
      </div>
      <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 28 }}>
        AI NVR adalah sistem kamera keamanan berbasis AI yang bisa memantau, merekam, dan mendeteksi objek secara real-time. Panduan ini menjelaskan cara menambahkan kamera dengan metode <strong style={{ color: 'var(--txt)' }}>AOA (Any Origin Access)</strong> — menggunakan perangkat apapun sebagai kamera.
      </p>

      {/* Apa itu AOA */}
      <Section title="Apa itu Metode AOA?">
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '16px 18px', marginBottom: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.7, marginBottom: 10 }}>
            <strong style={{ color: 'var(--txt)' }}>AOA (Any Origin Access)</strong> adalah metode menghubungkan kamera dari perangkat manapun — HP Android, iPhone, laptop, atau IP Camera — ke sistem AI NVR tanpa konfigurasi jaringan yang rumit.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
            {[
              { icon: 'phone',   color: 'var(--success)', bg: 'rgba(34,197,94,.1)',   title: 'HP Android / iPhone', desc: 'Via app IP Webcam atau DroidCam' },
              { icon: 'monitor', color: 'var(--accent)',  bg: 'rgba(59,130,246,.1)',  title: 'Laptop / PC',         desc: 'Via browser langsung (WebRTC)' },
              { icon: 'wifi',    color: 'var(--purple)',  bg: 'rgba(139,92,246,.1)',  title: 'IP Camera / CCTV',    desc: 'Via stream RTSP/HTTP' },
              { icon: 'cctv',    color: 'var(--warning)', bg: 'rgba(245,158,11,.1)',  title: 'Kamera Apapun',       desc: 'Selama ada URL stream' },
            ].map(c => <InfoCard key={c.title} {...c} />)}
          </div>
        </div>
      </Section>

      {/* Metode 1: HP via IP Webcam */}
      <Section title="Metode 1 — HP Android via IP Webcam (Direkomendasikan)">
        <Step n={1} title="Install IP Webcam di HP Android"
          desc='Download aplikasi "IP Webcam" oleh Pavel Khlebovich dari Google Play Store.'
          tip='Gratis. Rating tinggi. Tidak perlu root.' />
        <Step n={2} title="Hubungkan HP ke WiFi yang sama"
          desc='Pastikan HP dan server AI NVR berada di jaringan WiFi yang sama.' />
        <Step n={3} title='Buka IP Webcam → tap "Start Server"'
          desc='Scroll ke bawah di aplikasi, tap tombol "Start Server". Layar akan menampilkan alamat IP seperti: http://192.168.1.x:8080' />
        <Step n={4} title="Catat URL RTSP-nya"
          desc='Format URL RTSP untuk IP Webcam:'
          tip='rtsp://192.168.1.x:8080/h264_ulaw.sdp' />
        <Step n={5} title='Tambahkan ke AI NVR'
          desc='Buka halaman Kamera → Tambah → pilih "IP Camera / RTSP" → masukkan URL di atas.' />
        <div style={{ marginTop: 8 }}>
          <Link to="/cameras" className="btn btn-primary btn-sm">
            <Icon name="plus" size={13} />Tambah Kamera Sekarang <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </Section>

      {/* Metode 2: HP Browser */}
      <Section title="Metode 2 — HP / Laptop via Browser">
        <Step n={1} title="Buka halaman Camera Sender di perangkat"
          desc='Di HP atau laptop yang ingin dijadikan kamera, buka browser dan akses alamat server AI NVR, lalu buka menu "Sender".' />
        <Step n={2} title='Tap "Start Streaming"'
          desc='Browser akan meminta izin kamera. Izinkan, lalu stream otomatis dikirim ke server.' />
        <Step n={3} title="Catat Channel ID"
          desc='Di halaman Sender ada Channel ID unik (contoh: browser-abc123). Salin ID ini.' />
        <Step n={4} title="Tambahkan di Kamera Manager"
          desc='Kamera browser otomatis muncul saat streaming aktif. Atau tambah manual dengan ID tersebut.' />
        <div style={{ marginTop: 8 }}>
          <Link to="/camera" className="btn btn-ghost btn-sm">
            <Icon name="monitor" size={13} />Buka Camera Sender <Icon name="arrowRight" size={13} />
          </Link>
        </div>
      </Section>

      {/* Metode 3: DroidCam */}
      <Section title="Metode 3 — DroidCam (Android & iPhone)">
        <Step n={1} title="Install DroidCam di HP"
          desc='Download DroidCam dari Play Store (Android) atau App Store (iPhone).' />
        <Step n={2} title="Catat IP dan Port yang ditampilkan"
          desc='Buka DroidCam, aplikasi menampilkan IP dan port, contoh: 192.168.1.x:4747' />
        <Step n={3} title="Gunakan URL berikut di AI NVR"
          desc='Format URL:'
          tip='http://192.168.1.x:4747/mjpegfeed  atau  rtsp://192.168.1.x:4747/video' />
      </Section>

      {/* Tips */}
      <Section title="Tips & Troubleshooting">
        {[
          { icon: 'check', color: 'var(--success)', title: 'Pastikan satu jaringan', desc: 'HP/kamera dan server harus terhubung ke WiFi yang sama, atau gunakan IP publik jika beda jaringan.' },
          { icon: 'check', color: 'var(--success)', title: 'Gunakan RTSP over TCP', desc: 'AI NVR menggunakan -rtsp_transport tcp secara default untuk koneksi lebih stabil.' },
          { icon: 'check', color: 'var(--success)', title: 'Reconnect otomatis', desc: 'Jika kamera terputus, sistem akan mencoba reconnect otomatis setiap 3 detik.' },
          { icon: 'check', color: 'var(--success)', title: 'Aktifkan rekaman', desc: 'Setelah kamera terhubung, buka pengaturan kamera dan aktifkan "Rekam Otomatis" untuk menyimpan video.' },
        ].map(t => (
          <div key={t.title} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <Icon name={t.icon} size={16} color={t.color} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</span>
              <span style={{ fontSize: 13, color: 'var(--txt2)' }}> — {t.desc}</span>
            </div>
          </div>
        ))}
      </Section>

    </div>
  );
}
