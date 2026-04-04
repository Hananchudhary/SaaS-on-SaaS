import { createContext, useContext, useState, useCallback } from 'react';
import api from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) return null;
    return {
      session_id: sessionId,
      username: sessionStorage.getItem('username'),
      tier_level: parseInt(sessionStorage.getItem('tier_level'), 10),
      client_id: parseInt(sessionStorage.getItem('client_id'), 10),
      user_id: parseInt(sessionStorage.getItem('user_id'), 10),
      warning: sessionStorage.getItem('warning') || null,
    };
  });

  const login = useCallback(async (email, password) => {
    const res = await api.post('/login', { email, password });
    const data = res.data.data;
    const userData = {
      session_id: data.session_id,
      username: data.username,
      tier_level: data.tier_level,
      client_id: data.client_id,
      user_id: data.user_id,
      warning: data.warning || null,
    };
    sessionStorage.setItem('session_id', data.session_id);
    sessionStorage.setItem('username', data.username);
    sessionStorage.setItem('tier_level', data.tier_level);
    sessionStorage.setItem('client_id', data.client_id);
    sessionStorage.setItem('user_id', data.user_id);
    if (data.warning) sessionStorage.setItem('warning', data.warning);
    setUser(userData);
    return userData;
  }, []);

  const setWarning = useCallback((warning) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, warning: warning || null };
    });
    if (warning) {
      sessionStorage.setItem('warning', warning);
    } else {
      sessionStorage.removeItem('warning');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/logout');
    } catch (e) {
      // Ignore logout errors, still clear session
    }
    sessionStorage.clear();
    setUser(null);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, login, logout, setWarning, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
