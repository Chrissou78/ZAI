import { useCallback, useEffect, useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { WalletState } from '../types';
import { useAppContext } from '../context/AppContext';

export function useWalletAuth() {
  const { user, token, signMessage, logout: walletLogout } = useWalletTwo();
  const { setUser, setWalletState } = useAppContext();
  const [walletState, setLocalWalletState] = useState<WalletState>({
    isConnected: false,
    address: undefined,
    token: null,
    isLoading: false,
    error: null,
  });

  // Update wallet state when Wallettwo user changes
  useEffect(() => {
    if (user && token) {
      const newState: WalletState = {
        isConnected: true,
        address: user.id,
        token,
        isLoading: false,
        error: null,
      };
      setLocalWalletState(newState);
      setWalletState?.(newState);
    } else {
      const newState: WalletState = {
        isConnected: false,
        address: undefined,
        token: null,
        isLoading: false,
        error: null,
      };
      setLocalWalletState(newState);
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
          error: error instanceof Error ? error.message : 'Failed to sign message',
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
      const newState: WalletState = {
        isConnected: false,
        address: undefined,
        token: null,
        isLoading: false,
        error: null,
      };
      setLocalWalletState(newState);
      setUser?.(null);
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