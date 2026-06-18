import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { Bell, Sun, Moon, LogOut, Menu, User as UserIcon, Check } from 'lucide-react';
import { Link } from 'react-router-dom';

const Header = ({ onMobileToggle }) => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleMarkRead = (e, id) => {
    e.stopPropagation();
    markAsRead(id);
  };

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-slate-200 dark:border-slate-800/50 py-3 px-4 md:px-6 flex items-center justify-between">
      {/* Mobile Toggle & Logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileToggle}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 lg:hidden focus:outline-none"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/" className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center font-bold text-white shadow-md shadow-green-500/25">
            S
          </span>
          <span className="font-bold text-xl bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            SmartSplit
          </span>
        </Link>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus:outline-none"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className={`p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors focus:outline-none relative ${
              showNotifications ? 'bg-slate-100 dark:bg-slate-800' : ''
            }`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center pulse-soft">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl glass-card border border-slate-200 dark:border-slate-800/80 shadow-xl overflow-hidden flex flex-col z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-green-500 hover:text-green-600 dark:hover:text-green-400 font-medium"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50 overflow-y-auto no-scrollbar max-h-72">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      className={`p-3 text-left transition-colors flex items-start justify-between gap-2 ${
                        !n.isRead ? 'bg-slate-50/70 dark:bg-slate-800/20' : ''
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 max-w-[85%]">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {n.title}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          {n.message}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                          {new Date(n.createdAt || n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => handleMarkRead(e, n._id)}
                          className="p-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-green-100 dark:hover:bg-green-950/50 text-slate-400 hover:text-green-500 transition-colors"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold uppercase">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                user?.name ? user.name[0] : 'U'
              )}
            </div>
            <span className="hidden md:inline text-sm font-semibold text-slate-700 dark:text-slate-200">
              {user?.name}
            </span>
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl glass-card border border-slate-200 dark:border-slate-800/80 shadow-xl overflow-hidden py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <Link
                to="/profile"
                onClick={() => setShowProfileMenu(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                <span>My Profile</span>
              </Link>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
