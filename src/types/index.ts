// Core type definitions for the ZAI Experience Club

export type UserRole = 'member' | 'atelier' | 'partner' | 'admin';
export type TierLevel = 'silver' | 'gold' | 'platinum' | 'atelier';
export type ProductCategory = 'skis' | 'apparel' | 'accessories';
export type EventType = 'demo' | 'factory' | 'partner' | 'community';

export interface User {
  id: string;
  email: string;
  walletAddress: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  tier: TierLevel;
  role: UserRole;
  memberSince: Date;
  location: string;
  country: string;
  currency: string;
  language: string;
  nfcCardId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  token: string | null;
  chainId: string;
  isLoading: boolean;
  error: string | null;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  imageUrl: string;
  serialNumber: string;
  purchaseDate: Date;
  warrantyExpiry: Date;
  insuranceActive: boolean;
  nfcTagId?: string;
  specifications: Record<string, string>;
  claimedAt: Date;
  claimedBy: string;
  blockchainTxHash?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  type: EventType;
  location: string;
  country: string;
  startDate: Date;
  endDate: Date;
  capacity: number;
  registered: number;
  imageUrl: string;
  tier: TierLevel;
  status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
  registeredBy: string[];
}

export interface ClaimProductPayload {
  serialNumber?: string;
  nfcData?: NFCData;
  blockchainProof?: string;
}

export interface NFCData {
  tagId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface TransactionResult {
  txHash: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  gasUsed?: string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
