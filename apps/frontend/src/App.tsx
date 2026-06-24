// apps/frontend/src/App.tsx
import React from 'react';
import { WalletTwoProvider } from '@oc-labs/wallettwo-sdk';
import { AppProvider } from './context/AppContext';
import { WalletProvider } from './context/WalletContext';
import Router from './Router';

function App() {
  return (
    <AppProvider>
      <WalletTwoProvider companyId="p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt">
        <WalletProvider>
          <Router />
        </WalletProvider>
      </WalletTwoProvider>
    </AppProvider>
  );
}

export default App;
