import React, { useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useProductClaim } from '../../hooks/useProductClaim';
import Button from '../Common/Button';
import Card from '../Common/Card';
import EmptyState from '../Common/Empty';
import Modal from '../Common/Modal';

interface ProductCarouselState {
  currentIndex: number;
  totalCards: number;
}

const Products: React.FC = () => {
  const { user } = useAppContext();
  const { claimProduct, isLoading, error, success } = useProductClaim();
  const [carouselState, setCarouselState] = useState<ProductCarouselState>({
    currentIndex: 0,
    totalCards: 5,
  });
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMethod, setClaimMethod] = useState<'nfc' | 'serial' | null>(null);
  const [serialInput, setSerialInput] = useState('');

  // Mock products data
  const mockProducts = [
    {
      id: '1',
      name: 'N2.1 Ski — Fire Orange',
      category: 'skis',
      desc: '180cm · Titanal construction',
      hasInsurance: true,
      claimed: true,
    },
    {
      id: '2',
      name: 'N2.1 Ski — Anthracite',
      category: 'skis',
      desc: '175cm · Carbon/Titanal',
      hasInsurance: true,
      claimed: true,
    },
    {
      id: '3',
      name: 'Oversize Hoodie — Rust',
      category: 'apparel',
      desc: 'Unisex · Organic cotton',
      hasInsurance: false,
      claimed: true,
    },
    {
      id: '4',
      name: 'Softshell Jacket — Ochre',
      category: 'apparel',
      desc: 'Technical 3-layer',
      hasInsurance: true,
      claimed: true,
    },
  ];

  const cardWidth = 241; // pixels
  const cardsPerPage = Math.floor(800 / cardWidth);
  const maxIndex = Math.max(0, mockProducts.length + 1 - cardsPerPage);

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
    if (claimMethod === 'serial' && serialInput) {
      const result = await claimProduct({
        serialNumber: serialInput,
      });
      if (result) {
        setShowClaimModal(false);
        setSerialInput('');
        setClaimMethod(null);
      }
    }
  }, [claimMethod, serialInput, claimProduct]);

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

      {/* Summary */}
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
        {[
          { icon: '📦', label: 'Products claimed', value: '4' },
          { icon: '✓', label: 'Insurance active', value: '2', color: '#4caf7d' },
        ].map((stat, i) => (
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
              <div style={{ fontSize: '24px', fontWeight: 200, color: stat.color || '#1a1a1a' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '2px' }}>
                {stat.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Carousel */}
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
            {mockProducts.map((product) => (
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
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
              >
                {product.claimed && (
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
                )}
                <div
                  style={{
                    height: '200px',
                    background: '#f0ede6',
                    borderBottom: '1px solid #e0ddd6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {product.category === 'skis' ? '🎿' : '👕'}
                </div>
                <div style={{ padding: '1.1rem' }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, marginBottom: '3px' }}>
                    {product.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a' }}>
                    {product.desc}
                  </div>
                  {product.hasInsurance && (
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
        }}
        title="Claim Your Product"
        size="md"
      >
        {!claimMethod ? (
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
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e0ddd6',
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </label>
            {error && (
              <div style={{ color: '#c8102e', fontSize: '12px', marginBottom: '12px' }}>
                {error}
              </div>
            )}
            <Button
              variant="primary"
              fullWidth
              isLoading={isLoading}
              disabled={!serialInput || isLoading}
              onClick={handleClaimSubmit}
              style={{ marginBottom: '12px' }}
            >
              Claim Product
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setClaimMethod(null)}
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