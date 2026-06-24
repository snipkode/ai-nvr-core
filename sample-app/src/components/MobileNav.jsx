import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Grid2x2, Camera, Video, X, Cctv } from 'lucide-react';

const NAV = [
  { to: '/',        label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/live',    label: 'Live Grid',  icon: Grid2x2 },
  { to: '/cameras', label: 'Cameras',   icon: Camera },
  { to: '/camera',  label: 'Sender',    icon: Video },
];

export default function MobileNav({ open, onClose }) {
  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="drawer-header">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cctv size={20} />AI NVR
          </span>
          <button className="btn-icon btn" onClick={onClose}><X size={16} /></button>
        </div>
        <nav className="drawer-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
