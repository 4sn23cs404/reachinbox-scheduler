import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '../types';
import api from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => void;
  loginAsDemoUser: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const loginWithGoogle = () => {
    // Redirect to backend Google OAuth initiation route
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/auth/google`;
  };

  const loginAsDemoUser = async () => {
    try {
      setLoading(true);
      const res = await api.post('/auth/demo-login');
      setUser(res.data.user);
    } catch (err: any) {
      console.error('Demo login failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginWithGoogle, loginAsDemoUser, logout, checkAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
