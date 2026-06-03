export interface InsuranceInfo {
  active: boolean;
  status: string | null;
  certificateId: number | null;
  transactionId: number | null;
  activatedAt: string | null;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  image?: string;
  type?: string;
  price?: string;
  priceRaw?: string;
  currency?: string;
  materials?: string;
  collection?: string;
  hasInsurance?: boolean;
  serialNumber?: string;
  claimedAt?: string;
  tokenAddress?: string;
  tokenId?: string;
  symbol?: string;
  rwaName?: string;
  chainId?: string | null;
  metadata?: Record<string, any>;
  insurance: InsuranceInfo;
}

export interface ClaimableRwa {
  rwaId: string;
  name: string;
  smartContractAddress: string;
  chainId: number | null;
  image: string;
  description: string;
  price: string;
  priceRaw: string;
  currency: string;
  collection: string;
  materials: string;
  available: boolean;
  nft: { id: string; secret: string } | null;
}

export interface ClaimRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rwaId: string | null;
  productName: string;
  proofImageUrl: string;
  status: 'pending' | 'minting' | 'validated' | 'rejected' | 'error';
  adminNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  nftId: string | null;
  mintTx: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ZaiUser {
  id: string;
  walletAddress?: string;
  givenName?: string;
  familyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  image?: string;
  role?: string;
}
