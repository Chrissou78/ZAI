import React from 'react';
import { WalletTwoProvider } from '@oc-labs/wallettwo-sdk';
import { AppProvider } from './context/AppContext';
import { WalletProvider } from './context/WalletContext';
import Router from './Router';
import './styles/globals.css';

export function App() {
  return (
    <WalletTwoProvider companyId={import.meta.env.VITE_COMPANY_ID || 'zai'}>
      <AppProvider>
        <WalletProvider>
          <Router />
        </WalletProvider>
      </AppProvider>
    </WalletTwoProvider>
  );
}

export default App;
