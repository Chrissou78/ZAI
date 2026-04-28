import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const WalletTwoModal: React.FC<{ isOpen: boolean; onClose: () => void; companyId: string }> = ({
  isOpen,
  onClose,
  companyId,
}) => {
  const navigate = useNavigate();
  const { setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      if (!event.origin.includes('wallettwo.com')) return;

      const data = event.data;
      console.log('📨 Message from WalletTwo:', data);

      const isLoginEvent = data && (
        data.event === 'wallet_login' ||
        data.type === 'wallet_login' ||
        data.event === 'wallet_session' ||
        data.type === 'wallet_session'
      );

      if (isLoginEvent && data.code) {
        setIsLoading(true);
        const userData = {
          id: data.wallet || data.address,
          walletAddress: data.wallet || data.address,
          firstName: 'User',
          lastName: '',
          email: '',
          tier: 'member',
        };

        setUser(userData as any);
        setWalletState({
          isConnected: true,
          address: data.wallet || data.address,
          token: data.code,
          isLoading: false,
          error: null,
        });

        localStorage.setItem('zai_user', JSON.stringify(userData));
        localStorage.setItem('zai_token', data.code);

        setTimeout(() => {
          setIsLoading(false);
          onClose();
          navigate('/dashboard');
        }, 500);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, setUser, setWalletState, onClose, navigate]);

  if (!isOpen) return null;

  const iframeUrl = `https://wallet.wallettwo.com/auth/login?action=session&iframe=true&companyId=${companyId}&_t=${Date.now()}`;

  console.log('🔗 Iframe URL:', iframeUrl);
  return (
    <div
      onClick={onClose}
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
          onClick={onClose}
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
          onLoad={() => console.log('✅ Iframe loaded')}
          onError={() => console.error('❌ Iframe failed to load')}
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
  );
};

export default WalletTwoModal;
