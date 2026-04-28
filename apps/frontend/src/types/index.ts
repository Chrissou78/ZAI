export interface User {
  id: string;
  walletAddress: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  verified?: boolean;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'member';
  createdAt?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;

  dob?: string;                    // Date of birth
  location?: string;               // Location/city
  memberSince?: string;            // Member since date
  nfcCardId?: string;              // NFC card ID
}

export interface WalletState {
  address?: string;
  isConnected: boolean;
  isLoading?: boolean;
  error?: string | null;
  token?: string | null;
}

export interface NFCData {
  tagId: string;
  serialNumber?: string;
  productId?: string;
  timestamp?: number;
  data?: {
    tagId?: string;
    serialNumber?: string;
    productId?: string;
    text?: string;
    url?: string;
    mime?: {
      type: string;
      data: Uint8Array;
    };
  };
}

export interface ClaimProductPayload {
  serialNumber?: string;
  nfcData?: NFCData;
  proof?: string;
  productId?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  serialNumber: string;
  claimed?: boolean;
  claimedAt?: string;
  nfcCardId?: string;
}

export interface TransactionResult {
  txHash: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: Date;
}

export interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  location?: string;
  registered?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  jwtToken?: string;
  user?: User;
}
