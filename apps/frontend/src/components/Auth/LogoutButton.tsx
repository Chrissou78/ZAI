import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export function LogoutButton() {
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    const companyId = import.meta.env?.VITE_COMPANY_ID || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';

    // 1. Load hidden logout iframe to kill WalletTwo session
    const logoutIframe = document.createElement('iframe');
    logoutIframe.src = `https://wallet.wallettwo.com/auth/logout?iframe=true&companyId=${companyId}&auto_accept=true&_t=${Date.now()}`;
    logoutIframe.style.display = 'none';
    logoutIframe.id = 'wallettwo-logout-iframe';
    document.body.appendChild(logoutIframe);

    // 2. Wait briefly for iframe to process, then clean up regardless
    await new Promise(resolve => setTimeout(resolve, 1500));

    const el = document.getElementById('wallettwo-logout-iframe');
    if (el) el.remove();

    // 3. Clear ALL local storage
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

    // 4. Clear React state
    setUser(null);
    setWalletState({
      isConnected: false,
      address: undefined,
      token: null,
      isLoading: false,
      error: null,
    });

    // 5. Redirect
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
