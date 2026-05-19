import React, { useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';

interface InsuranceInfo {
  active: boolean;
  status: string | null;
  certificateId: number | null;
  transactionId: number | null;
  activatedAt: string | null;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  image?: string;
  type?: string;
  price?: string;
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
  warranty: {
    active: boolean;
    expiresAt: string | null;
    years: number;
  };
  insurance: InsuranceInfo;
}

interface InsuranceFormData {
  salutation: number;
  firstname: string;
  lastname: string;
  address1: string;
  zip: string;
  city: string;
  country: string;
  language: string;
  email: string;
  phone: string;
  deviceType: number;
  makeName: string;
  makeId: number;
  model: string;
  serial: string;
  price: string;
  length: string;
  purchasingdate: string;
}

const DEVICE_TYPES = [
  { id: 1, label: 'Ski Alpine' },
  { id: 2, label: 'Snowboard' },
  { id: 3, label: 'Cross-country' },
];

const SALUTATIONS = [
  { id: 1, label: 'Mr.' },
  { id: 2, label: 'Ms.' },
];

const Products: React.FC = () => {
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Claim modal
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimMethod, setClaimMethod] = useState<'nfc' | 'serial' | null>(null);
  const [serialInput, setSerialInput] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState(false);

  // Insurance modal
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceProduct, setInsuranceProduct] = useState<Product | null>(null);
  const [insuranceStep, setInsuranceStep] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [insuranceError, setInsuranceError] = useState<string | null>(null);
  const [insuranceResult, setInsuranceResult] = useState<{ certificateId: number; transactionId: number } | null>(null);
  const [insuranceForm, setInsuranceForm] = useState<InsuranceFormData>({
    salutation: 1, firstname: '', lastname: '', address1: '', zip: '', city: '', country: 'CH', language: 'en', email: '', phone: '',
    deviceType: 1, makeName: 'zai', makeId: 1, model: '', serial: '', price: '', length: '', purchasingdate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user?.id) fetchUserProducts();
  }, [user?.id]);

  const fetchUserProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get(`/products/user/${user?.id}`);
      if (response.data?.success) {
        setProducts(response.data.data || []);
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimSubmit = useCallback(async () => {
    if (claimMethod === 'serial' && serialInput.trim()) {
      setClaimLoading(true);
      setClaimError(null);
      try {
        const response = await apiService.post('/products/claim', { serialNumber: serialInput.trim() });
        if (response.data?.success) {
          setClaimSuccess(true);
          window.dispatchEvent(new CustomEvent('zai:product-claimed'));
          setTimeout(() => {
            setShowClaimModal(false);
            setSerialInput('');
            setClaimMethod(null);
            setClaimSuccess(false);
            fetchUserProducts();
          }, 1500);
        }
      } catch (err: any) {
        setClaimError(err.response?.data?.error || 'Failed to claim product.');
      } finally {
        setClaimLoading(false);
      }
    }
  }, [claimMethod, serialInput]);

  const openInsuranceModal = (product: Product) => {
    setInsuranceProduct(product);
    setInsuranceStep('form');
    setInsuranceError(null);
    setInsuranceResult(null);
    setInsuranceForm({
      salutation: (user as any)?.salutation || 1,
      firstname: user?.givenName || (user as any)?.firstName || '',
      lastname: user?.familyName || (user as any)?.lastName || '',
      address1: (user as any)?.address || '',
      zip: (user as any)?.postalCode || '',
      city: (user as any)?.city || '',
      country: (user as any)?.country || 'CH',
      language: (user as any)?.language || 'en',
      email: user?.email || '',
      phone: (user as any)?.phoneNumber || (user as any)?.phone || '',
      deviceType: 1,
      makeName: 'zai',
      makeId: 1,
      model: product.metadata?.model || product.name || '',
      serial: product.metadata?.serial || product.serialNumber || product.tokenId || '',
      price: product.price || product.metadata?.price || '',
      length: product.metadata?.length || '',
      purchasingdate: product.metadata?.purchasingdate || product.claimedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
    });
    setShowInsuranceModal(true);
  };

  const handleInsuranceSubmit = async () => {
    if (!insuranceProduct) return;
    setInsuranceStep('loading');
    setInsuranceError(null);
    try {
      const response = await apiService.post(`/products/${insuranceProduct.id}/activate-insurance`, insuranceForm);
      if (response.data?.success) {
        setInsuranceResult(response.data.data);
        setInsuranceStep('success');
        fetchUserProducts();
      } else {
        setInsuranceError(response.data?.error || 'Insurance activation failed');
        setInsuranceStep('error');
      }
    } catch (err: any) {
      const data = err.response?.data;
      if (data?.missingFields) {
        setInsuranceError(`Missing fields: ${data.missingFields.join(', ')}`);
      } else {
        setInsuranceError(data?.detail || data?.error || 'Insurance activation failed');
      }
      setInsuranceStep('error');
    }
  };

  const updateInsuranceField = (field: keyof InsuranceFormData, value: string | number) => {
    setInsuranceForm(prev => ({ ...prev, [field]: value }));
  };

  // Helpers
  const activeInsurance = products.filter(p => p.insurance?.active).length;
  const hasMetadata = (p: Product) => !!(p.image || p.description);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e0ddd6', fontSize: '13px',
    boxSizing: 'border-box', fontFamily: "'Inter', sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#6a6a6a', marginBottom: '6px', display: 'block',
  };

  // Build spec rows from metadata for the detail section
  const getSpecs = (p: Product): { label: string; value: string }[] => {
    const specs: { label: string; value: string }[] = [];
    if (p.price) specs.push({ label: 'Price', value: `${p.price}${p.currency ? ` ${p.currency}` : ' CHF'}` });
    if (p.materials) specs.push({ label: 'Materials', value: p.materials });
    if (p.collection) specs.push({ label: 'Collection', value: p.collection });
    if (p.metadata?.model) specs.push({ label: 'Model', value: p.metadata.model });
    if (p.metadata?.length) specs.push({ label: 'Length', value: `${p.metadata.length} cm` });
    if (p.metadata?.weight) specs.push({ label: 'Weight', value: p.metadata.weight });
    if (p.metadata?.color) specs.push({ label: 'Color', value: p.metadata.color });
    if (p.metadata?.size) specs.push({ label: 'Size', value: p.metadata.size });
    if (p.serialNumber) specs.push({ label: 'Serial', value: p.serialNumber });
    if (p.tokenId) specs.push({ label: 'Token ID', value: `#${p.tokenId}` });
    return specs;
  };

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
      <div style={{
        marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c8102e', marginBottom: '0.4rem' }}>
            my collection
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem' }}>
            Your zai products
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Claim products using your experience card or serial number to activate warranty and access exclusive benefits.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowClaimModal(true)}>+ Claim Product</Button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px',
        background: '#e0ddd6', border: '1px solid #e0ddd6', marginBottom: '2rem',
      }}>
        {[
          { label: 'Products claimed', value: products.length, color: '#1a1a1a' },
          { label: 'Insurance active', value: activeInsurance, color: '#4caf7d' },
          { label: 'Warranty', value: `${products.length > 0 ? '2' : '0'} yr`, color: '#b8a06a' },
        ].map((stat, i) => (
          <div key={i} style={{ background: '#f0ede6', padding: '1.25rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: 4 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd',
          color: '#c8102e', marginBottom: '1.5rem', fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && (
        <div style={{
          padding: '3.5rem 2rem', textAlign: 'center', border: '1px dashed #e0ddd6',
          background: '#f0ede6', marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⛷</div>
          <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: 8, color: '#1a1a1a' }}>
            No products claimed yet
          </div>
          <p style={{ fontSize: '13px', color: '#6a6a6a', maxWidth: 360, margin: '0 auto 1.5rem', lineHeight: 1.8 }}>
            Tap your zai Experience Card or enter a serial number to register your first product.
          </p>
          <Button variant="primary" onClick={() => setShowClaimModal(true)}>Claim your first product</Button>
        </div>
      )}

      {/* Product Cards */}
      {products.map((product) => {
        const specs = getSpecs(product);
        const isExpanded = expandedProduct === product.id;

        return (
          <div
            key={product.id}
            style={{
              border: '1px solid #e0ddd6',
              marginBottom: '1.5rem',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            {/* Main card: image left, info right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: product.image ? '340px 1fr' : '1fr',
                minHeight: 280,
              }}
            >
              {/* Product Image */}
              {product.image && (
                <div
                  style={{
                    background: '#f0ede6',
                    borderRight: '1px solid #e0ddd6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      minHeight: 280,
                    }}
                  />
                  {/* Claimed badge */}
                  <div style={{
                    position: 'absolute', top: '0.75rem', left: '0.75rem',
                    background: '#1a1a1a', color: '#fff', fontSize: 9,
                    letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 10px',
                  }}>
                    Claimed
                  </div>
                </div>
              )}

              {/* Product Info */}
              <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* Name & Collection */}
                  <div style={{
                    fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
                    color: '#b8a06a', marginBottom: '0.4rem',
                  }}>
                    {product.collection || product.rwaName || 'zai'}
                  </div>
                  <h2 style={{
                    fontSize: '26px', fontWeight: 300, margin: '0 0 0.75rem',
                    color: '#1a1a1a', lineHeight: 1.2,
                  }}>
                    {product.name}
                  </h2>

                  {/* Price */}
                  {product.price && (
                    <div style={{
                      fontSize: '18px', fontWeight: 200, color: '#1a1a1a',
                      marginBottom: '1rem',
                    }}>
                      {product.currency || 'CHF'} {product.price}
                    </div>
                  )}

                  {/* Description */}
                  {product.description && (
                    <p style={{
                      fontSize: '13px', color: '#6a6a6a', lineHeight: 1.7,
                      margin: '0 0 1.25rem', maxWidth: 480,
                    }}>
                      {product.description.length > 200 && !isExpanded
                        ? product.description.slice(0, 200) + '...'
                        : product.description}
                      {product.description.length > 200 && (
                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : product.id)}
                          style={{
                            background: 'none', border: 'none', color: '#c8102e',
                            cursor: 'pointer', fontSize: '12px', marginLeft: 4,
                            fontFamily: "'Inter', sans-serif",
                          }}
                        >
                          {isExpanded ? 'Show less' : 'Read more'}
                        </button>
                      )}
                    </p>
                  )}

                  {/* Specs grid */}
                  {specs.length > 0 && (
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: '0px', background: '#e0ddd6', border: '1px solid #e0ddd6',
                      marginBottom: '1.25rem',
                    }}>
                      {specs.map((spec, i) => (
                        <div key={i} style={{ background: '#fafaf7', padding: '10px 12px' }}>
                          <div style={{
                            fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
                            color: '#999', marginBottom: 2,
                          }}>
                            {spec.label}
                          </div>
                          <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 400 }}>
                            {spec.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom actions: warranty + insurance */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '1rem',
                  paddingTop: '1rem', borderTop: '1px solid #e0ddd6',
                  flexWrap: 'wrap',
                }}>
                  {/* Warranty status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, background: '#4caf7d', borderRadius: '50%',
                      boxShadow: '0 0 5px #4caf7d',
                    }} />
                    <span style={{
                      fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                      color: '#4caf7d',
                    }}>
                      {product.warranty?.years || 2}-year warranty
                    </span>
                  </div>

                  {/* Insurance status / button */}
                  {product.insurance?.active ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 6, height: 6, background: '#b8a06a', borderRadius: '50%',
                        boxShadow: '0 0 5px #b8a06a',
                      }} />
                      <span style={{
                        fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
                        color: '#b8a06a',
                      }}>
                        Insurance active
                        {product.insurance.certificateId ? ` · #${product.insurance.certificateId}` : ''}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => openInsuranceModal(product)}
                      style={{
                        background: '#7D1E2C', color: '#fff', border: 'none',
                        padding: '10px 22px', fontSize: '11px', letterSpacing: '0.15em',
                        textTransform: 'uppercase', cursor: 'pointer',
                        fontFamily: "'Inter', sans-serif", transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#7D1E2C')}
                    >
                      Activate Insurance
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* No image fallback badge */}
            {!product.image && (
              <div style={{
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: '-100%', left: '2rem',
                  background: '#1a1a1a', color: '#fff', fontSize: 9,
                  letterSpacing: '0.2em', textTransform: 'uppercase', padding: '4px 10px',
                }}>
                  Claimed
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Claim CTA at bottom */}
      {products.length > 0 && (
        <div
          onClick={() => setShowClaimModal(true)}
          style={{
            border: '1px dashed #e0ddd6', padding: '2rem', textAlign: 'center',
            cursor: 'pointer', transition: 'background 0.2s', background: '#fff',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f0ede6')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
        >
          <div style={{
            width: 36, height: 36, border: '1px solid #6a6a6a', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#6a6a6a', margin: '0 auto 8px',
          }}>+</div>
          <div style={{
            fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6a6a6a',
          }}>
            Claim another product
          </div>
        </div>
      )}

      {/* How to claim */}
      <div style={{
        background: '#f0ede6', padding: '1.5rem', border: '1px solid #e0ddd6',
        marginTop: '2rem',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a',
          marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6',
        }}>
          How to claim
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {['Tap your zai Experience Card with an NFC-enabled phone',
            'Or enter your product serial number manually',
            'Activate warranty & insurance instantly',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 18, height: 18, border: '1px solid #c8102e', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, color: '#c8102e', flexShrink: 0, marginTop: 1, fontWeight: 'bold',
              }}>{i + 1}</div>
              <div style={{ fontSize: 11, color: '#6a6a6a' }}>{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CLAIM MODAL ── */}
      <Modal
        isOpen={showClaimModal}
        onClose={() => { setShowClaimModal(false); setClaimMethod(null); setSerialInput(''); setClaimError(null); }}
        title="Claim Your Product"
        size="md"
      >
        {claimSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#4caf7d', marginBottom: 8 }}>Product Claimed!</div>
            <p style={{ color: '#6a6a6a' }}>Your product has been successfully registered.</p>
          </div>
        ) : !claimMethod ? (
          <div>
            <p style={{ color: '#6a6a6a', marginBottom: 24 }}>Choose how you'd like to register your zai product</p>
            <Button variant="primary" fullWidth onClick={() => setClaimMethod('nfc')} style={{ marginBottom: 12 }}>
              Tap NFC Card
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setClaimMethod('serial')}>
              Enter Serial Number
            </Button>
          </div>
        ) : claimMethod === 'serial' ? (
          <div>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <div style={labelStyle}>Serial Number</div>
              <input
                type="text" placeholder="e.g. ZAI-N21-2024-XXXX"
                value={serialInput} onChange={e => setSerialInput(e.target.value)}
                disabled={claimLoading}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 14, opacity: claimLoading ? 0.6 : 1 }}
              />
            </label>
            {claimError && (
              <div style={{ color: '#c8102e', fontSize: 12, marginBottom: 12, padding: 8, background: '#fff5f5' }}>
                {claimError}
              </div>
            )}
            <Button variant="primary" fullWidth disabled={!serialInput.trim() || claimLoading} onClick={handleClaimSubmit} style={{ marginBottom: 12 }}>
              {claimLoading ? 'Claiming...' : 'Claim Product'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setClaimMethod(null)} disabled={claimLoading}>Back</Button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
            <p style={{ color: '#6a6a6a', marginBottom: 24 }}>Ready to scan. Tap your NFC card on your phone.</p>
            <Button variant="primary" fullWidth onClick={() => setClaimMethod(null)}>Back</Button>
          </div>
        )}
      </Modal>

      {/* ── INSURANCE MODAL ── */}
      <Modal isOpen={showInsuranceModal} onClose={() => setShowInsuranceModal(false)} title="Activate Insurance" size="lg">
        {insuranceStep === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 14, color: '#6a6a6a' }}>Registering with insurance provider...</div>
          </div>
        )}

        {insuranceStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🛡</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#4caf7d', marginBottom: 8 }}>Insurance Activated!</div>
            {insuranceResult && (
              <div style={{ background: '#f0faf4', border: '1px solid #b6e8cc', padding: '1rem', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: '#6a6a6a', marginBottom: 4 }}>Certificate ID</div>
                <div style={{ fontSize: 20, fontWeight: 300, color: '#1a1a1a', fontFamily: 'monospace' }}>
                  #{insuranceResult.certificateId}
                </div>
                <div style={{ fontSize: 11, color: '#6a6a6a', marginTop: 8 }}>
                  Transaction: #{insuranceResult.transactionId}
                </div>
              </div>
            )}
            <Button variant="primary" fullWidth onClick={() => setShowInsuranceModal(false)}>Done</Button>
          </div>
        )}

        {insuranceStep === 'error' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#c8102e', marginBottom: 8 }}>Activation Failed</div>
            <div style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 16, padding: '0.75rem', background: '#fff5f5' }}>
              {insuranceError}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" fullWidth onClick={() => setInsuranceStep('form')}>Try Again</Button>
              <Button variant="secondary" fullWidth onClick={() => setShowInsuranceModal(false)}>Close</Button>
            </div>
          </div>
        )}

        {insuranceStep === 'form' && (
          <div>
            <p style={{ color: '#6a6a6a', fontSize: 13, marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Register your product with Suisse Alpine Services for insurance coverage. Fields marked with * are required.
            </p>

            {/* Customer section */}
            <div style={{
              fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a',
              marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e0ddd6',
            }}>
              Customer Information
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Salutation *</label>
                <select value={insuranceForm.salutation} onChange={e => updateInsuranceField('salutation', parseInt(e.target.value))} style={inputStyle}>
                  {SALUTATIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Language</label>
                <select value={insuranceForm.language} onChange={e => updateInsuranceField('language', e.target.value)} style={inputStyle}>
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="fr">Français</option>
                  <option value="it">Italiano</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>First name *</label>
                <input type="text" value={insuranceForm.firstname} onChange={e => updateInsuranceField('firstname', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last name *</label>
                <input type="text" value={insuranceForm.lastname} onChange={e => updateInsuranceField('lastname', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Address *</label>
                <input type="text" value={insuranceForm.address1} onChange={e => updateInsuranceField('address1', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>ZIP *</label>
                <input type="text" value={insuranceForm.zip} onChange={e => updateInsuranceField('zip', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>City *</label>
                <input type="text" value={insuranceForm.city} onChange={e => updateInsuranceField('city', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Country (2-letter code) *</label>
                <input type="text" value={insuranceForm.country} onChange={e => updateInsuranceField('country', e.target.value)} maxLength={2} style={{ ...inputStyle, textTransform: 'uppercase' }} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={insuranceForm.email} onChange={e => updateInsuranceField('email', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={insuranceForm.phone} onChange={e => updateInsuranceField('phone', e.target.value)} placeholder="+41..." style={inputStyle} />
              </div>
            </div>

            {/* Device section */}
            <div style={{
              fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a',
              marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e0ddd6',
            }}>
              Device Information
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Type *</label>
                <select value={insuranceForm.deviceType} onChange={e => updateInsuranceField('deviceType', parseInt(e.target.value))} style={inputStyle}>
                  {DEVICE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Make</label>
                <input type="text" value={insuranceForm.makeName} onChange={e => updateInsuranceField('makeName', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Model *</label>
                <input type="text" value={insuranceForm.model} onChange={e => updateInsuranceField('model', e.target.value)} placeholder="e.g. Spada" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Serial Number *</label>
                <input type="text" value={insuranceForm.serial} onChange={e => updateInsuranceField('serial', e.target.value)} style={{ ...inputStyle, fontFamily: 'monospace' }} />
              </div>
              <div>
                <label style={labelStyle}>Price (CHF) *</label>
                <input type="number" step="0.01" value={insuranceForm.price} onChange={e => updateInsuranceField('price', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Length (cm)</label>
                <input type="number" value={insuranceForm.length} onChange={e => updateInsuranceField('length', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Purchase Date *</label>
                <input type="date" value={insuranceForm.purchasingdate} onChange={e => updateInsuranceField('purchasingdate', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" fullWidth onClick={handleInsuranceSubmit}
                disabled={!insuranceForm.firstname || !insuranceForm.lastname || !insuranceForm.address1 || !insuranceForm.zip || !insuranceForm.city || !insuranceForm.model || !insuranceForm.serial || !insuranceForm.price}>
                Activate Insurance
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShowInsuranceModal(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Products;
