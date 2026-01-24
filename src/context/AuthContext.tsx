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
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
      const token = apiClient.getToken();
      if (!token) {
        console.log('[AuthContext] No token found, user is not authenticated');
        setIsLoading(false);
        return;
      }

      console.log('[AuthContext] Checking authentication with token...');
      const response = await authApi.getCurrentUser();
      if (response.success && response.user) {
        console.log('[AuthContext] Authentication successful, user:', response.user.email);
        setUser(response.user);
      } else {
        console.warn('[AuthContext] Authentication failed, clearing token');
        apiClient.clearToken();
      }
    } catch (error: any) {
      console.error('[AuthContext] Auth check failed:', error);
      // Don't clear token on network errors - might just be backend not running
      if (error.message && error.message.includes('Backend server is not reachable')) {
        console.warn('[AuthContext] Backend server not reachable - this is expected if server is not running');
      } else {
        apiClient.clearToken();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    
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
    const response = await authApi.register(email, password, name, phone);
    
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
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      apiClient.clearToken();
      // Clear cookie
      if (typeof document !== 'undefined') {
        document.cookie = 'token=; path=/; max-age=0';
      }
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      if (response.success && response.user) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      setUser(null);
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
