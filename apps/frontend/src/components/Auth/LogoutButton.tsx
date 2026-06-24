import React, { useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';

export default function LogoutButton() {
  const { logout: sdkLogout } = useWalletTwo();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      // This creates a hidden iframe to wallet.wallettwo.com/action/logout
      // which destroys the session cookie on WalletTwo's domain
      await sdkLogout();
    } catch (err) {
      console.warn('SDK logout timed out or failed:', err);
    }

    // Clear all local state regardless
    localStorage.removeItem('zai_user');
    localStorage.removeItem('zai_token');
    localStorage.removeItem('zai_wallet');
    localStorage.removeItem('wallettwo_token');
    
    // Clear everything wallettwo-related
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('wallettwo')) localStorage.removeItem(key);
    });
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('wallettwo')) sessionStorage.removeItem(key);
    });

    // Force full page reload to reset all Zustand stores
    window.location.href = '/';
  };

  return (
    <button onClick={handleLogout} disabled={loggingOut}>
      {loggingOut ? 'Logging out...' : 'Logout'}
    </button>
  );
}
