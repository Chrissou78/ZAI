import React, { useState } from 'react';
import { AuthAction, useWalletTwo } from '@oc-labs/wallettwo-sdk';

export default function WalletConnectButton() {
  const [showAuth, setShowAuth] = useState(false);
  const { user, token } = useWalletTwo();

  const handleAuth = async (authData: any) => {
    // authData contains the authenticated user info
    // The SDK already set the token in its Zustand store
    console.log('Auth success:', authData);
    
    // Save to your app's local storage if needed
    if (token) {
      localStorage.setItem('zai_token', token);
    }
    
    setShowAuth(false);
    
    // Optionally call your backend to register/sync the user
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
              style={{ position: 'absolute', top: 8, right: 12, fontSize: 20 }}
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
