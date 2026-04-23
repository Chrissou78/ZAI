import { useCallback, useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { Product, ClaimProductPayload, TransactionResult } from '../types';
import { blockchainService } from '../services/blockchain';
import { apiService } from '../services/api';

interface ClaimProductState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  transactionHash?: string;
}

export function useProductClaim() {
  const { executeTransaction } = useWalletTwo();
  const [state, setState] = useState<ClaimProductState>({
    isLoading: false,
    error: null,
    success: false,
  });

  const claimProduct = useCallback(
    async (payload: ClaimProductPayload): Promise<Product | null> => {
      setState({ isLoading: true, error: null, success: false });

      try {
        // Step 1: Generate blockchain proof
        const proof = await blockchainService.generateProductProof(payload);

        // Step 2: Execute smart contract transaction
        const txResult = await new Promise<TransactionResult>(
          (resolve, reject) => {
            executeTransaction({
              network: '137',
              transactions: [
                {
                  method: 'claimProduct',
                  address: process.env.REACT_APP_ZAI_CONTRACT_ADDRESS || '',
                  params: [payload.serialNumber || payload.nfcData?.tagId, proof],
                },
              ],
              onSuccess: (txId) => {
                resolve({ txHash: txId, status: 'success', timestamp: new Date() });
              },
              onFailure: (error) => {
                reject(new Error(error));
              },
              onCancel: () => {
                reject(new Error('User cancelled transaction'));
              },
            });
          }
        );

        // Step 3: Register claim in backend
        const response = await apiService.post<Product>('/products/claim', {
          ...payload,
          blockchainTxHash: txResult.txHash,
        });

        if (response.success && response.data) {
          setState({
            isLoading: false,
            error: null,
            success: true,
            transactionHash: txResult.txHash,
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to claim product');
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred';
        setState({
          isLoading: false,
          error: errorMessage,
          success: false,
        });
        return null;
      }
    },
    [executeTransaction]
  );

  const reset = useCallback(() => {
    setState({ isLoading: false, error: null, success: false });
  }, []);

  return {
    ...state,
    claimProduct,
    reset,
  };
}
