import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, Package, Truck,
  Warehouse, LogOut, Zap
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const NAV = [
  { to: '/',          label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/map',       label: 'Floor Map',     icon: Map },
  { to: '/shipments', label: 'Shipments',     icon: Truck },
];

export default function Sidebar() {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logoutUser(); navigate('/login'); };

  return (
    <aside className="w-60 bg-ink-800 border-r border-ink-700 flex flex-col h-screen flex-shrink-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-ink-700 gap-3">
        <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Zap size={16} className="text-ink-900" strokeWidth={2.5} />
        </div>
        <div>
          <span className="font-display text-lg font-bold tracking-[0.2em] text-ink-100 uppercase">LUME</span>
          <div className="text-[9px] text-ink-500 tracking-widest uppercase -mt-0.5">Logistics</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="label px-3 mb-3">Navigation</div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
            }
          >
            <Icon size={16} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-ink-700 space-y-2">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-teal-400">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-ink-200 truncate">{user?.name || 'User'}</div>
            <div className="text-[10px] text-ink-500 capitalize">{user?.role || 'operator'}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="nav-item nav-item-inactive w-full text-red-400 hover:text-red-300 hover:bg-red-900/20"
        >
          <LogOut size={14} strokeWidth={1.8} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
