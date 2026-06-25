import React, { useState, useRef } from 'react';
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
      if (!event.origin.includes('wallettwo.com')) return;

      const iframe = document.getElementById('wallettwo-auth-iframe') as HTMLIFrameElement;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const data = event.data;
      console.log('📨 WalletTwo message:', JSON.stringify(data, null, 2));

      const type = data.type || data.event || data.action;

      // Auth flow steps — iframe is showing a form, keep waiting
      if (['login_required', 'pin_required', 'register_required',
           'email_verification_required', 'wallet_required'].includes(type)) {
        console.log('📨 Auth step:', type, '— waiting for completion');
        return;
      }

      const token = data.token || data.code || data.accessToken || data.access_token;
      const wallet = data.wallet || data.address || data.walletAddress;
      const userId = data.user || data.userId || data.user_id || data.id || wallet;

      if (!token) {
        console.log('📨 No token in message, ignoring. Type:', type);
        return;
      }

      console.log('✅ WalletTwo session received');
      window.removeEventListener('message', handleMessage);
      await processLogin(token, userId, wallet);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showModal]);

  const processLogin = async (token: string, userId: string, wallet?: string) => {
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
        setIsLoading(false);
        navigate('/dashboard');
      } else {
        setIsLoading(false);
        alert('Login failed. Please try again.');
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      console.error('❌ Response:', error?.response?.data);
      setIsLoading(false);
      alert('Login failed. Please try again.');
    }
  };

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
    setShowModal(true);
  };

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
