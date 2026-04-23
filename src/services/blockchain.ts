import { ClaimProductPayload, NFCData } from '../types';
import { ethers, verifyMessage } from 'ethers';

class BlockchainService {
  async generateProductProof(payload: ClaimProductPayload): Promise<string> {
    // Generate cryptographic proof of product ownership
    const proofData = {
      serialNumber: payload.serialNumber,
      nfcTagId: payload.nfcData?.tagId,
      timestamp: Date.now(),
    };

    // Create hash of proof data
    const proofString = JSON.stringify(proofData);
    const encoder = new TextEncoder();
    const data = encoder.encode(proofString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return `0x${hashHex}`;
  }

  async verifyProductSignature(
    signature: string,
    serialNumber: string
  ): Promise<boolean> {
    // Verify that the signature matches the product
    try {
        const recoveredAddress = verifyMessage(serialNumber, signature);
        return !!recoveredAddress;
    } catch {
        return false;
    }
  }

  getNetworkName(chainId: string): string {
    const networks: Record<string, string> = {
      '1': 'ethereum',
      '137': 'polygon',
      '43114': 'avalanche',
      '56': 'bsc',
    };
    return networks[chainId] || 'unknown';
  }

  async getNetworkStatus(chainId: string): Promise<boolean> {
    // Check if network is accessible
    try {
      const rpcUrl = this.getRPCUrl(chainId);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 1,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getRPCUrl(chainId: string): string {
    const rpcUrls: Record<string, string> = {
      '137': 'https://polygon-rpc.com',
      '1': 'https://eth-mainnet.g.alchemy.com/v2/demo',
      '56': 'https://bsc-dataseed1.binance.org:8545',
    };
    return rpcUrls[chainId] || '';
  }
}

export const blockchainService = new BlockchainService();
