import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/services/api';
import type { ZaiUser } from '@zai/shared';

interface AuthState {
  user: ZaiUser | null;
  isLoading: boolean;
  hasExperienceCard: boolean;
  isAdmin: boolean;
  login: (token: string, user: ZaiUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshExperienceCard: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<ZaiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasExperienceCard, setHasExperienceCard] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  // ── Restore session on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedEc] = await Promise.all([
          apiService.getUser(),
          apiService.getExperienceCard(),
        ]);
        const token = await apiService.getToken();
        if (savedUser && token) {
          setUser(savedUser);
          setHasExperienceCard(!!savedEc);
        }
      } catch {
        // corrupted storage — clear
        await apiService.clearAuth();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (token: string, userData: ZaiUser) => {
    await apiService.setToken(token);
    await apiService.setUser(userData);
    setUser(userData);
    // Fetch experience card status immediately
    await refreshExperienceCard(userData);
  };

  const logout = async () => {
    await apiService.clearAuth();
    setUser(null);
    setHasExperienceCard(false);
  };

  const refreshExperienceCard = async (u?: ZaiUser) => {
    const target = u || user;
    if (!target?.id) return;
    try {
      const res = await apiService.get(`/products/user/${target.id}`);
      if (res.data?.success) {
        const ecCard = res.data.experienceCard || null;
        await apiService.setExperienceCard(ecCard);
        setHasExperienceCard(!!ecCard);
      }
    } catch {
      // non-fatal
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, hasExperienceCard, isAdmin, login, logout, refreshExperienceCard }}>
      {children}
    </AuthContext.Provider>
  );
};
