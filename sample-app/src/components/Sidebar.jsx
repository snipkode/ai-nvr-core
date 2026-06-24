import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from './Icons';

const NAV = [
  { to: '/',           label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/live',       label: 'Live Grid', icon: 'grid' },
  { to: '/recordings', label: 'Rekaman',   icon: 'video' },
  { to: '/cameras',    label: 'Kamera',    icon: 'cctv' },
  { to: '/camera',     label: 'Sender',    icon: 'monitor' },
  { to: '/guide',      label: 'Panduan',   icon: 'guide' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <Icon name="cctv" size={22} color="var(--accent)" />
        <span>AI NVR</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon name={icon} size={18} />
            <span className="label">{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="toggle-btn" onClick={() => setCollapsed(c => !c)}>
          <Icon name={collapsed ? 'chevRight' : 'chevLeft'} size={16} />
        </button>
      </div>
    </aside>
  );
}
