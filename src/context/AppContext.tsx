import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, WalletState } from '../types';

interface AppContextType {
  user: User | null;
  walletState: WalletState | null;
  isLoading: boolean;
  error: Error | null;
  setUser: (user: User | null) => void;
  setWalletState: (state: WalletState | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Initialize from localStorage
    const savedUser = localStorage.getItem('zai_user');
    const savedWallet = localStorage.getItem('zai_wallet');

    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    } else {
      // For testing: create a mock user with all required properties
      const mockUser: any = {
        id: 'test-user-1',
        walletAddress: '0x1234567890123456789012345678901234567890',
        name: 'Anna Kirchner',
        firstName: 'Anna',
        lastName: 'Kirchner',
        tier: 'gold',
        email: 'anna@example.com',
        location: 'Pontresina, Switzerland',
        memberSince: new Date('2024-01-15'),
      };
      setUser(mockUser);
      localStorage.setItem('zai_user', JSON.stringify(mockUser));
    }

    if (savedWallet) {
      try {
        setWalletState(JSON.parse(savedWallet));
      } catch (e) {
        console.error('Failed to parse saved wallet:', e);
      }
    }

    setIsLoading(false);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        walletState,
        isLoading,
        error,
        setUser,
        setWalletState,
        setIsLoading,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};