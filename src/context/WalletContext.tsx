import React, { createContext, useContext, ReactNode } from 'react';
import { WalletState } from '../types';

interface WalletContextType {
  wallet: WalletState;
  setWalletState: (state: WalletState) => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = React.useState<WalletState>({
    isConnected: false,
    address: null,
    token: null,
    chainId: '137',
    isLoading: false,
    error: null,
  });

  const setWalletState = (state: WalletState) => {
    setWallet(state);
    // Persist to localStorage
    localStorage.setItem('zai_wallet_state', JSON.stringify(state));
  };

  return (
    <WalletContext.Provider value={{ wallet, setWalletState }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletContext must be used within WalletProvider');
  }
  return context;
}
