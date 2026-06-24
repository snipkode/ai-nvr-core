import { useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import LiveGrid from './pages/LiveGrid';
import CameraManager from './pages/CameraManager';
import CameraPage from './pages/CameraPage';
import './index.css';

const TITLES = {
  '/':        'Dashboard',
  '/live':    'Live Grid',
  '/cameras': 'Cameras',
  '/camera':  'Sender',
};

function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();
  const title = TITLES[pathname] ?? 'AI NVR';

  return (
    <div className="layout">
      <Sidebar />
      <MobileNav open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="btn-icon btn" onClick={() => setDrawerOpen(true)}>
            <Menu size={18} />
          </button>
          <span className="topbar-title">{title}</span>
        </header>

        <Routes>
          <Route path="/"        element={<Dashboard />} />
          <Route path="/live"    element={<LiveGrid />} />
          <Route path="/cameras" element={<CameraManager />} />
          <Route path="/camera"  element={<CameraPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
