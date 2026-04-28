export interface WalletTwoUser {
  id: string;
  email: string;
}

export interface WalletAuthPayload {
  token: string;
  user: WalletTwoUser;
  expiresAt: number;
}

export interface WalletTransaction {
  method: string;
  address: string;
  params: unknown[];
  abi?: unknown;
}

export interface TransactionOptions {
  network: string;
  transactions: WalletTransaction[];
  onSuccess?: (txId: string) => void;
  onFailure?: (error: string) => void;
  onCancel?: () => void;
  onExecuting?: () => void;
}

export interface SignatureMessage {
  message: string;
  timestamp: Date;
  userId: string;
}
