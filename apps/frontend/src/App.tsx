import React from 'react';
import { AppProvider } from './context/AppContext';
import { WalletProvider } from './context/WalletContext';
import Router from './Router';
import { MintDebugPanel } from './components/MintDebugPanel';
import './styles/globals.css';

export function App() {
  return (
    <AppProvider>
      <WalletProvider>
        <Router />
        <MintDebugPanel />
      </WalletProvider>
    </AppProvider>
  );
}

export default App;