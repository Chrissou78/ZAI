import { useCallback, useEffect, useState } from 'react';
import { NFCData } from '../types';

interface NFCState {
  isSupported: boolean;
  isScanning: boolean;
  error: string | null;
  data: NFCData | null;
}

export function useNFC() {
  const [state, setState] = useState<NFCState>({
    isSupported: false,
    isScanning: false,
    error: null,
    data: null,
  });

  // Check NFC API support
  useEffect(() => {
    const isSupported = 'NDEFReader' in window;
    setState((prev) => ({ ...prev, isSupported }));
  }, []);

  const startScanning = useCallback(async (): Promise<NFCData | null> => {
    if (!state.isSupported) {
      setState((prev) => ({
        ...prev,
        error: 'NFC is not supported on this device',
      }));
      return null;
    }

    setState((prev) => ({ ...prev, isScanning: true, error: null }));

    try {
      // Type assertion for Web NFC API (not fully typed in TypeScript yet)
      const ndef = (window as any).NDEFReader;
      const reader = new ndef();

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          setState((prev) => ({ ...prev, isScanning: false }));
          reject(new Error('NFC scan timeout'));
        }, 30000); // 30 second timeout

        reader.scan().then(
          async () => {
            reader.onreading = (event: any) => {
              clearTimeout(timeout);
              try {
                const decoder = new TextDecoder();
                const nfcData: NFCData = {
                  tagId: event.serialNumber || '',
                  serialNumber: event.serialNumber,
                  timestamp: Date.now(),
                  data: {
                    tagId: event.serialNumber,
                    serialNumber: event.serialNumber,
                  },
                };

                // Parse NDEF records
                if (nfcData.data) {
                  for (const record of event.message.records) {
                    if (record.recordType === 'text') {
                      nfcData.data.text = decoder.decode(record.data);
                    } else if (record.recordType === 'url') {
                      nfcData.data.url = decoder.decode(record.data);
                    } else if (record.recordType === 'mime') {
                      nfcData.data.mime = {
                        type: record.mediaType,
                        data: new Uint8Array(record.data),
                      };
                    }
                  }
                }

                setState((prev) => ({
                  ...prev,
                  isScanning: false,
                  data: nfcData,
                  error: null,
                }));
                resolve(nfcData);
              } catch (err) {
                setState((prev) => ({
                  ...prev,
                  isScanning: false,
                  error: 'Failed to parse NFC data',
                }));
                reject(err);
              }
            };

            reader.onreadingerror = () => {
              clearTimeout(timeout);
              setState((prev) => ({
                ...prev,
                isScanning: false,
                error: 'NFC read error',
              }));
              reject(new Error('NFC read error'));
            };
          },
          (error: any) => {
            clearTimeout(timeout);
            setState((prev) => ({
              ...prev,
              isScanning: false,
              error: error.message || 'Failed to start NFC scan',
            }));
            reject(error);
          }
        );
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'NFC scan failed';
      setState((prev) => ({
        ...prev,
        isScanning: false,
        error: errorMessage,
      }));
      return null;
    }
  }, [state.isSupported]);

  const stopScanning = useCallback(() => {
    setState((prev) => ({ ...prev, isScanning: false }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isSupported: state.isSupported,
      isScanning: false,
      error: null,
      data: null,
    });
  }, [state.isSupported]);

  return {
    ...state,
    startScanning,
    stopScanning,
    reset,
  };
}
