import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  Send,
  PlusCircle,
  Activity,
  Search,
  Settings,
  Mail,
} from 'lucide-react';

interface SidebarProps {
  onOpenCompose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCompose }) => {
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Scheduled Emails', path: '/scheduled', icon: Clock },
    { label: 'Sent Emails', path: '/sent', icon: Send },
    { label: 'Search Emails', path: '/search', icon: Search },
    { label: 'Queue Monitoring', path: '/queue', icon: Activity },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-emerald-500/20">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight leading-tight">
              ReachInbox
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Job Scheduler</p>
          </div>
        </div>

        {/* Compose CTA */}
        <div className="p-4">
          <button
            onClick={onOpenCompose}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Compose Email</span>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800/90 text-emerald-400 border border-slate-700/60 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status */}
      <div className="p-4 border-t border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <div className="text-xs">
            <div className="text-slate-300 font-medium">Engine Active</div>
            <div className="text-[10px] text-slate-500">BullMQ + Redis 7.0</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
