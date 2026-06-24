// apps/frontend/src/components/Auth/WalletConnectButton.tsx
import React, { useState } from 'react';
import { AuthAction, useWalletTwo } from '@oc-labs/wallettwo-sdk';

export function WalletConnectButton() {
  const [showAuth, setShowAuth] = useState(false);
  const { user, token } = useWalletTwo();

  const handleAuth = async (authData: any) => {
    console.log('Auth success:', authData);

    if (token) {
      localStorage.setItem('zai_token', token);
    }

    setShowAuth(false);

    // Sync with your backend
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.user) {
        localStorage.setItem('zai_user', JSON.stringify(data.user));
      }
    } catch (err) {
      console.error('Backend sync failed:', err);
    }
  };

  if (user) {
    return <div>Connected</div>;
  }

  return (
    <>
      <button onClick={() => setShowAuth(true)}>
        Connect Wallet
      </button>

      {showAuth && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#fff', borderRadius: 12,
            width: '90vw', maxWidth: 450, maxHeight: '90vh',
            overflow: 'auto', position: 'relative'
          }}>
            <button
              onClick={() => setShowAuth(false)}
              style={{ position: 'absolute', top: 8, right: 12, fontSize: 20, zIndex: 1 }}
            >
              ✕
            </button>
            <AuthAction onAuth={handleAuth} />
          </div>
        </div>
      )}
    </>
  );
}
