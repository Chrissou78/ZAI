import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';

/* ───── Types ───── */

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

interface ClaimableRwa {
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
  unclaimedCount: number;
  available: boolean;
  nft: { id: string; secret: string } | null;
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

/* ───── Styles ───── */

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#c8102e', burgundy: '#7D1E2C',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6', green: '#4caf7d',
  font: "'Inter', sans-serif",
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`, fontSize: '13px',
  boxSizing: 'border-box', fontFamily: C.font,
};
const labelStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
  color: C.gray, marginBottom: '6px', display: 'block',
};

/* ───── Component ───── */

const Products: React.FC = () => {
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // ── Claim modal state ──
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimableRwas, setClaimableRwas] = useState<ClaimableRwa[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [claimableError, setClaimableError] = useState<string | null>(null);
  const [claimingRwaId, setClaimingRwaId] = useState<string | null>(null);
  const [claimStep, setClaimStep] = useState<'list' | 'minting' | 'success' | 'error'>('list');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [mintedNftId, setMintedNftId] = useState<string | null>(null);
  const [mintProgress, setMintProgress] = useState<string>('Queuing mint transaction...');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Insurance modal state ──
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

  /* ───── Data fetching ───── */

  useEffect(() => {
    if (user?.id) fetchUserProducts();
  }, [user?.id]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

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

  const fetchClaimableRwas = async () => {
    setClaimableLoading(true);
    setClaimableError(null);
    try {
      const response = await apiService.get('/products/claimable');
      if (response.data?.success) {
        setClaimableRwas(response.data.data || []);
      } else {
        setClaimableError('Failed to load claimable products');
      }
    } catch (err: any) {
      console.error('Error fetching claimable RWAs:', err);
      setClaimableError(err.response?.data?.error || 'Failed to load claimable products');
    } finally {
      setClaimableLoading(false);
    }
  };

  /* ───── Claim flow ───── */

  const openClaimModal = () => {
    setShowClaimModal(true);
    setClaimStep('list');
    setClaimError(null);
    setClaimingRwaId(null);
    setMintedNftId(null);
    fetchClaimableRwas();
  };

  const handleClaim = async (rwa: ClaimableRwa) => {
    if (!rwa.nft) {
      setClaimError('No unclaimed NFTs available for this product.');
      setClaimStep('error');
      return;
    }

    setClaimingRwaId(rwa.rwaId);
    setClaimStep('minting');
    setMintProgress('Queuing mint transaction...');
    setClaimError(null);

    try {
      // 1. Call our backend which proxies to POST /v1/api/nft/claim
      const response = await apiService.post('/products/claim-nft', {
        rwaId: rwa.rwaId,
        nftId: rwa.nft.id,
        secret: rwa.nft.secret,
        smartContractAddress: rwa.smartContractAddress,
      });

      const payload = response.data as any;

      if (!payload?.success) {
        throw new Error(payload?.error || 'Claim request failed');
      }

      const nftId: string = payload.nftId || rwa.nft.id;
      setMintedNftId(nftId);
      setMintProgress('Transaction queued. Waiting for on-chain confirmation...');

      // 2. Poll GET /api/products/nft/:nftId until minted
      let attempts = 0;
      const maxAttempts = 60; // ~2 minutes at 2s intervals

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await apiService.get(`/products/nft/${nftId}`);
          const nftData = (pollRes.data as any)?.data;

          if (nftData?.isClaimed || nftData?.mintedTx) {
            // Minting complete!
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setMintProgress('NFT minted successfully!');
            setClaimStep('success');
            // Refresh products list
            window.dispatchEvent(new CustomEvent('zai:product-claimed'));
            fetchUserProducts();
          } else if (attempts >= maxAttempts) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setMintProgress('Minting is taking longer than expected. Your product will appear in your collection shortly.');
            setClaimStep('success');
            fetchUserProducts();
          } else {
            if (attempts > 5) setMintProgress('Confirming on-chain transaction...');
            if (attempts > 15) setMintProgress('Almost there, waiting for block confirmation...');
            if (attempts > 30) setMintProgress('Still processing — this can take a minute...');
          }
        } catch {
          // Polling errors are non-fatal, keep trying
        }
      }, 2000);

    } catch (err: any) {
      console.error('Claim failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to claim product';
      setClaimError(errMsg);
      setClaimStep('error');
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  };

  const closeClaimModal = () => {
    setShowClaimModal(false);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setClaimStep('list');
    setClaimingRwaId(null);
    setClaimError(null);
    setMintedNftId(null);
  };

  /* ───── Insurance ───── */

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

  /* ───── Helpers ───── */

  const activeInsurance = products.filter(p => p.insurance?.active).length;

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

  /* ───── Render ───── */

  if (isLoading && products.length === 0) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: C.gray }}>Loading your products...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div style={{
        marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, marginBottom: '0.4rem' }}>
            my collection
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem' }}>
            Your zai products
          </h1>
          <p style={{ color: C.gray, fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Claim products using your experience card or serial number to access exclusive benefits.
          </p>
        </div>
        <Button variant="primary" onClick={openClaimModal}>+ Claim Product</Button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex', gap: '2rem', marginBottom: '2rem',
        padding: '1.25rem 0', borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="2" width="4" height="14" rx="1" fill={C.black} />
            <rect x="7" y="5" width="4" height="11" rx="1" fill={C.black} />
            <rect x="13" y="8" width="4" height="8" rx="1" fill={C.black} />
          </svg>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 200, color: C.black, lineHeight: 1 }}>
              {products.length}
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, marginTop: '2px' }}>
              Products claimed
            </div>
          </div>
        </div>
        <div style={{ width: '1px', background: C.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: C.green,
            boxShadow: `0 0 0 3px rgba(76,175,125,0.2)`,
          }} />
          <div>
            <div style={{ fontSize: '20px', fontWeight: 200, color: C.black, lineHeight: 1 }}>
              {activeInsurance}
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, marginTop: '2px' }}>
              Insurance active
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd',
          color: C.red, marginBottom: '1.5rem', fontSize: '12px',
        }}>
          {error}
        </div>
      )}

      {/* Empty State */}
      {products.length === 0 && (
        <div style={{
          padding: '3.5rem 2rem', textAlign: 'center', border: `1px dashed ${C.border}`,
          background: C.surface, marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.3 }}>⛷</div>
          <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: 8, color: C.black }}>
            No products claimed yet
          </div>
          <p style={{ fontSize: '13px', color: C.gray, maxWidth: 360, margin: '0 auto 1.5rem', lineHeight: 1.8 }}>
            Tap your zai Experience Card or enter a serial number to register your first product.
          </p>
          <Button variant="primary" onClick={openClaimModal}>Claim your first product</Button>
        </div>
      )}

      {/* Product Cards */}
      {products.length > 0 && (
        <div style={{
          display: 'flex', gap: '1px', background: C.border, border: `1px solid ${C.border}`,
          overflowX: 'auto', marginBottom: '3rem',
        }}>
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              style={{
                background: '#fff', cursor: 'pointer', minWidth: '280px', flex: '0 0 280px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              <div style={{
                background: C.surface, height: 200, display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', position: 'relative',
              }}>
                {product.image ? (
                  <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ fontSize: '48px', opacity: 0.15 }}>⛷</div>
                )}
                <div style={{
                  position: 'absolute', top: '0.5rem', left: '0.5rem',
                  background: C.black, color: '#fff', fontSize: 9,
                  letterSpacing: '0.2em', textTransform: 'uppercase', padding: '3px 8px',
                }}>
                  Claimed
                </div>
                {product.insurance?.active && (
                  <div style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    background: C.green, color: '#fff', fontSize: 9,
                    letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
                  }}>
                    Insured
                  </div>
                )}
              </div>
              <div style={{ padding: '1rem 1.25rem' }}>
                {product.collection && (
                  <div style={{ fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: C.red, marginBottom: '0.3rem' }}>
                    {product.collection}
                  </div>
                )}
                <div style={{ fontSize: '14px', fontWeight: 500, color: C.black, marginBottom: '0.3rem' }}>
                  {product.name}
                </div>
                {product.price && (
                  <div style={{ fontSize: '12px', color: C.gray }}>
                    {product.price} {product.currency || 'CHF'}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How to claim */}
      <div style={{ background: C.black, padding: '2.5rem', border: '1px solid #2a2a2a' }}>
        <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, marginBottom: '0.75rem' }}>
          how to claim
        </div>
        <div style={{ fontSize: 'clamp(18px, 2.5vw, 24px)', fontWeight: 300, color: '#fff', marginBottom: '2rem', lineHeight: 1.3 }}>
          Register your zai product
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#2a2a2a' }}>
          {[
            { step: '01', title: 'Get your card', desc: 'Receive your zai Experience Card with your product purchase over CHF 500.' },
            { step: '02', title: 'Tap or enter serial', desc: 'Use NFC tap or manually enter the serial number from your experience card.' },
            { step: '03', title: 'Enjoy benefits', desc: 'Access free ski insurance, exclusive events, and community features.' },
          ].map((item) => (
            <div key={item.step} style={{ background: '#1a1a1a', padding: '1.5rem' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: C.red, marginBottom: '0.75rem', fontWeight: 500 }}>
                Step {item.step}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.7 }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── PRODUCT DETAIL MODAL ─── */}
      {selectedProduct && (
        <Modal isOpen={true} onClose={() => setSelectedProduct(null)} title={selectedProduct.name}>
          <div style={{ maxWidth: 600 }}>
            {selectedProduct.image && (
              <div
                onClick={() => setZoomImage({ src: selectedProduct.image!, alt: selectedProduct.name })}
                style={{
                  background: C.surface, marginBottom: '1.5rem', cursor: 'zoom-in',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  maxHeight: 360, overflow: 'hidden',
                }}
              >
                <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '100%', objectFit: 'contain', maxHeight: 360 }} />
              </div>
            )}

            {selectedProduct.collection && (
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, marginBottom: '0.4rem' }}>
                {selectedProduct.collection}
              </div>
            )}

            {selectedProduct.description && (
              <p style={{ fontSize: '13px', color: C.gray, lineHeight: 1.7, marginBottom: '1.5rem' }}>
                {selectedProduct.description}
              </p>
            )}

            {getSpecs(selectedProduct).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, marginBottom: '0.75rem' }}>
                  Specifications
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: C.border, border: `1px solid ${C.border}` }}>
                  {getSpecs(selectedProduct).map((spec, i) => (
                    <div key={i} style={{ background: C.surface, padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#999', marginBottom: 2 }}>
                        {spec.label}
                      </div>
                      <div style={{ fontSize: '13px', color: C.black }}>{spec.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              {selectedProduct.insurance?.active ? (
                <div style={{
                  padding: '10px 20px', background: '#f0faf4', border: `1px solid ${C.green}`,
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

      {/* ─── CLAIM MODAL (new flow) ─── */}
      <Modal isOpen={showClaimModal} onClose={closeClaimModal} title="Claim a Product">
        {/* Step 1: List of claimable products */}
        {claimStep === 'list' && (
          <div>
            {claimableLoading && (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '14px', color: C.gray }}>Loading available products...</div>
              </div>
            )}

            {claimableError && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '14px', color: C.red, marginBottom: '1rem' }}>{claimableError}</div>
                <Button variant="primary" onClick={fetchClaimableRwas}>Retry</Button>
              </div>
            )}

            {!claimableLoading && !claimableError && claimableRwas.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '1rem', opacity: 0.3 }}>⛷</div>
                <div style={{ fontSize: '14px', color: C.gray }}>No products available to claim right now.</div>
              </div>
            )}

            {!claimableLoading && claimableRwas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border }}>
                {claimableRwas.map((rwa) => (
                  <div
                    key={rwa.rwaId}
                    style={{
                      display: 'grid', gridTemplateColumns: '100px 1fr auto',
                      gap: '1rem', alignItems: 'center', background: '#fff',
                      padding: '1rem', transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.surface)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                  >
                    {/* Product image */}
                    <div style={{
                      width: '100px', height: '80px', background: C.surface,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', flexShrink: 0,
                    }}>
                      {rwa.image ? (
                        <img src={rwa.image} alt={rwa.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ fontSize: '28px', opacity: 0.15 }}>⛷</div>
                      )}
                    </div>

                    {/* Product info */}
                    <div style={{ minWidth: 0 }}>
                      {rwa.collection && (
                        <div style={{ fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase', color: C.red, marginBottom: '2px' }}>
                          {rwa.collection}
                        </div>
                      )}
                      <div style={{ fontSize: '14px', fontWeight: 500, color: C.black, marginBottom: '2px' }}>
                        {rwa.name}
                      </div>
                      {rwa.price && (
                        <div style={{ fontSize: '12px', color: C.gray }}>
                          {rwa.price} {rwa.currency || 'CHF'}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                        {rwa.unclaimedCount} available
                      </div>
                    </div>

                    {/* Claim button */}
                    <button
                      onClick={() => handleClaim(rwa)}
                      disabled={claimingRwaId !== null}
                      style={{
                        background: C.burgundy, color: '#fff', border: 'none',
                        padding: '10px 20px', fontSize: '10px', letterSpacing: '0.15em',
                        textTransform: 'uppercase', cursor: claimingRwaId ? 'not-allowed' : 'pointer',
                        fontFamily: C.font, opacity: claimingRwaId ? 0.5 : 1,
                        transition: 'all 0.2s', whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => { if (!claimingRwaId) e.currentTarget.style.background = '#9a2535'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = C.burgundy; }}
                    >
                      Claim
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Minting in progress */}
        {claimStep === 'minting' && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            {/* Spinning animation */}
            <div style={{ marginBottom: '1.5rem' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'spin 1.2s linear infinite' }}>
                <circle cx="24" cy="24" r="20" fill="none" stroke={C.border} strokeWidth="3" />
                <circle cx="24" cy="24" r="20" fill="none" stroke={C.red} strokeWidth="3"
                  strokeDasharray="80" strokeDashoffset="60" strokeLinecap="round" />
              </svg>
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 300, color: C.black, marginBottom: '0.75rem' }}>
              Minting your NFT
            </div>
            <div style={{ fontSize: '13px', color: C.gray, maxWidth: '360px', margin: '0 auto', lineHeight: 1.6 }}>
              {mintProgress}
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {claimStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', background: '#f0faf4',
              border: `2px solid ${C.green}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '28px', color: C.green,
            }}>
              ✓
            </div>
            <div style={{ fontSize: '18px', fontWeight: 300, marginBottom: '0.5rem', color: C.black }}>
              Product Claimed!
            </div>
            <div style={{ fontSize: '13px', color: C.gray, marginBottom: '2rem', lineHeight: 1.6 }}>
              Your NFT has been minted and will appear in your collection.
            </div>
            <Button variant="primary" onClick={closeClaimModal}>
              View My Products
            </Button>
          </div>
        )}

        {/* Step 4: Error */}
        {claimStep === 'error' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(200,16,46,0.06)',
              border: `2px solid ${C.red}`, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '28px', color: C.red,
            }}>
              !
            </div>
            <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '0.5rem', color: C.black }}>
              Claim Failed
            </div>
            <div style={{ fontSize: '13px', color: C.red, marginBottom: '2rem', lineHeight: 1.6 }}>
              {claimError || 'An unexpected error occurred.'}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={() => { setClaimStep('list'); setClaimError(null); setClaimingRwaId(null); }}
                style={{
                  padding: '10px 20px', border: `1px solid ${C.border}`, background: '#fff',
                  cursor: 'pointer', fontFamily: C.font, fontSize: '11px',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}
              >
                Back to Products
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── INSURANCE MODAL ─── */}
      <Modal isOpen={showInsuranceModal} onClose={() => setShowInsuranceModal(false)} title="Activate Insurance">
        {insuranceStep === 'loading' && (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '16px', color: C.gray }}>Activating insurance...</div>
          </div>
        )}

        {insuranceStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>✓</div>
            <div style={{ fontSize: '18px', fontWeight: 300, marginBottom: '1rem' }}>Insurance Activated!</div>
            {insuranceResult && (
              <div style={{ fontSize: '12px', color: C.gray }}>
                Certificate #{insuranceResult.certificateId} · Transaction #{insuranceResult.transactionId}
              </div>
            )}
          </div>
        )}

        {insuranceStep === 'error' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⚠</div>
            <div style={{ fontSize: '14px', color: C.red, marginBottom: '1rem' }}>{insuranceError}</div>
            <Button variant="primary" onClick={() => setInsuranceStep('form')}>Try Again</Button>
          </div>
        )}

        {insuranceStep === 'form' && (
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, marginBottom: '1rem' }}>
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

            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, marginBottom: '1rem' }}>
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

      {/* ─── ZOOM IMAGE MODAL ─── */}
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
