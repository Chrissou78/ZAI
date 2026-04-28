import React, { useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import Button from '../Common/Button';

export function LogoutButton() {
  const { logout: appLogout } = useAppContext();
  const { logout: walletLogout } = useWalletTwo();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleLogout = async () => {
    try {
      setIsDisconnecting(true);
      
      // Step 1: Disconnect from WalletTwo
      if (walletLogout) {
        await walletLogout();
      }
      
      // Step 2: Clear app state and localStorage
      await appLogout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if error occurs
      window.location.href = '/';
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isDisconnecting}
      variant="secondary"
      size="sm"
    >
      {isDisconnecting ? 'Disconnecting...' : 'Logout'}
    </Button>
  );
}
