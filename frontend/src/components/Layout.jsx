import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const tierLabel = user?.tier_level === 1 ? 'Admin' : user?.tier_level === 2 ? 'Editor' : 'Viewer';
  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>SaaS Platform</h1>
          <p>Management Console</p>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📊</span> Dashboard
          </NavLink>
          <NavLink to="/tables" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">📋</span> Tables
          </NavLink>
          <NavLink to="/sql-editor" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚡</span> SQL Editor
          </NavLink>
          <NavLink to="/payment" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">💳</span> Payment
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">⚙️</span> Settings
          </NavLink>
          <button className="nav-link" onClick={handleLogout} style={{ border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', background: 'none' }}>
            <span className="nav-icon">🚪</span> Logout
          </button>
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.username}</div>
            <span className={`user-tier tier-${user?.tier_level}`}>Tier {user?.tier_level} — {tierLabel}</span>
          </div>
        </div>
      </aside>
      <main className="main-content fade-in">
        <Outlet />
      </main>
    </div>
  );
}