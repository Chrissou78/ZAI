import React, { useState, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

export function WalletConnectButton() {
  const { user, setUser, setWalletState } = useAppContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutIframeRef = useRef<HTMLIFrameElement | null>(null);

  React.useEffect(() => {
    if (!showModal) return;

    const handleMessage = async (event: MessageEvent) => {
      if (!event.origin.includes('wallettwo.com')) return;

      const iframe = document.getElementById('wallettwo-auth-iframe') as HTMLIFrameElement;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const data = event.data;
      console.log('📨 WalletTwo message:', JSON.stringify(data, null, 2));

      // Extract fields flexibly
      const token = data.token || data.code || data.accessToken || data.access_token;
      const type = data.type || data.event || data.action;
      const wallet = data.wallet || data.address || data.walletAddress;
      const userId = data.user || data.userId || data.user_id || data.id || wallet;

      if (!token) {
        console.log('📨 No token in message, ignoring. Type:', type);
        return;
      }

      console.log('✅ WalletTwo session received');
      setIsLoading(true);

      try {
        const payload: Record<string, string> = { token, userId };
        if (wallet) payload.wallet = wallet;

        const response = await apiService.post('/auth/login', payload);

        if (response.data?.success && response.data?.jwtToken) {
          console.log('✅ Login successful');
          const jwtToken = response.data.jwtToken;
          setUser(response.data.user as any);
          setWalletState({
            isConnected: true,
            address: response.data.user?.wallet || response.data.user?.walletAddress || wallet,
            token: jwtToken,
            isLoading: false,
            error: null,
          });
          localStorage.setItem('zai_user', JSON.stringify(response.data.user));
          localStorage.setItem('zai_token', jwtToken);

          setShowModal(false);

          setTimeout(() => {
            setIsLoading(false);
            navigate('/dashboard');
          }, 500);
        }
      } catch (error: any) {
        console.error('❌ Login error:', error);
        console.error('❌ Response:', error?.response?.data);
        setIsLoading(false);
        alert('Login failed. Please try again.');
      }

      window.removeEventListener('message', handleMessage);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showModal, setUser, setWalletState, navigate]);

  if (user) {
    const initials = `${user.givenName?.[0] ?? ''}${user.familyName?.[0] ?? ''}`.toUpperCase();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
            border: '1px solid #555',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f5f4f0',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {initials}
        </div>
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 500, color: '#fff' }}>{user.givenName}</div>
        </div>
      </div>
    );
  }

  const companyId = import.meta.env.VITE_COMPANY_ID || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';

  const handleOpenModal = () => {
    // Clear local state
    localStorage.removeItem('zai_user');
    localStorage.removeItem('zai_token');
    localStorage.removeItem('zai_wallet');
    localStorage.removeItem('zai_wallet_state');
    Object.keys(localStorage)
      .filter(k => k.includes('wallettwo') || k.includes('wallet_two'))
      .forEach(k => localStorage.removeItem(k));

    // Step 1: Load a hidden logout iframe to kill the WalletTwo session
    setIsLoggingOut(true);

    // Create hidden logout iframe
    const logoutIframe = document.createElement('iframe');
    logoutIframe.src = `https://wallet.wallettwo.com/auth/logout?iframe=true&companyId=${companyId}&auto_accept=true&_t=${Date.now()}`;
    logoutIframe.style.display = 'none';
    logoutIframe.id = 'wallettwo-logout-iframe';
    document.body.appendChild(logoutIframe);

    // Listen for logout completion or timeout after 2s
    let logoutDone = false;

    const onLogoutMessage = (event: MessageEvent) => {
      if (!event.origin.includes('wallettwo.com')) return;
      const data = event.data;
      const type = data?.type || data?.event || data?.action;
      console.log('🔓 Logout iframe message:', type, data);

      if (type === 'wallet_logout' || type === 'logout' || type === 'logged_out' || type === 'session_ended') {
        logoutDone = true;
        cleanup();
        openLoginModal();
      }
    };

    const cleanup = () => {
      window.removeEventListener('message', onLogoutMessage);
      const el = document.getElementById('wallettwo-logout-iframe');
      if (el) el.remove();
      setIsLoggingOut(false);
    };

    window.addEventListener('message', onLogoutMessage);

    // Timeout: if logout doesn't respond in 2s, proceed anyway
    setTimeout(() => {
      if (!logoutDone) {
        console.log('🔓 Logout iframe timeout, proceeding with login');
        cleanup();
        openLoginModal();
      }
    }, 2000);
  };

  const openLoginModal = () => {
    setShowModal(true);
  };

  const iframeUrl = new URL('https://wallet.wallettwo.com/auth/login');
  iframeUrl.searchParams.append('action', 'session');
  iframeUrl.searchParams.append('iframe', 'true');
  iframeUrl.searchParams.append('companyId', companyId);
  iframeUrl.searchParams.append('prompt', 'login');
  iframeUrl.searchParams.append('force', 'true');
  iframeUrl.searchParams.append('new_session', 'true');
  iframeUrl.searchParams.append('_t', Date.now().toString());

  return (
    <>
      <button
        onClick={handleOpenModal}
        disabled={isLoggingOut}
        style={{
          background: '#7A222E',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          borderRadius: '4px',
          cursor: isLoggingOut ? 'wait' : 'pointer',
          transition: 'all 0.2s',
          opacity: isLoggingOut ? 0.7 : 1,
        }}
      >
        {isLoggingOut ? 'Preparing...' : 'Sign Up / Log In'}
      </button>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '420px',
              maxWidth: '92vw',
              height: '650px',
              maxHeight: '80vh',
              background: '#fff',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                zIndex: 10,
                color: '#333',
              }}
            >
              ✕
            </button>

            {isLoading && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255,255,255,0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  zIndex: 11,
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    border: '4px solid #e0e0e0',
                    borderTop: '4px solid #7A222E',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <p style={{ color: '#333', fontSize: '14px' }}>Authenticating...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <iframe
              src={iframeUrl.toString()}
              id="wallettwo-auth-iframe"
              style={{
                flex: 1,
                border: 'none',
                width: '100%',
                height: '100%',
              }}
              title="WalletTwo Authentication"
            />
          </div>
        </div>
      )}
    </>
  );
}
