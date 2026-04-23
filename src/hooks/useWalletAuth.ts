import { useCallback, useEffect, useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { WalletState } from '../types';
import { useAppContext } from '../context/AppContext';

export function useWalletAuth() {
  const { user, token, signMessage, logout: walletLogout } = useWalletTwo();
  const { setUser, setWalletState } = useAppContext();
  const [walletState, setLocalWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    token: null,
    chainId: '137', // Default to Polygon
    isLoading: false,
    error: null,
  });

  // Update wallet state when Wallettwo user changes
  useEffect(() => {
    if (user && token) {
      setLocalWalletState({
        isConnected: true,
        address: user.id,
        token,
        chainId: '137',
        isLoading: false,
        error: null,
      });
      setWalletState({
        isConnected: true,
        address: user.id,
        token,
        chainId: '137',
        isLoading: false,
        error: null,
      });
    } else {
      setLocalWalletState({
        isConnected: false,
        address: null,
        token: null,
        chainId: '137',
        isLoading: false,
        error: null,
      });
    }
  }, [user, token, setWalletState]);

  const signOwnershipProof = useCallback(
    async (userId: string): Promise<string> => {
      try {
        const message = `Verify ZAI ownership - ${userId} - ${Date.now()}`;
        const signature = await signMessage(message);
        return signature;
      } catch (error) {
        setLocalWalletState((prev) => ({
          ...prev,
          error: 'Failed to sign message. Please try again.',
        }));
        throw error;
      }
    },
    [signMessage]
  );

  const logout = useCallback(async () => {
    try {
      setLocalWalletState((prev) => ({ ...prev, isLoading: true }));
      await walletLogout();
      setLocalWalletState({
        isConnected: false,
        address: null,
        token: null,
        chainId: '137',
        isLoading: false,
        error: null,
      });
      setUser(null);
    } catch (error) {
      setLocalWalletState((prev) => ({
        ...prev,
        error: 'Logout failed',
        isLoading: false,
      }));
    }
  }, [walletLogout, setUser]);

  return {
    ...walletState,
    signOwnershipProof,
    logout,
    isAuthenticated: walletState.isConnected && !!walletState.token,
  };
}
