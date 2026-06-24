import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Icon } from './components/Icons';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import LiveGrid from './pages/LiveGrid';
import CameraManager from './pages/CameraManager';
import CameraPage from './pages/CameraPage';
import Recordings from './pages/Recordings';
import Guide from './pages/Guide';
import './index.css';

const TITLES = { '/': 'Dashboard', '/live': 'Live Grid', '/cameras': 'Kamera', '/camera': 'Sender', '/recordings': 'Rekaman', '/guide': 'Panduan' };

function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="layout">
      <Sidebar />
      <MobileNav open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setDrawerOpen(true)}>
            <Icon name="menu" size={20} />
          </button>
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{TITLES[pathname] ?? 'AI NVR'}</span>
        </header>
        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/live"    element={<LiveGrid />} />
          <Route path="/cameras"    element={<CameraManager />} />
          <Route path="/camera"     element={<CameraPage />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/guide"      element={<Guide />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return <BrowserRouter><Layout /></BrowserRouter>;
}
