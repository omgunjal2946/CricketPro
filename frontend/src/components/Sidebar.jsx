
import { NavLink } from 'react-router-dom';

import {
  LayoutDashboard,
  Shield,
  Users,
  CalendarDays,
  Radio,
  Tv,
  Trophy,
  ListOrdered,
  BarChart3,
  Settings,
  LogOut,
  UserCircle
} from 'lucide-react';

import Logo from '../assets/Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { initials } from '../utils/format.js';

const ADMIN_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Teams', icon: Shield },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/matches', label: 'Matches', icon: CalendarDays },
  { to: '/live-score', label: 'Live Score', icon: Radio },
  { to: '/live-center', label: 'Live Match Center', icon: Tv },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/points-table', label: 'Points Table', icon: ListOrdered },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings }
];

const USER_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Explore Teams', icon: Shield },
  { to: '/players', label: 'Explore Players', icon: Users },
  { to: '/matches', label: 'Matches', icon: CalendarDays },
  { to: '/live-score', label: 'Live Score', icon: Radio },
  { to: '/live-center', label: 'Live Match Center', icon: Tv },
  { to: '/tournaments', label: 'Tournaments', icon: Trophy },
  { to: '/points-table', label: 'Points Table', icon: ListOrdered },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'My Profile', icon: UserCircle }
];

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';

  const NAV = isAdmin ? ADMIN_NAV : USER_NAV;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>

      <div className="brand">
        <Logo />
        <span>CricketPro</span>
      </div>

      <nav aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">

        <div className="user-chip">
          <span
            className="avatar avatar-text"
            style={{
              width: 34,
              height: 34,
              fontSize: 13
            }}
          >
            {initials(user?.name)}
          </span>

          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
            <small>
              {isAdmin ? 'Administrator' : 'Cricket User'}
            </small>
          </div>
        </div>

        <button
          className="nav-link nav-logout"
          onClick={logout}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>

      </div>
    </aside>
  );
}
