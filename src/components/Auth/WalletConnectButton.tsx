import React from 'react';
import { AuthAction, useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import { User } from '../../types';

export function WalletConnectButton() {
  const { user: walletUser, token } = useWalletTwo();
  const { user, setUser, setWalletState } = useAppContext();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAuth = React.useCallback(
    async (accessToken: string) => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch user profile from backend
        const response = await apiService.post<User>(
          '/auth/login',
          {
            walletAddress: walletUser?.id,
            token: accessToken,
          },
          accessToken
        );

        if (response.success && response.data) {
          setUser(response.data);
          setWalletState({
            isConnected: true,
            address: walletUser?.id || null,
            token: accessToken,
            chainId: '137',
            isLoading: false,
            error: null,
          });
        } else {
          setError(response.error || 'Authentication failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    },
    [walletUser, setUser, setWalletState]
  );

  if (user && walletUser) {
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
          {user.firstName[0]}{user.lastName[0]}
        </div>
        <div style={{ fontSize: '12px' }}>
          <div style={{ fontWeight: 500 }}>{user.firstName}</div>
          <div style={{ color: '#b8a06a', fontSize: '10px' }}>{user.tier}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <AuthAction onAuth={handleAuth} autoAccept={false} />
      {error && (
        <div style={{ color: '#c8102e', fontSize: '12px', marginTop: '8px' }}>
          {error}
        </div>
      )}
      {isLoading && (
        <div style={{ color: '#b8a06a', fontSize: '12px', marginTop: '8px' }}>
          Loading...
        </div>
      )}
    </div>
  );
}
