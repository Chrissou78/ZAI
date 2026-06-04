import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import { useState } from 'react';

export function LogoutButton() {
  const { logout: sdkLogout } = useWalletTwo();
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    // 1. Best-effort SDK logout — never let it block
    try {
      await sdkLogout();
    } catch (error) {
      console.warn('WalletTwo SDK logout failed (continuing):', error);
    }

    // 2. Clear ALL localStorage keys in one shot before any state changes
    const keysToRemove = [
      'zai_user',
      'zai_token',
      'token',
      'zai_wallet',
      'zai_wallet_state',
      'zai_experience_card',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();

    // 3. Clear React state (won't matter much since we're about to reload)
    setUser(null);
    setWalletState({
      isConnected: false,
      address: undefined,
      token: null,
      isLoading: false,
      error: null,
    });

    // 4. Small tick to ensure storage is flushed before the reload
    setTimeout(() => {
      window.location.href = '/';
    }, 50);
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      style={{
        width: '100%',
        padding: '0.75rem 1rem',
        background: '#7D1E2C',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: isLoading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        opacity: isLoading ? 0.6 : 1,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          (e.currentTarget as HTMLButtonElement).style.background = '#5a1620';
        }
      }}
      onMouseLeave={(e) => {
        if (!isLoading) {
          (e.currentTarget as HTMLButtonElement).style.background = '#7D1E2C';
        }
      }}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
