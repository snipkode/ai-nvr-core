import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Grid2x2, Camera, Video, ChevronLeft, ChevronRight, Cctv } from 'lucide-react';

const NAV = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/live',    label: 'Live Grid',  icon: Grid2x2 },
  { to: '/cameras', label: 'Cameras',   icon: Camera },
  { to: '/camera',  label: 'Sender',    icon: Video },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <Cctv size={22} />
        <span>AI NVR</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <button className="toggle-btn" onClick={() => setCollapsed(c => !c)} title="Toggle sidebar">
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
}
