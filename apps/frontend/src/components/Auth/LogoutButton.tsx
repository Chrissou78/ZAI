import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import { useState } from 'react';

export function LogoutButton() {
  const { logout } = useWalletTwo();
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    // Best-effort SDK logout, but never let it block clearing the session.
    try {
      await logout();
    } catch (error) {
      console.warn('WalletTwo SDK logout failed (continuing):', error);
    }
    // Always clear local session.
    setUser(null);
    setWalletState({ isConnected: false, address: undefined, token: null, isLoading: false, error: null });
    localStorage.removeItem('zai_user');
    localStorage.removeItem('zai_token');
    localStorage.removeItem('token');
    localStorage.removeItem('zai_wallet_state');
    localStorage.removeItem('zai_experience_card');
    sessionStorage.clear();
    window.location.href = '/';
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