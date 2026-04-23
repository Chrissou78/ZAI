declare module '@oc-labs/wallettwo-sdk' {
  import React from 'react';

  export interface WalletTwoUser {
    id: string;
    email?: string;
    address: string;
    verified: boolean;
  }

  export interface WalletTwoContextType {
    user: WalletTwoUser | null;
    token: string | null;
    isLoading: boolean;
    error: Error | null;
  }

  export interface AuthActionProps {
    onAuth?: (token: string, user: WalletTwoUser) => void;
    onError?: (error: Error) => void;
    autoAccept?: boolean;
    companyId?: string;
  }

  export interface TransactionActionProps {
    transactions: Array<{
      method: string;
      address: string;
      params?: any[];
      abi?: any[];
    }>;
    network?: string;
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
    onCancel?: () => void;
    onExecuting?: (isExecuting: boolean) => void;
  }

  export interface SignatureActionProps {
    message: string;
    onSignature?: (signature: string) => void;
    onError?: (error: Error) => void;
    autoAccept?: boolean;
  }

  export interface LogoutActionProps {
    onLogout?: () => void;
    autoAccept?: boolean;
  }

  export interface RampActionProps {
    onSuccess?: (result: any) => void;
    onError?: (error: Error) => void;
    onCancel?: () => void;
  }

  export const WalletTwoProvider: React.FC<{
    companyId: string;
    children: React.ReactNode;
  }>;

  export const AuthAction: React.FC<AuthActionProps>;
  export const TransactionAction: React.FC<TransactionActionProps>;
  export const SignatureAction: React.FC<SignatureActionProps>;
  export const LogoutAction: React.FC<LogoutActionProps>;
  export const RampAction: React.FC<RampActionProps>;

  export function useWalletTwo(): {
    user: WalletTwoUser | null;
    token: string | null;
    isLoading: boolean;
    error: Error | null;
    headlessLogin: (email: string, password: string) => Promise<void>;
    loadUserFromToken: (token: string) => Promise<void>;
    signMessage: (message: string) => Promise<string>;
    executeTransaction: (transactions: any[], network?: string) => Promise<any>;
    logout: () => Promise<void>;
  };
}