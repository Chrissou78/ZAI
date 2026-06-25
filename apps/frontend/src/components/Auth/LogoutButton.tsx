import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export function LogoutButton() {
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const companyId = import.meta.env?.VITE_COMPANY_ID || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';

    // ── Kill WalletTwo session via popup window ──
    try {
      await new Promise<void>((resolve) => {
        const logoutUrl = `https://wallet.wallettwo.com/auth/login?action=logout&iframe=true&auto_accept=true&companyId=${companyId}&_t=${Date.now()}`;
        const popup = window.open(logoutUrl, 'wallettwo_logout', 'width=1,height=1,left=-100,top=-100');

        const onMessage = (event: MessageEvent) => {
          if (event.origin !== 'https://wallet.wallettwo.com') return;
          console.log('🔓 Logout message:', event.data);
          if (event.data?.type === 'wallet_logout') {
            cleanup();
            resolve();
          }
        };

        const cleanup = () => {
          clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          try { if (popup && !popup.closed) popup.close(); } catch (e) {}
        };

        window.addEventListener('message', onMessage);

        const timeout = setTimeout(() => {
          cleanup();
          resolve();
        }, 5000);
      });
    } catch (err) {
      console.warn('WalletTwo logout failed:', err);
    }

    // Clear ALL localStorage keys
    const keysToRemove = [
      'zai_user',
      'zai_token',
      'token',
      'zai_wallet',
      'zai_wallet_state',
      'zai_experience_card',
    ];
    keysToRemove.forEach((k) => localStorage.removeItem(k));

    Object.keys(localStorage)
      .filter(k => k.includes('wallettwo') || k.includes('wallet_two'))
      .forEach(k => localStorage.removeItem(k));

    sessionStorage.clear();

    // Clear React state
    setUser(null);
    setWalletState({
      isConnected: false,
      address: undefined,
      token: null,
      isLoading: false,
      error: null,
    });

    setIsLoading(false);

    // Navigate without page reload
    navigate('/');
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
