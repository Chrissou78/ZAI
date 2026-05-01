import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';

interface Product {
  id: string;
  name: string;
  type: string;
  color: string;
  size: string;
  serialNumber: string;
  claimedAt: string;
  warranty: {
    active: boolean;
    expiresAt: string;
    years: number;
  };
  insurance: {
    active: boolean;
    activatedAt: string | null;
  };
  specs: Record<string, any>;
}

interface ProductCarouselState {
  currentIndex: number;
  totalCards: number;
}

const Products: React.FC = () => {
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [carouselState, setCarouselState] = useState<ProductCarouselState>({
    currentIndex: 0,
    totalCards: 0,
  });
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMethod, setClaimMethod] = useState<'nfc' | 'serial' | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Fetch user products on mount
  useEffect(() => {
    if (user?.id) {
      fetchUserProducts();
    }
  }, [user?.id]);

  const fetchUserProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get(`/products/user/${user?.id}`);
      
      if (response.data?.success) {
        setProducts(response.data.data || []);
        setCarouselState(prev => ({
          ...prev,
          totalCards: (response.data.data?.length || 0) + 1, // +1 for add card
        }));
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const cardWidth = 241;
  const cardsPerPage = Math.floor(800 / cardWidth);
  const maxIndex = Math.max(0, (products.length + 1) - cardsPerPage);

  const handleSlide = (direction: number) => {
    setCarouselState((prev) => ({
      ...prev,
      currentIndex: Math.max(
        0,
        Math.min(prev.currentIndex + direction, maxIndex)
      ),
    }));
  };

  const handleClaimSubmit = useCallback(async () => {
    if (claimMethod === 'serial' && serialInput.trim()) {
      setClaimLoading(true);
      setClaimError(null);
      
      try {
        const response = await apiService.post('/products/claim', {
          serialNumber: serialInput.trim(),
        });

        if (response.data?.success) {
          setClaimSuccess(true);
          setTimeout(() => {
            setShowClaimModal(false);
            setSerialInput('');
            setClaimMethod(null);
            setClaimSuccess(false);
            fetchUserProducts(); // Refresh products list
          }, 1500);
        }
      } catch (err: any) {
        setClaimError(
          err.response?.data?.error || 'Failed to claim product. Please check the serial number.'
        );
      } finally {
        setClaimLoading(false);
      }
    }
  }, [claimMethod, serialInput]);

  const handleActivateInsurance = async (productId: string) => {
    try {
      const response = await apiService.post(`/products/${productId}/activate-insurance`);
      
      if (response.data?.success) {
        fetchUserProducts(); // Refresh to show updated insurance status
      }
    } catch (err: any) {
      console.error('Error activating insurance:', err);
      alert(err.response?.data?.error || 'Failed to activate insurance');
    }
  };

  const statsData = [
    {
      icon: '📦',
      label: 'Products claimed',
      value: products.length.toString(),
      color: '#1a1a1a',
    },
    {
      icon: '✓',
      label: 'Insurance active',
      value: products.filter(p => p.insurance?.active).length.toString(),
      color: '#4caf7d',
    },
  ];

  if (isLoading && products.length === 0) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6a6a6a' }}>Loading your products...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#c8102e',
              marginBottom: '0.4rem',
            }}
          >
            my collection
          </div>
          <h1
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 0.3rem',
            }}
          >
            Your zai products
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Claim products using your experience card or serial number to activate warranty and
            access exclusive benefits.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowClaimModal(true)}>
          + Claim Product
        </Button>
      </div>

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          marginBottom: '2rem',
        }}
      >
        {statsData.map((stat, i) => (
          <div
            key={i}
            style={{
              background: '#f0ede6',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                background: '#ffffff',
                border: '1px solid #e0ddd6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 200, color: stat.color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {products.length === 0 && (
        <div
          style={{
            padding: '3.5rem 2rem',
            textAlign: 'center',
            border: '1px dashed #e0ddd6',
            background: '#f0ede6',
            marginBottom: '2rem',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📦</div>
          <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '8px', color: '#1a1a1a' }}>
            No products claimed yet
          </div>
          <p style={{ fontSize: '13px', color: '#6a6a6a', maxWidth: '360px', margin: '0 auto 1.5rem', lineHeight: 1.8 }}>
            Tap your zai Experience Card or enter a serial number to register your first product and activate your warranty.
          </p>
          <Button variant="primary" onClick={() => setShowClaimModal(true)}>
            Claim your first product
          </Button>
        </div>
      )}

      {/* Carousel */}
      {products.length > 0 && (
        <div style={{ position: 'relative', marginBottom: '2rem' }}>
          <button
            onClick={() => handleSlide(-1)}
            disabled={carouselState.currentIndex === 0}
            style={{
              position: 'absolute',
              top: '50%',
              left: '-18px',
              transform: 'translateY(-50%)',
              width: '36px',
              height: '36px',
              background: '#ffffff',
              border: '1px solid #e0ddd6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              opacity: carouselState.currentIndex === 0 ? 0.3 : 1,
            }}
          >
            ←
          </button>

          <div
            style={{
              overflow: 'hidden',
              border: '1px solid #e0ddd6',
            }}
          >
            <div
              style={{
                display: 'flex',
                transform: `translateX(-${carouselState.currentIndex * cardWidth}px)`,
                transition: 'transform 0.4s ease',
              }}
            >
              {/* Add Card */}
              <div
                onClick={() => setShowClaimModal(true)}
                style={{
                  background: '#ffffff',
                  minWidth: '240px',
                  maxWidth: '240px',
                  flexShrink: 0,
                  borderRight: '1px solid #e0ddd6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: '2rem',
                  minHeight: '280px',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      border: '1px solid #6a6a6a',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      color: '#6a6a6a',
                      margin: '0 auto 8px',
                    }}
                  >
                    +
                  </div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6a6a6a' }}>
                    Claim a product
                  </div>
                </div>
              </div>

              {/* Product Cards */}
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    background: '#ffffff',
                    minWidth: '240px',
                    maxWidth: '240px',
                    cursor: 'pointer',
                    borderRight: '1px solid #e0ddd6',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '0.75rem',
                      right: '0.75rem',
                      background: '#1a1a1a',
                      color: '#ffffff',
                      fontSize: '10px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      padding: '3px 7px',
                      zIndex: 2,
                    }}
                  >
                    Claimed
                  </div>

                  <div
                    style={{
                      height: '200px',
                      background: '#f0ede6',
                      borderBottom: '1px solid #e0ddd6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '48px',
                    }}
                  >
                    {product.type === 'ski' ? '🎿' : '👕'}
                  </div>

                  <div style={{ padding: '1.1rem' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '3px' }}>
                      {product.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '6px' }}>
                      {product.size ? `${product.size}` : ''} {product.color ? `• ${product.color}` : ''}
                    </div>

                    {product.insurance?.active && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px solid #e0ddd6',
                        }}
                      >
                        <div
                          style={{
                            width: '5px',
                            height: '5px',
                            background: '#4caf7d',
                            borderRadius: '50%',
                            boxShadow: '0 0 4px #4caf7d',
                          }}
                        />
                        <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4caf7d' }}>
                          Insurance active
                        </span>
                      </div>
                    )}

                    {!product.insurance?.active && product.warranty?.active && (
                      <button
                        onClick={() => handleActivateInsurance(product.id)}
                        style={{
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px solid #e0ddd6',
                          background: 'none',
                          border: 'none',
                          fontSize: '11px',
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: '#c8102e',
                          cursor: 'pointer',
                          padding: '6px 0',
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        + Activate Insurance
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleSlide(1)}
            disabled={carouselState.currentIndex >= maxIndex}
            style={{
              position: 'absolute',
              top: '50%',
              right: '-18px',
              transform: 'translateY(-50%)',
              width: '36px',
              height: '36px',
              background: '#ffffff',
              border: '1px solid #e0ddd6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 10,
              opacity: carouselState.currentIndex >= maxIndex ? 0.3 : 1,
            }}
          >
            →
          </button>
        </div>
      )}

      {/* Info */}
      <div
        style={{
          background: '#f0ede6',
          padding: '1.5rem',
          border: '1px solid #e0ddd6',
          borderRadius: '4px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#1a1a1a',
            marginBottom: '0.75rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid #e0ddd6',
          }}
        >
          How to claim
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            'Tap your zai Experience Card with an NFC-enabled phone',
            'Or enter your product serial number manually',
            'Activate warranty & insurance instantly',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '1px solid #c8102e',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  color: '#c8102e',
                  flexShrink: 0,
                  marginTop: '1px',
                  fontWeight: 'bold',
                }}
              >
                {i + 1}
              </div>
              <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Claim Modal */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => {
          setShowClaimModal(false);
          setClaimMethod(null);
          setSerialInput('');
          setClaimError(null);
        }}
        title="Claim Your Product"
        size="md"
      >
        {claimSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: '#4caf7d', marginBottom: '8px' }}>
              Product Claimed!
            </div>
            <p style={{ color: '#6a6a6a', marginBottom: '0' }}>
              Your product has been successfully registered.
            </p>
          </div>
        ) : !claimMethod ? (
          <div>
            <p style={{ color: '#6a6a6a', marginBottom: '24px' }}>
              Choose how you'd like to register your zai product
            </p>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setClaimMethod('nfc')}
              style={{ marginBottom: '12px' }}
            >
              📱 Tap NFC Card
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setClaimMethod('serial')}
            >
              🔢 Enter Serial Number
            </Button>
          </div>
        ) : claimMethod === 'serial' ? (
          <div>
            <label style={{ display: 'block', marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#6a6a6a',
                  marginBottom: '8px',
                }}
              >
                Serial Number
              </div>
              <input
                type="text"
                placeholder="e.g. ZAI-N21-2024-XXXX"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                disabled={claimLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0ddd6',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  outline: 'none',
                  opacity: claimLoading ? 0.6 : 1,
                }}
              />
            </label>
            {claimError && (
              <div style={{ color: '#c8102e', fontSize: '12px', marginBottom: '12px', padding: '8px', background: '#fff5f5', borderRadius: '4px' }}>
                {claimError}
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              disabled={!serialInput.trim() || claimLoading}
              onClick={handleClaimSubmit}
              style={{ marginBottom: '12px' }}
            >
              {claimLoading ? 'Claiming...' : 'Claim Product'}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setClaimMethod(null)}
              disabled={claimLoading}
            >
              Back
            </Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📡</div>
            <p style={{ color: '#6a6a6a', marginBottom: '24px' }}>
              Ready to scan. Tap your NFC card on your phone to begin.
            </p>
            <Button
              variant="primary"
              fullWidth
              onClick={() => setClaimMethod(null)}
            >
              Back
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
