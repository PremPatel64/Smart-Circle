import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, PiggyBank, BarChart3, User, X } from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Groups', path: '/groups', icon: Users },
    { name: 'Budgets', path: '/budgets', icon: PiggyBank },
    { name: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
    { name: 'Profile', path: '/profile', icon: User },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200/80 dark:bg-slate-950 dark:border-slate-900 py-6 px-4 flex flex-col justify-between transition-transform duration-300 lg:sticky lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-8">
          {/* Mobile Close Button */}
          <div className="flex items-center justify-between lg:hidden">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-200">Menu</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-green-500 text-white shadow-md shadow-green-500/20'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-slate-100'
                    }`
                  }
                  end={item.path === '/'}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-slate-400 dark:text-slate-600 text-center font-medium">
          SmartSplit v1.0.0 &copy; 2026
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
