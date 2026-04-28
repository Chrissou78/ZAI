import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export function LogoutButton() {
  const { logout } = useWalletTwo();
  const { setUser, setWalletState } = useAppContext();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      setUser(null);
      setWalletState({ isConnected: false, address: undefined, token: null, isLoading: false, error: null });
      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');
      sessionStorage.clear();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button onClick={handleLogout} disabled={isLoading} style={{ width: '100%', padding: '0.75rem 1rem', background: '#c8102e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 500, cursor: isLoading ? 'not-allowed' : 'pointer' }}>
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
