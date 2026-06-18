import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user profile if token is present
  const loadProfile = async () => {
    try {
      const { data } = await api.get('/auth/profile');
      if (data.success) {
        setUser(data.data);
        localStorage.setItem('user', JSON.stringify(data.data));
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      setUser(data.data);
      localStorage.setItem('user', JSON.stringify(data.data));
      await loadProfile(); // load full profile details
    }
    return data;
  };

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    if (data.success) {
      localStorage.setItem('token', data.data.token);
      setUser(data.data);
      localStorage.setItem('user', JSON.stringify(data.data));
      await loadProfile(); // load full profile details
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateProfile = async (name, email) => {
    const { data } = await api.put('/auth/profile', { name, email });
    if (data.success) {
      setUser(prev => ({ ...prev, ...data.data }));
      localStorage.setItem('user', JSON.stringify({ ...user, ...data.data }));
    }
    return data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
    return data;
  };

  const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const { data } = await api.post('/auth/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (data.success) {
      setUser(prev => ({ ...prev, avatar: data.avatar }));
      // Fetch full profile again to sync
      await loadProfile();
    }
    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        uploadAvatar,
        loadProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
