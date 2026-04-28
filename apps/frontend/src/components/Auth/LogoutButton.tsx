import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export function LogoutButton() {
  const { setUser, setWalletState } = useAppContext();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      // Show logout iframe
      const companyId = import.meta.env.VITE_COMPANY_ID || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';
      const logoutUrl = new URL('https://wallet.wallettwo.com/auth/login');
      logoutUrl.searchParams.append('action', 'logout');
      logoutUrl.searchParams.append('iframe', 'true');
      logoutUrl.searchParams.append('companyId', companyId);
      logoutUrl.searchParams.append('auto_accept', 'true');

      // Create hidden iframe for logout
      const iframe = document.createElement('iframe');
      iframe.src = logoutUrl.toString();
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      // Wait for logout event
      const handleLogoutMessage = (event: MessageEvent) => {
        if (event.origin !== 'https://wallet.wallettwo.com') return;
        if (event.data.type !== 'wallet_logout') return;

        console.log('✅ WalletTwo logout confirmed');

        // Clear app state
        setUser(null);
        setWalletState({
          isConnected: false,
          address: undefined,
          token: null,
          isLoading: false,
          error: null,
        });

        // Clear localStorage
        localStorage.removeItem('zai_user');
        localStorage.removeItem('zai_token');

        // Remove iframe
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }

        window.removeEventListener('message', handleLogoutMessage);

        // Redirect to home
        setTimeout(() => {
          setIsLoading(false);
          navigate('/');
        }, 5);
      };

      window.addEventListener('message', handleLogoutMessage);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleLogoutMessage);
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        setUser(null);
        setWalletState({
          isConnected: false,
          address: undefined,
          token: null,
          isLoading: false,
          error: null,
        });
        localStorage.removeItem('zai_user');
        localStorage.removeItem('zai_token');
        setIsLoading(false);
        navigate('/');
      }, 5000);
    } catch (error) {
      console.error('❌ Logout error:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      style={{
        background: '#c8102e',
        color: '#fff',
        border: 'none',
        padding: '10px 20px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        borderRadius: '4px',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        opacity: isLoading ? 0.6 : 1,
        transition: 'all 0.2s',
        width: '100%',
      }}
    >
      {isLoading ? 'Logging out...' : 'Logout'}
    </button>
  );
}
