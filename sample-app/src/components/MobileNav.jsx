import { NavLink } from 'react-router-dom';
import { Icon } from './Icons';

const NAV = [
  { to: '/',        label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/live',    label: 'Live Grid', icon: 'grid' },
  { to: '/cameras', label: 'Kamera',   icon: 'cctv' },
  { to: '/camera',  label: 'Sender',   icon: 'video' },
];

export default function MobileNav({ open, onClose }) {
  return (
    <>
      <div className={`drawer-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`drawer${open ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
            <Icon name="cctv" size={20} color="var(--accent)" />AI NVR
          </span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClose}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon name={icon} size={18} />
              <span className="label">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
}
