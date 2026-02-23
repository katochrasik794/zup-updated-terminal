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
  const checkAuthRef = React.useRef(false);

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser() as any;
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
    }
  };

  const checkAuth = async () => {
    if (checkAuthRef.current) return;
    checkAuthRef.current = true;

    try {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);

        // 1. Get SSO params from URL or sessionStorage
        const urlAutoLogin = params.get('autoLogin');
        const urlToken = params.get('token');
        const urlClientId = params.get('clientId');
        const urlAccountId = params.get('accountId') || params.get('mtLogin');

        // IF we have params in URL, save them to sessionStorage and HIDE them immediately
        if (urlAutoLogin === 'true' && urlToken && urlClientId) {
          // *** CROSS-ACCOUNT FIX: Clear the old session from localStorage explicitly! ***
          // Because middleware no longer strips this token, we successfully reach this block.
          apiClient.clearToken();
          localStorage.removeItem('accountId');
          localStorage.removeItem('defaultMt5Account');
          localStorage.removeItem('userName');
          localStorage.removeItem('userEmail');
          document.cookie = 'token=; path=/; max-age=0'; // Clear old terminal cookie just in case

          sessionStorage.setItem('sso_autoLogin', 'true');
          sessionStorage.setItem('sso_token', urlToken);
          sessionStorage.setItem('sso_clientId', urlClientId);
          if (urlAccountId) sessionStorage.setItem('sso_accountId', urlAccountId);

          // Hide from URL instantly to prevent leakage and bookmarking of tokens
          if (window.location.search) {
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', newUrl);
          }
        }

        // Now read from either source (prefer sessionStorage which we just populated)
        const autoLogin = sessionStorage.getItem('sso_autoLogin') || urlAutoLogin;
        const token = sessionStorage.getItem('sso_token') || urlToken;
        const clientId = sessionStorage.getItem('sso_clientId') || urlClientId;
        const accountId = sessionStorage.getItem('sso_accountId') || urlAccountId;

        // 2. Process SSO if we have the minimum required params
        if (autoLogin === 'true' && token && clientId) {
          try {
            console.log('Attempting SSO login with persistent credentials');
            const response = await authApi.ssoLogin(token, clientId, accountId || undefined) as any;

            if (response.success) {
              // 3. SUCCESS: Clear SSO params now that we have a session
              sessionStorage.removeItem('sso_autoLogin');
              sessionStorage.removeItem('sso_token');
              sessionStorage.removeItem('sso_clientId');
              sessionStorage.removeItem('sso_accountId');

              if (response.token) {
                apiClient.setToken(response.token);
                document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
              }

              if (response.user) {
                setUser(response.user);
              }

              const targetAccountId = response.mt5Account?.accountId || accountId;
              if (targetAccountId) {
                localStorage.setItem('accountId', targetAccountId.toString());
                localStorage.setItem('defaultMt5Account', targetAccountId.toString());
                sessionStorage.setItem('defaultMt5Account', targetAccountId.toString());
              }

              setIsLoading(false);
              return;
            } else {
              console.error('SSO login response unsuccessful:', response.message);
            }
          } catch (error) {
            console.error('SSO login failed in AuthProvider:', error);
          }
        } else if (autoLogin === 'true') {
          // If autoLogin is true but params are missing, clear them anyway to avoid loops
          sessionStorage.removeItem('sso_autoLogin');
          sessionStorage.removeItem('sso_token');
          sessionStorage.removeItem('sso_clientId');
          sessionStorage.removeItem('sso_accountId');
        }
      }

      // Standard token check if no autoLogin or if autoLogin failed
      const token = apiClient.getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await authApi.getCurrentUser() as any;
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        console.warn('Current user fetch failed, clearing token');
        apiClient.clearToken();
      }
    } catch (error: any) {
      console.error('CheckAuth error:', error);
      if (error.message && error.message.includes('Backend server is not reachable')) {
        // Keep user state if it's just a network error
      } else {
        apiClient.clearToken();
      }
    } finally {
      setIsLoading(false);
      checkAuthRef.current = false;
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password) as any;

    if (response.success && response.token) {
      apiClient.setToken(response.token);
      if (typeof document !== 'undefined') {
        document.cookie = `token=${response.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      if (response.user) {
        setUser(response.user);
      } else {
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
    apiClient.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('defaultMt5Account');
      localStorage.removeItem('accountId');
      document.cookie = 'token=; path=/; max-age=0';
    }
    setUser(null);
    try {
      authApi.logout().catch(() => { });
    } catch (error) { }
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

    if (diffMs <= 0) return null;

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
