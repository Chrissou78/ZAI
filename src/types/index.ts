export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  location?: string;
  memberSince?: Date | string;
  createdAt?: Date;
}

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  chainId: string;
  balance: string;
  token: string | null;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  serialNumber: string;
  nfcTagId?: string;
  imageUrl?: string;
  tier?: string;
  claimedAt?: Date;
  blockchainTx?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: Date;
  location: string;
  tier?: string;
  imageUrl?: string;
  capacity?: number;
}

export interface TransactionResult {
  txHash: string;
  status: 'success' | 'failed' | 'pending';
  timestamp: Date;
}