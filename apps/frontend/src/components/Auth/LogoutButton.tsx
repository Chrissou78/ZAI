import { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export function LogoutButton() {
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    if (isLoading) return;
    setIsLoading(true);

    // ── Kill WalletTwo session cookie via off-screen iframe ──
    try {
      await new Promise<void>((resolve) => {
        const iframe = document.createElement('iframe');
        // NOT display:none — that prevents JS execution in Safari
        iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:400px;height:600px;opacity:0;pointer-events:none;';
        iframe.id = 'wallettwo-logout-iframe';
        iframe.src =
          'https://wallet.wallettwo.com/auth/login?action=logout&iframe=true&auto_accept=true&companyId=p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt&_t=' + Date.now();
        document.body.appendChild(iframe);

        const timeout = setTimeout(() => {
          cleanup();
          resolve();
        }, 6000);

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
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        };

        window.addEventListener('message', onMessage);
      });
    } catch (err) {
      console.warn('WalletTwo logout iframe failed:', err);
    }

    // 1. Clear ALL localStorage keys
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

    // 2. Clear React state
    setUser(null);
    setWalletState({
      isConnected: false,
      address: undefined,
      token: null,
      isLoading: false,
      error: null,
    });

    // 3. Redirect
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
