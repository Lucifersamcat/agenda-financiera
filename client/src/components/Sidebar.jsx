import { NavLink } from 'react-router-dom';

const links = [
  { to: '/dashboard',    label: 'Dashboard',     icon: '📊' },
  { to: '/transactions', label: 'Transacciones', icon: '💳' },
  { to: '/accounts',     label: 'Cuentas',       icon: '🏦' },
  { to: '/notes',        label: 'Notas',         icon: '📝' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">💰 Agenda Financiera</div>
      <nav style={{ padding: '8px 0' }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
