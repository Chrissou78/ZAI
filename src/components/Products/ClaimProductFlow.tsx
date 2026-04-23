import React, { useState } from 'react';
import { useNFC } from '../../hooks';
import { useProductClaim } from '../../hooks/useProductClaim';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import Button from '../Common/Button';

interface ClaimProductFlowProps {
  onSuccess?: (productId: string) => void;
  onCancel?: () => void;
}

export function ClaimProductFlow({
  onSuccess,
  onCancel,
}: ClaimProductFlowProps) {
  const [step, setStep] = useState<'method' | 'nfc' | 'serial' | 'confirm'>(
    'method'
  );
  const [serialNumber, setSerialNumber] = useState('');
  const { startScanning, isScanning, data: nfcData, error: nfcError } = useNFC();
  const { claimProduct, isLoading, error: claimError } = useProductClaim();
  const { user } = useWalletTwo();

  const handleNFCScan = React.useCallback(async () => {
    const scannedData = await startScanning();
    if (scannedData) {
      setStep('confirm');
    }
  }, [startScanning]);

  const handleSerialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialNumber.trim()) {
      setStep('confirm');
    }
  };

  const handleConfirm = React.useCallback(async () => {
    const product = await claimProduct({
      serialNumber: serialNumber || undefined,
      nfcData: nfcData || undefined,
    });

    if (product) {
      onSuccess?.(product.id);
    }
  }, [claimProduct, serialNumber, nfcData, onSuccess]);

  return (
    <div
      style={{
        padding: '24px',
        maxWidth: '500px',
        margin: '0 auto',
      }}
    >
      {step === 'method' && (
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 300, marginBottom: '24px' }}>
            Claim Your Product
          </h2>
          <p style={{ color: '#6a6a6a', marginBottom: '24px' }}>
            Choose how you'd like to register your zai product
          </p>
          <Button
            onClick={() => setStep('nfc')}
            style={{
              width: '100%',
              marginBottom: '12px',
              background: '#1a1a1a',
              color: 'white',
              padding: '12px',
            }}
          >
            📱 Tap NFC Card
          </Button>
          <Button
            onClick={() => setStep('serial')}
            style={{
              width: '100%',
              background: '#f0ede6',
              color: '#1a1a1a',
              padding: '12px',
            }}
          >
            🔢 Enter Serial Number
          </Button>
          <Button
            onClick={onCancel}
            style={{
              width: '100%',
              marginTop: '12px',
              background: 'transparent',
              border: '1px solid #e0ddd6',
              color: '#6a6a6a',
              padding: '12px',
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {step === 'nfc' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Tap Your Experience Card</h3>
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              border: '2px dashed #e0ddd6',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          >
            {isScanning ? (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  📡
                </div>
                <p>Scanning for NFC card...</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                  📱
                </div>
                <p>Ready to scan</p>
              </div>
            )}
          </div>
          {nfcError && (
            <div style={{ color: '#c8102e', marginBottom: '16px' }}>
              {nfcError}
            </div>
          )}
          <Button
            onClick={handleNFCScan}
            disabled={isScanning}
            style={{
              width: '100%',
              marginBottom: '12px',
              background: isScanning ? '#ccc' : '#7D1E2C',
              color: 'white',
              padding: '12px',
            }}
          >
            {isScanning ? 'Scanning...' : 'Start Scanning'}
          </Button>
          <Button
            onClick={() => setStep('method')}
            style={{
              width: '100%',
              background: '#f0ede6',
              color: '#1a1a1a',
              padding: '12px',
            }}
          >
            Back
          </Button>
        </div>
      )}

      {step === 'serial' && (
        <form onSubmit={handleSerialSubmit}>
          <h3 style={{ marginBottom: '16px' }}>Enter Serial Number</h3>
          <input
            type="text"
            placeholder="e.g. ZAI-N21-2024-XXXX"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #e0ddd6',
              borderRadius: '4px',
              fontFamily: 'monospace',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          />
          <Button
            type="submit"
            disabled={!serialNumber.trim()}
            style={{
              width: '100%',
              marginBottom: '12px',
              background: serialNumber.trim() ? '#7D1E2C' : '#ccc',
              color: 'white',
              padding: '12px',
            }}
          >
            Continue
          </Button>
          <Button
            onClick={() => setStep('method')}
            style={{
              width: '100%',
              background: '#f0ede6',
              color: '#1a1a1a',
              padding: '12px',
            }}
          >
            Back
          </Button>
        </form>
      )}

      {step === 'confirm' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Confirm Claim</h3>
          <div
            style={{
              padding: '16px',
              background: '#f0ede6',
              borderRadius: '4px',
              marginBottom: '16px',
            }}
          >
            <p style={{ fontSize: '12px', color: '#6a6a6a', marginBottom: '8px' }}>
              Serial Number
            </p>
            <p style={{ fontSize: '14px', fontFamily: 'monospace' }}>
              {serialNumber || nfcData?.tagId}
            </p>
          </div>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            style={{
              width: '100%',
              marginBottom: '12px',
              background: isLoading ? '#ccc' : '#7D1E2C',
              color: 'white',
              padding: '12px',
            }}
          >
            {isLoading ? 'Processing...' : 'Claim Product'}
          </Button>
          {claimError && (
            <div style={{ color: '#c8102e', marginBottom: '12px' }}>
              {claimError}
            </div>
          )}
          <Button
            onClick={() => {
              setStep('method');
              setSerialNumber('');
            }}
            style={{
              width: '100%',
              background: '#f0ede6',
              color: '#1a1a1a',
              padding: '12px',
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
