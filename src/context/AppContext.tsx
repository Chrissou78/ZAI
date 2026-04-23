import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { User, WalletState } from '../types';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  walletState: WalletState;
  setWalletState: (state: WalletState) => void;
  isLoading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = React.useState<User | null>(() => {
    const stored = localStorage.getItem('zai_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [walletState, setWalletStateInternal] = React.useState<WalletState>({
    isConnected: false,
    address: null,
    token: null,
    chainId: '137',
    isLoading: false,
    error: null,
  });

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setUser = useCallback((newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem('zai_user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('zai_user');
    }
  }, []);

  const setWalletState = useCallback((state: WalletState) => {
    setWalletStateInternal(state);
    localStorage.setItem('zai_wallet_state', JSON.stringify(state));
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        walletState,
        setWalletState,
        isLoading,
        error,
        setError,
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
