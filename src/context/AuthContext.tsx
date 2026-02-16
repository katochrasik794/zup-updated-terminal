'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, apiClient } from '../lib/api';

interface User {
  id: string;
  clientId?: string;
  email: string;
  name?: string;
  phone?: string;
  country?: string;
  role: string;
  status: string;
  emailVerified: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  killSwitchActive?: boolean;
  killSwitchUntil?: string | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isKillSwitchActive: () => boolean;
  getKillSwitchRemainingTime: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      // Check for auto-login in URL parameters
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const autoLogin = params.get('autoLogin');
        const token = params.get('token');
        const clientId = params.get('clientId');
        const accountId = params.get('accountId');

        if (autoLogin === 'true' && token && clientId) {
          try {
            const response = await authApi.ssoLogin(token, clientId) as any;
            if (response.success) {
              if (response.token) {
                apiClient.setToken(response.token);
                document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              }

              if (response.user) {
                setUser(response.user);
                if (response.user.name) localStorage.setItem('userName', response.user.name);
                if (response.user.email) localStorage.setItem('userEmail', response.user.email);
              }

              if (accountId) {
                sessionStorage.setItem('defaultMt5Account', accountId);
                localStorage.setItem('defaultMt5Account', accountId);
                localStorage.setItem('accountId', accountId);
              }

              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error('SSO login failed in AuthProvider:', error);
          }
        }
      }

      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await authApi.getCurrentUser() as any;
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        apiClient.clearToken();
      }
    } catch (error: any) {
      // Don't clear token on network errors - might just be backend not running
      if (error.message && error.message.includes('Backend server is not reachable')) {
      } else {
        apiClient.clearToken();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password) as any;

    if (response.success && response.token) {
      // Store token in localStorage for client-side access
      apiClient.setToken(response.token);

      // Also set a cookie for middleware (non-httpOnly, accessible to client)
      if (typeof document !== 'undefined') {
        document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      if (response.user) {
        setUser(response.user);
      } else {
        // Fetch user details if not in response
        await refreshUser();
      }
    } else {
      throw new Error(response.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string, name?: string, phone?: string) => {
    const response = await authApi.register(email, password, name, phone) as any;

    if (response.success && response.token) {
      apiClient.setToken(response.token);

      if (response.user) {
        setUser(response.user);
      } else {
        await refreshUser();
      }
    } else {
      throw new Error(response.message || 'Registration failed');
    }
  };

  const logout = async () => {
    // 1. Optimistically clear local state immediately
    apiClient.clearToken();

    // Clear account-related storage to prevent "Account not found" errors for new users
    if (typeof window !== 'undefined') {
      localStorage.removeItem('defaultMt5Account');
      localStorage.removeItem('accountId');

      // Clear cookie
      document.cookie = 'token=; path=/; max-age=0';
    }

    // Clear user state
    setUser(null);

    // 2. Fire and forget the logout request to the server (don't block UI)
    try {
      authApi.logout().catch(() => { });
    } catch (error) {
      // Ignore background errors
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser() as any;
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch (error) {

      setUser(null);
    }
  };

  const isKillSwitchActive = (): boolean => {
    if (!user || !user.killSwitchActive) return false;
    if (!user.killSwitchUntil) return false;

    const now = new Date();
    const until = new Date(user.killSwitchUntil);
    return now < until;
  };

  const getKillSwitchRemainingTime = (): string | null => {
    if (!isKillSwitchActive() || !user?.killSwitchUntil) return null;

    const now = new Date();
    const until = new Date(user.killSwitchUntil);
    const diffMs = until.getTime() - now.getTime();

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshUser,
    isKillSwitchActive,
    getKillSwitchRemainingTime,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
