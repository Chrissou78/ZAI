import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, WalletState } from '../types';
import i18n, { mapToSupportedLanguage } from '../i18n';

interface AppContextType {
  user: User | null;
  walletState: WalletState;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setWalletState: (state: WalletState) => void;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Read the persisted session synchronously.
 *
 * This used to happen in a mount effect, which meant the FIRST render always
 * had user === null while isLoading was already false — so ProtectedRoute
 * redirected before the session was restored. Hard-loading /dashboard bounced
 * to /, and worse, the transient mount at the requested path auto-completed
 * that path's onboarding step: hard-loading /profile silently ticked
 * "Complete your profile" (withdrawing the welcome gift) without the member
 * ever seeing the page. Resolving it during initial state removes the
 * null-first-render entirely.
 */
function readStoredSession(): { user: User | null; token: string | null } {
  try {
    const storedUser = localStorage.getItem('zai_user');
    const storedToken = localStorage.getItem('zai_token');
    if (storedUser && storedToken) {
      return { user: JSON.parse(storedUser) as User, token: storedToken };
    }
  } catch {
    // Malformed payload — drop it so we don't retry parsing it every load.
    try {
      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');
    } catch { /* storage unavailable */ }
  }
  return { user: null, token: null };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const stored = readStoredSession();
  const [user, setUser] = useState<User | null>(stored.user);
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: !!stored.token,
    address: undefined,
    token: stored.token,
    isLoading: false,
    error: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the active i18n language in sync with the logged-in user's saved preference
  useEffect(() => {
    if (user?.language) {
      const mapped = mapToSupportedLanguage(user.language);
      if (i18n.language !== mapped) {
        i18n.changeLanguage(mapped);
      }
    }
  }, [user?.language]);

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Clear localStorage
      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');
      localStorage.removeItem('zai_wallet');

      // Reset state
      setUser(null);
      setWalletState({
        isConnected: false,
        address: undefined,
        token: null,
        isLoading: false,
        error: null,
      });

      // Redirect to home
      window.location.href = '/';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        user,
        walletState,
        isLoading,
        error,
        setUser,
        setWalletState,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
