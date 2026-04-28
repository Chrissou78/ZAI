import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, WalletState } from '../types';

interface AppContextType {
  user: User | null;
  walletState: WalletState;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setWalletState: (state: WalletState) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: undefined,
    token: null,
    isLoading: false,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load persisted user on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('zai_user');
    const storedToken = localStorage.getItem('zai_token');
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setWalletState((prev) => ({ ...prev, isConnected: true, token: storedToken }));
      } catch {
        localStorage.removeItem('zai_user');
        localStorage.removeItem('zai_token');
      }
    }
  }, []);

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear localStorage
      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');
      localStorage.removeItem('zai_wallet');

      // Reset state
      setUser(null);
      setWalletState({
        isConnected: false,
        address: undefined,
        token: null,
        isLoading: false,
        error: null,
      });

      // Redirect to home
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        walletState,
        isLoading,
        error,
        setUser,
        setWalletState,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
