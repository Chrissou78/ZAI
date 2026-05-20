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

  // Detail modal
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

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
  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

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
      deviceType: product.collection?.toLowerCase() === 'snowboard' ? 2
        : product.collection?.toLowerCase() === 'cross-country' ? 3
        : 1,
      makeName: 'zai',
      makeId: 1,
      model: product.name || '',
      serial: product.serialNumber || product.tokenId || '',
      price: product.priceRaw || product.price || '',
      length: product.metadata?.length || '',
      purchasingdate: product.claimedAt?.split('T')[0] || new Date().toISOString().split('T')[0],
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
            Claim products using your experience card or serial number to access exclusive benefits.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowClaimModal(true)}>+ Claim Product</Button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px',
        background: '#e0ddd6', border: '1px solid #e0ddd6', marginBottom: '2rem',
      }}>
        {[
          { label: 'Products claimed', value: products.length, color: '#1a1a1a' },
          { label: 'Insurance active', value: activeInsurance, color: '#4caf7d' },
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

      {/* Product Carousel Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        {products.map((product) => (
          <div
            key={product.id}
            onClick={() => setSelectedProduct(product)}
            style={{
              border: '1px solid #e0ddd6',
              background: '#fff',
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
            }}
          >
            {/* Thumbnail */}
            <div style={{
              background: '#f0ede6',
              height: 220,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              position: 'relative',
            }}>
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ fontSize: '48px', opacity: 0.3 }}>⛷</div>
              )}
              {/* Claimed badge */}
              <div style={{
                position: 'absolute', top: '0.5rem', left: '0.5rem',
                background: '#1a1a1a', color: '#fff', fontSize: 9,
                letterSpacing: '0.2em', textTransform: 'uppercase', padding: '3px 8px',
              }}>
                Claimed
              </div>
              {/* Insurance badge */}
              {product.insurance?.active && (
                <div style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  background: '#4caf7d', color: '#fff', fontSize: 9,
                  letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
                }}>
                  Insured
                </div>
              )}
            </div>

            {/* Card info */}
            <div style={{ padding: '1rem 1.25rem' }}>
              {product.collection && (
                <div style={{
                  fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase',
                  color: '#b8a06a', marginBottom: '0.3rem',
                }}>
                  {product.collection}
                </div>
              )}
              <div style={{ fontSize: '15px', fontWeight: 400, color: '#1a1a1a', marginBottom: '0.4rem' }}>
                {product.name}
              </div>
              {product.price && (
                <div style={{ fontSize: '13px', color: '#6a6a6a' }}>
                  {product.price} {product.currency || 'CHF'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Claim another product CTA */}
      {products.length > 0 && (
        <div style={{
          padding: '2rem', textAlign: 'center', border: '1px dashed #e0ddd6',
          background: '#f0ede6', marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 300, marginBottom: '0.8rem', color: '#1a1a1a' }}>
            Have another zai product?
          </div>
          <Button variant="primary" onClick={() => setShowClaimModal(true)}>+ Claim another product</Button>
        </div>
      )}

      {/* How to claim */}
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#b8a06a', marginBottom: '1rem' }}>
          How to claim
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {[
            { step: '01', title: 'Get your card', desc: 'Receive your zai Experience Card with your product purchase.' },
            { step: '02', title: 'Tap or enter serial', desc: 'Use NFC tap or manually enter the serial number from your card.' },
            { step: '03', title: 'Enjoy benefits', desc: 'Access insurance, exclusive events, and community features.' },
          ].map((item) => (
            <div key={item.step} style={{ padding: '1.5rem', border: '1px solid #e0ddd6' }}>
              <div style={{ fontSize: '24px', fontWeight: 200, color: '#c8102e', marginBottom: '0.75rem' }}>{item.step}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '0.5rem' }}>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ PRODUCT DETAIL MODAL ═══ */}
      {selectedProduct && (
        <Modal isOpen={true} onClose={() => setSelectedProduct(null)} title={selectedProduct.name}>
          <div style={{ maxWidth: 600 }}>
            {/* Image */}
            {selectedProduct.image && (
              <div
                onClick={() => setZoomImage({ src: selectedProduct.image!, alt: selectedProduct.name })}
                style={{
                  background: '#f0ede6', marginBottom: '1.5rem', cursor: 'zoom-in',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  maxHeight: 360, overflow: 'hidden',
                }}
              >
                <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '100%', objectFit: 'contain', maxHeight: 360 }} />
              </div>
            )}

            {/* Collection tag */}
            {selectedProduct.collection && (
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#b8a06a', marginBottom: '0.4rem' }}>
                {selectedProduct.collection}
              </div>
            )}

            {/* Description */}
            {selectedProduct.description && (
              <p style={{ fontSize: '13px', color: '#6a6a6a', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                {selectedProduct.description}
              </p>
            )}

            {/* Specs */}
            {getSpecs(selectedProduct).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginBottom: '0.75rem' }}>
                  Specifications
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6' }}>
                  {getSpecs(selectedProduct).map((spec, i) => (
                    <div key={i} style={{ background: '#f0ede6', padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#999', marginBottom: 2 }}>
                        {spec.label}
                      </div>
                      <div style={{ fontSize: '13px', color: '#1a1a1a' }}>{spec.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Insurance action */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {selectedProduct.insurance?.active ? (
                <div style={{
                  padding: '10px 20px', background: '#f0faf4', border: '1px solid #4caf7d',
                  color: '#2e7d4f', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  ✓ Insurance Active
                </div>
              ) : (
                <Button variant="primary" onClick={() => { setSelectedProduct(null); openInsuranceModal(selectedProduct); }}>
                  Activate Insurance
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ═══ CLAIM MODAL ═══ */}
      <Modal isOpen={showClaimModal} onClose={() => { setShowClaimModal(false); setClaimMethod(null); setSerialInput(''); setClaimError(null); setClaimSuccess(false); }} title="Claim a Product">
        {claimSuccess ? (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>✓</div>
            <div style={{ fontSize: '18px', fontWeight: 300 }}>Product Claimed!</div>
          </div>
        ) : (
          <div>
            {!claimMethod && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => setClaimMethod('nfc')}
                  style={{
                    padding: '1.25rem', border: '1px solid #e0ddd6', background: '#f0ede6',
                    cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>NFC Tap</div>
                  <div style={{ fontSize: '12px', color: '#6a6a6a' }}>Tap your Experience Card on your device</div>
                </button>
                <button
                  onClick={() => setClaimMethod('serial')}
                  style={{
                    padding: '1.25rem', border: '1px solid #e0ddd6', background: '#f0ede6',
                    cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>Serial Number</div>
                  <div style={{ fontSize: '12px', color: '#6a6a6a' }}>Enter the serial number from your card</div>
                </button>
              </div>
            )}

            {claimMethod === 'nfc' && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📱</div>
                <p style={{ color: '#6a6a6a', fontSize: '13px' }}>Hold your NFC card near your device...</p>
                <button
                  onClick={() => setClaimMethod(null)}
                  style={{ marginTop: '1rem', background: 'none', border: 'none', color: '#c8102e', cursor: 'pointer', fontSize: '13px' }}
                >
                  ← Back
                </button>
              </div>
            )}

            {claimMethod === 'serial' && (
              <div>
                <label style={labelStyle}>Serial Number</label>
                <input
                  type="text"
                  value={serialInput}
                  onChange={(e) => setSerialInput(e.target.value)}
                  placeholder="Enter serial number"
                  style={{ ...inputStyle, marginBottom: '1rem' }}
                />
                {claimError && (
                  <div style={{ color: '#c8102e', fontSize: '12px', marginBottom: '1rem' }}>{claimError}</div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setClaimMethod(null)}
                    style={{ padding: '10px 20px', border: '1px solid #e0ddd6', background: '#fff', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                  >
                    Back
                  </button>
                  <Button variant="primary" onClick={handleClaimSubmit} disabled={claimLoading || !serialInput.trim()}>
                    {claimLoading ? 'Claiming...' : 'Claim Product'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ═══ INSURANCE MODAL ═══ */}
      <Modal isOpen={showInsuranceModal} onClose={() => setShowInsuranceModal(false)} title="Activate Insurance">
        {insuranceStep === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '16px', color: '#6a6a6a' }}>Activating insurance...</div>
          </div>
        )}

        {insuranceStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>✓</div>
            <div style={{ fontSize: '18px', fontWeight: 300, marginBottom: '1rem' }}>Insurance Activated!</div>
            {insuranceResult && (
              <div style={{ fontSize: '12px', color: '#6a6a6a' }}>
                Certificate #{insuranceResult.certificateId} · Transaction #{insuranceResult.transactionId}
              </div>
            )}
          </div>
        )}

        {insuranceStep === 'error' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>✗</div>
            <div style={{ fontSize: '14px', color: '#c8102e', marginBottom: '1rem' }}>{insuranceError}</div>
            <Button variant="primary" onClick={() => setInsuranceStep('form')}>Try Again</Button>
          </div>
        )}

        {insuranceStep === 'form' && (
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginBottom: '1rem' }}>
              Personal Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Salutation</label>
                <select value={insuranceForm.salutation} onChange={(e) => updateInsuranceField('salutation', parseInt(e.target.value))} style={inputStyle}>
                  {SALUTATIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Language</label>
                <select value={insuranceForm.language} onChange={(e) => updateInsuranceField('language', e.target.value)} style={inputStyle}>
                  <option value="en">English</option><option value="de">Deutsch</option><option value="fr">Français</option><option value="it">Italiano</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>First Name</label>
                <input type="text" value={insuranceForm.firstname} onChange={(e) => updateInsuranceField('firstname', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input type="text" value={insuranceForm.lastname} onChange={(e) => updateInsuranceField('lastname', e.target.value)} style={inputStyle} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Address</label>
                <input type="text" value={insuranceForm.address1} onChange={(e) => updateInsuranceField('address1', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Zip</label>
                <input type="text" value={insuranceForm.zip} onChange={(e) => updateInsuranceField('zip', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input type="text" value={insuranceForm.city} onChange={(e) => updateInsuranceField('city', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Country</label>
                <input type="text" value={insuranceForm.country} onChange={(e) => updateInsuranceField('country', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={insuranceForm.email} onChange={(e) => updateInsuranceField('email', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input type="tel" value={insuranceForm.phone} onChange={(e) => updateInsuranceField('phone', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', marginBottom: '1rem' }}>
              Device Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={labelStyle}>Device Type</label>
                <select value={insuranceForm.deviceType} onChange={(e) => updateInsuranceField('deviceType', parseInt(e.target.value))} style={inputStyle}>
                  {DEVICE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input type="text" value={insuranceForm.model} onChange={(e) => updateInsuranceField('model', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Serial</label>
                <input type="text" value={insuranceForm.serial} onChange={(e) => updateInsuranceField('serial', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Price</label>
                <input type="text" value={insuranceForm.price} onChange={(e) => updateInsuranceField('price', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Length (cm)</label>
                <input type="text" value={insuranceForm.length} onChange={(e) => updateInsuranceField('length', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Purchase Date</label>
                <input type="date" value={insuranceForm.purchasingdate} onChange={(e) => updateInsuranceField('purchasingdate', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <Button variant="primary" onClick={handleInsuranceSubmit} style={{ width: '100%' }}>
              Activate Insurance
            </Button>
          </div>
        )}
      </Modal>

      {/* ═══ ZOOM IMAGE MODAL ═══ */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img src={zoomImage.src} alt={zoomImage.alt} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
};

export default Products;
