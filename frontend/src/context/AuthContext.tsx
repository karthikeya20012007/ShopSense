import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse } from '../types';
import { apiClient, setAccessToken, registerAuthFailureHandler } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = async (): Promise<User | null> => {
    try {
      const res = await apiClient.get<User>('/auth/me');
      setUser(res.data);
      return res.data;
    } catch {
      setUser(null);
      setAccessToken(null);
      return null;
    }
  };

  // Attempt silent session initialization on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const refreshRes = await apiClient.post<AuthResponse>('/auth/refresh', {});
        setAccessToken(refreshRes.data.access_token);
        setUser(refreshRes.data.user);
      } catch {
        // No existing session or session expired
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    registerAuthFailureHandler(() => {
      setUser(null);
    });

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    setAccessToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
