import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevNotificationsRef = useRef([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get('/notifications');
      if (data.success) {
        const fetched = data.data || [];
        setNotifications(fetched);
        
        const unread = fetched.filter(n => !n.isRead).length;
        setUnreadCount(unread);

        // Check if there are new notifications to toast
        // We only toast notifications that are unread AND were not in the previous fetch
        const prevIds = new Set(prevNotificationsRef.current.map(n => n._id));
        
        fetched.forEach(n => {
          if (!n.isRead && !prevIds.has(n._id)) {
            // Trigger toast
            triggerToast(n);
          }
        });

        prevNotificationsRef.current = fetched;
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, [user]);

  const triggerToast = (n) => {
    const toastOptions = {
      duration: 5000,
      position: 'bottom-right',
      style: {
        background: '#1e293b',
        color: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '14px',
        padding: '12px 16px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
      }
    };

    if (n.type === 'expense_added') {
      toast.success(
        <div className="flex flex-col">
          <span className="font-semibold text-green-400">{n.title}</span>
          <span className="text-xs text-slate-300 mt-0.5">{n.message}</span>
        </div>,
        toastOptions
      );
    } else if (n.type === 'budget_warning') {
      toast.error(
        <div className="flex flex-col">
          <span className="font-semibold text-rose-400">{n.title}</span>
          <span className="text-xs text-slate-300 mt-0.5">{n.message}</span>
        </div>,
        toastOptions
      );
    } else if (n.type === 'settlement_completed') {
      toast.success(
        <div className="flex flex-col">
          <span className="font-semibold text-sky-400">{n.title}</span>
          <span className="text-xs text-slate-300 mt-0.5">{n.message}</span>
        </div>,
        toastOptions
      );
    } else {
      toast(
        <div className="flex flex-col">
          <span className="font-semibold text-emerald-400">{n.title}</span>
          <span className="text-xs text-slate-300 mt-0.5">{n.message}</span>
        </div>,
        toastOptions
      );
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data } = await api.put('/notifications/read');
      if (data.success) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking notifications read:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      const { data } = await api.put('/notifications/read', { id });
      if (data.success) {
        setNotifications(prev =>
          prev.map(n => (n._id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification read:', error);
    }
  };

  // Poll for notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 15000); // Poll every 15s
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setUnreadCount(0);
      prevNotificationsRef.current = [];
    }
  }, [user, fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        fetchNotifications,
        markAllAsRead,
        markAsRead
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
