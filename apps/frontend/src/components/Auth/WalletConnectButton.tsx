import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../../services/api';

export function WalletConnectButton() {
  const { user, setUser, setWalletState } = useAppContext();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!showModal) return;

    const handleMessage = async (event: MessageEvent) => {
      // Log EVERYTHING from wallettwo origin
      if (event.origin.includes('wallettwo')) {
        console.log('📨 [DEBUG] origin:', event.origin);
        console.log('📨 [DEBUG] full data:', JSON.stringify(event.data, null, 2));
        console.log('📨 [DEBUG] data type:', typeof event.data);
        if (event.data && typeof event.data === 'object') {
          console.log('📨 [DEBUG] keys:', Object.keys(event.data));
        }
      }

      if (event.origin !== 'https://wallet.wallettwo.com') return;

      const iframe = document.getElementById('wallettwo-auth-iframe') as HTMLIFrameElement;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const data = event.data;
      console.log('📨 [DEBUG] Passed source check. Data:', JSON.stringify(data, null, 2));

      // Try to extract token from ANY field name
      const token = data.token || data.code || data.accessToken || data.access_token || data.session_token || data.sessionToken;
      const type = data.type || data.event || data.action || data.message;
      const wallet = data.wallet || data.address || data.walletAddress || data.wallet_address;
      const userId = data.user || data.userId || data.user_id || data.id || wallet;

      console.log('📨 [DEBUG] Extracted:', { type, hasToken: !!token, wallet, userId });

      if (!token) {
        console.log('📨 [DEBUG] No token found in message, ignoring');
        return;
      }

      console.log('✅ WalletTwo session received');
      setIsLoading(true);

      try {
        console.log('📤 Sending to backend:', { token: '***' + String(token).slice(-8), userId, wallet });

        const response = await apiService.post('/auth/login', {
          token,
          userId,
          wallet,
        });

        if (response.data?.success && response.data?.jwtToken) {
          console.log('✅ Login successful');
          const jwtToken = response.data.jwtToken;
          setUser(response.data.user as any);
          setWalletState({
            isConnected: true,
            address: wallet,
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
        {/* Avatar — no gold, dark bg with white text */}
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
          {/* Role label removed */}
        </div>
      </div>
    );
  }

  const handleOpenModal = () => {
    document.cookie = 'wallettwo_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.wallettwo.com;';
    document.cookie = 'wallettwo_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.wallettwo.com;';
    
    const keysToRemove = Object.keys(localStorage).filter(k => k.includes('wallettwo') || k.includes('wallet_two'));
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    setShowModal(true);
  };

  const companyId = import.meta.env.VITE_COMPANY_ID || 'p7IH5cVirHbWy1a0hPxeKro5j9bRSJtt';
  const iframeUrl = new URL('https://wallet.wallettwo.com/auth/login');
  iframeUrl.searchParams.append('action', 'session');
  iframeUrl.searchParams.append('iframe', 'true');
  iframeUrl.searchParams.append('companyId', companyId);
  iframeUrl.searchParams.append('_t', Date.now().toString());

  return (
    <>
      <button
        onClick={handleOpenModal}
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
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        Sign Up / Log In
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
                {/* Spinner — gold replaced with red */}
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
