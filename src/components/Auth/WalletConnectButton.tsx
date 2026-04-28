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

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('wallettwo.com')) return;

      const data = event.data;
      console.log('🔔 WalletTwo message:', data);

      const isLoginEvent = data && (
        data.event === 'wallet_login' ||
        data.type === 'wallet_login' ||
        data.event === 'wallet_session' ||
        data.type === 'wallet_session'
      );

      if (isLoginEvent && (data.code || data.token)) {
        console.log('✅ Login successful');
        setIsLoading(true);

        const token = data.code || data.token;
        const wallet = data.wallet || data.address || data.wlt;
        const userId = data.user;

        loginWithBackend(token, wallet, userId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [showModal, setUser, setWalletState, navigate]);

  const loginWithBackend = async (walletToken: string, wallet: string, userId: string) => {
    try {
      console.log('📤 Calling backend login...');

      const response = await apiService.post('/auth/login', {
        token: walletToken,
        wallet,
        userId,
      });

      console.log('📥 Backend response:', response.data);

      if (response.data?.success && response.data?.jwtToken) {
        const jwtToken = response.data.jwtToken;
        const userData = response.data.user;

        console.log('✅ Setting user data:', userData);

        setUser(userData as any);
        setWalletState({
          isConnected: true,
          address: wallet,
          token: jwtToken,
          isLoading: false,
          error: null,
        });

        localStorage.setItem('zai_user', JSON.stringify(userData));
        localStorage.setItem('zai_token', jwtToken);

        // Redirect to dashboard with complete user data
        setTimeout(() => {
          setIsLoading(false);
          setShowModal(false);
          navigate('/dashboard');
        }, 500);
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      console.error('❌ Backend login error:', error);
      alert('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (user) {
    const firstName = user.firstName || 'U';
    const lastName = user.lastName || '';
    const initials = `${firstName[0]}${lastName[0] || ''}`.toUpperCase();

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #b8a06a, #8a7045)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {initials}
        </div>
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 500 }}>{firstName}</div>
          <div style={{ color: '#b8a06a', fontSize: '10px' }}>{user.tier || 'member'}</div>
        </div>
      </div>
    );
  }

  const companyId = import.meta.env.VITE_COMPANY_ID || 'zai';
  const iframeUrl = `https://wallet.wallettwo.com/auth/login?action=session&iframe=true&companyId=${companyId}&_t=${Date.now()}`;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
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
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#a0071f';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#c8102e';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        }}
      >
        Log In
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
              width: '90vw',
              maxWidth: '900px',
              height: '90vh',
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
                    borderTop: '4px solid #b8a06a',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <p style={{ color: '#333', fontSize: '14px' }}>Authenticating...</p>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            <iframe
              src={iframeUrl}
              style={{
                flex: 1,
                border: 'none',
                width: '100%',
                height: '100%',
              }}
              title="WalletTwo Authentication"
              allow="clipboard-write"
            />
          </div>
        </div>
      )}
    </>
  );
}
