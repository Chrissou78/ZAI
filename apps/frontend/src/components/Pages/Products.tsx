import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  available: boolean;
  nft: { id: string; secret: string } | null; // kept for compat, always null with new mint endpoint
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

interface PendingMint {
  nftId: string;
  rwaName: string;
  startedAt: number;
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
  pureWhite: '#ffffff', mid: '#2e2e2e',
  font: "'Inter', sans-serif",
};

const bdr = `1px solid ${C.border}`;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: bdr, fontSize: '13px',
  boxSizing: 'border-box', fontFamily: C.font, borderRadius: 4,
};
const labelStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
  color: C.gray, marginBottom: '6px', display: 'block',
};
const lbl: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};

/* ───── Component ───── */

const Products: React.FC = () => {
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPage, setScrollPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ── Claim modal state ──
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimableRwas, setClaimableRwas] = useState<ClaimableRwa[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [claimableError, setClaimableError] = useState<string | null>(null);

  // ── Page-level pending mints (background minting) ──
  const [pendingMints, setPendingMints] = useState<PendingMint[]>([]);
  const mintPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /* ───── Inject keyframes ───── */
  useEffect(() => {
    const id = 'zai-spin-keyframe';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        @keyframes zai-spin { 100% { transform: rotate(360deg); } }
        @keyframes zai-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `;
      document.head.appendChild(style);
    }
  }, []);

  /* ───── Carousel scroll tracking ───── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const updatePages = () => {
      const cardWidth = 220 + 1;
      const visible = Math.floor(el.clientWidth / cardWidth);
      const totalCards = products.length + 1;
      const pages = Math.max(1, Math.ceil(totalCards / Math.max(1, visible)));
      setTotalPages(pages);
    };
    const handleScroll = () => {
      const cardWidth = 220 + 1;
      const visible = Math.floor(el.clientWidth / cardWidth);
      const page = Math.round(el.scrollLeft / (visible * cardWidth));
      setScrollPage(page);
    };
    updatePages();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updatePages);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updatePages);
    };
  }, [products.length]);

  const scrollToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 220 + 1;
    const visible = Math.floor(el.clientWidth / cardWidth);
    el.scrollTo({ left: page * visible * cardWidth, behavior: 'smooth' });
  };

  /* ───── Data fetching ───── */

  useEffect(() => {
    if (user?.id) fetchUserProducts();
  }, [user?.id]);

  const fetchUserProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get(`/products/user/${user?.id}`);
      if (response.data?.success) {
        setProducts(response.data.data || []);
        const ecCard = (response.data as any).experienceCard;
        if (ecCard) {
          localStorage.setItem('zai_experience_card', JSON.stringify(ecCard));
          window.dispatchEvent(new CustomEvent('zai:experience-card-updated'));
        } else {
          localStorage.removeItem('zai_experience_card');
        }
      }
    } catch (err: any) {
      console.error('Error fetching products:', err);
      setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /* ───── Background mint polling ───── */

  useEffect(() => {
    if (mintPollRef.current) {
      clearInterval(mintPollRef.current);
      mintPollRef.current = null;
    }

    if (pendingMints.length === 0) return;

    mintPollRef.current = setInterval(async () => {
      const stillPending: PendingMint[] = [];
      let anyCompleted = false;

      for (const mint of pendingMints) {
        try {
          const pollRes = await apiService.get(`/products/nft/${mint.nftId}`);
          const nftData = (pollRes.data as any)?.data;

          if (nftData?.isClaimed || nftData?.mintedTx) {
            anyCompleted = true;
          } else {
            if (Date.now() - mint.startedAt > 300000) {
              console.warn(`Mint timeout for ${mint.rwaName}`);
              anyCompleted = true;
            } else {
              stillPending.push(mint);
            }
          }
        } catch {
          stillPending.push(mint);
        }
      }

      if (anyCompleted) {
        fetchUserProducts();
      }

      setPendingMints(stillPending);
    }, 5000);

    return () => {
      if (mintPollRef.current) {
        clearInterval(mintPollRef.current);
        mintPollRef.current = null;
      }
    };
  }, [pendingMints, fetchUserProducts]);

  /* ───── Claimable RWAs fetch ───── */

  const fetchClaimableRwas = async () => {
    setClaimableLoading(true);
    setClaimableError(null);
    setClaimableRwas([]);
    try {
      const response = await apiService.get('/products/claimable');
      const payload = response.data as any;
      if (payload?.success) {
        setClaimableRwas(payload.data || []);
      } else {
        setClaimableError(payload?.error || 'Failed to load claimable products');
      }
    } catch (err: any) {
      console.error('Error fetching claimable RWAs:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to load claimable products. Please try again.';
      setClaimableError(msg);
    } finally {
      setClaimableLoading(false);
    }
  };

  /* ───── Claim flow (background minting via POST /rwa/{id}/mint) ───── */

  const openClaimModal = () => {
    setShowClaimModal(true);
    setClaimableError(null);
    setClaimableRwas([]);
    setClaimableLoading(true);
    setTimeout(() => fetchClaimableRwas(), 0);
  };

  const handleClaim = async (rwa: ClaimableRwa) => {
    setShowClaimModal(false);

    try {
      const response = await apiService.post('/products/claim-nft', {
        rwaId: rwa.rwaId,
      });

      const payload = response.data as any;
      if (!payload?.success) throw new Error(payload?.error || 'Claim request failed');

      const nftId: string = payload.nftId;

      setPendingMints(prev => [...prev, {
        nftId,
        rwaName: rwa.name,
        startedAt: Date.now(),
      }]);
    } catch (err: any) {
      console.error('Claim failed:', err);
      setShowClaimModal(true);
      setClaimableError(err?.message || 'Claim failed. Please try again.');
    }
  };

  /* ───── Insurance flow ───── */

  const openInsuranceModal = (product: Product) => {
    setInsuranceProduct(product);
    setShowInsuranceModal(true);
    setInsuranceStep('form');
    setInsuranceError(null);
    setInsuranceResult(null);
    setInsuranceForm(prev => ({
      ...prev,
      model: product.name || '',
      serial: product.serialNumber || '',
      price: product.priceRaw || '',
    }));
  };

  const handleInsuranceSubmit = async () => {
    if (!insuranceProduct) return;
    setInsuranceStep('loading');
    setInsuranceError(null);
    try {
      const response = await apiService.post(`/products/${insuranceProduct.id}/activate-insurance`, insuranceForm);
      const payload = response.data as any;
      if (!payload?.success) throw new Error(payload?.error || 'Insurance activation failed');
      setInsuranceResult({ certificateId: payload.certificateId, transactionId: payload.transactionId });
      setInsuranceStep('success');
      fetchUserProducts();
    } catch (err: any) {
      console.error('Insurance activation error:', err);
      setInsuranceError(err?.response?.data?.error || err?.message || 'Failed to activate insurance');
      setInsuranceStep('error');
    }
  };

  const updateInsuranceField = (field: keyof InsuranceFormData, value: string | number) => {
    setInsuranceForm(prev => ({ ...prev, [field]: value }));
  };

  /* ───── Stats ───── */

  const totalClaimed = products.length;
  const activeInsurances = products.filter(p => p.insurance?.active).length;

  /* ───── Loading state ───── */

  if (isLoading) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: C.font }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ height: 28, width: 200, background: C.surface, borderRadius: 4, marginBottom: 32, animation: 'zai-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                minWidth: 220, height: 300, borderRadius: 8, background: C.surface,
                animation: 'zai-pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ───── Error state ───── */

  if (error) {
    return (
      <div style={{ padding: '48px 32px', fontFamily: C.font }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
          <p style={{ fontSize: 15, color: C.gray, marginBottom: 24 }}>{error}</p>
          <Button onClick={fetchUserProducts}>Retry</Button>
        </div>
      </div>
    );
  }

  /* ───── Render ───── */

  return (
    <div style={{ padding: '48px 32px', fontFamily: C.font, color: C.black }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>My Products</h1>
        </div>

        {/* ── Pending Mints Banner ── */}
        {pendingMints.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 20px', marginBottom: 24,
            background: '#fef9e7', border: '1px solid #f0e68c',
            borderRadius: 8,
          }}>
            <div style={{
              width: 20, height: 20, border: `2px solid ${C.red}`,
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'zai-spin 0.8s linear infinite', flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              {pendingMints.length === 1 ? (
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Minting &ldquo;{pendingMints[0].rwaName}&rdquo;&hellip; This may take a moment.
                </span>
              ) : (
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  Minting {pendingMints.length} products&hellip; This may take a moment.
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Product Carousel ── */}
        <div
          ref={scrollRef}
          style={{
            display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8,
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
          }}
        >
          {/* Claim-a-Product card */}
          <div
            onClick={openClaimModal}
            style={{
              minWidth: 220, maxWidth: 220, height: 300,
              border: `2px dashed ${C.border}`, borderRadius: 8,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', scrollSnapAlign: 'start',
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.background = C.surface; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = 'transparent'; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: '50%', border: `2px solid ${C.red}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <span style={{ fontSize: 24, color: C.red, lineHeight: 1 }}>+</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.mid }}>Claim a Product</span>
            <span style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Redeem your NFC tag</span>
          </div>

          {/* Product cards */}
          {products.map(product => (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              style={{
                minWidth: 220, maxWidth: 220, borderRadius: 8,
                border: bdr, overflow: 'hidden', cursor: 'pointer',
                scrollSnapAlign: 'start', background: C.pureWhite,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ height: 160, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {product.image ? (
                  <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 40, color: C.border }}>&#x2B21;</span>
                )}
              </div>
              <div style={{ padding: '12px 14px' }}>
                {product.collection && (
                  <div style={{ ...lbl, marginBottom: 4 }}>{product.collection}</div>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {product.name}
                </div>
                {product.price && (
                  <div style={{ fontSize: 13, color: C.mid, marginBottom: 8 }}>
                    {product.currency || 'CHF'} {product.price}
                  </div>
                )}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 12,
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
                  background: product.insurance?.active ? '#e8f5e9' : C.surface,
                  color: product.insurance?.active ? C.green : C.gray,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: product.insurance?.active ? C.green : C.gray }} />
                  {product.insurance?.active ? 'INSURED' : 'NOT INSURED'}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Carousel dots ── */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => scrollToPage(i)}
                style={{
                  width: scrollPage === i ? 24 : 8, height: 8,
                  borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: scrollPage === i ? C.red : C.border,
                  transition: 'all 0.3s',
                }}
              />
            ))}
          </div>
        )}

        {/* ── Stats bar ── */}
        <div style={{
          display: 'flex', gap: 24, marginTop: 32, padding: '16px 20px',
          background: C.surface, borderRadius: 8,
        }}>
          <div>
            <div style={lbl}>Products Claimed</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{totalClaimed}</div>
          </div>
          <div style={{ width: 1, background: C.border }} />
          <div>
            <div style={lbl}>Active Insurances</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{activeInsurances}</div>
          </div>
        </div>

        {/* ────────── PRODUCT DETAIL MODAL ────────── */}
        {selectedProduct && (
          <Modal isOpen onClose={() => setSelectedProduct(null)} title={selectedProduct.name}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {selectedProduct.image && (
                <div
                  style={{ borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', maxHeight: 280 }}
                  onClick={() => setZoomImage({ src: selectedProduct.image!, alt: selectedProduct.name })}
                >
                  <img src={selectedProduct.image} alt={selectedProduct.name} style={{ width: '100%', objectFit: 'cover' }} />
                </div>
              )}

              {selectedProduct.collection && (
                <div style={lbl}>{selectedProduct.collection}</div>
              )}

              {selectedProduct.description && (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.mid, margin: 0 }}>
                  {selectedProduct.description}
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {selectedProduct.price && (
                  <div>
                    <div style={lbl}>Price</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedProduct.currency || 'CHF'} {selectedProduct.price}</div>
                  </div>
                )}
                {selectedProduct.materials && (
                  <div>
                    <div style={lbl}>Materials</div>
                    <div style={{ fontSize: 13 }}>{selectedProduct.materials}</div>
                  </div>
                )}
                {selectedProduct.serialNumber && (
                  <div>
                    <div style={lbl}>Serial</div>
                    <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{selectedProduct.serialNumber}</div>
                  </div>
                )}
                {selectedProduct.claimedAt && (
                  <div>
                    <div style={lbl}>Claimed</div>
                    <div style={{ fontSize: 13 }}>{new Date(selectedProduct.claimedAt).toLocaleDateString()}</div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '14px 16px', borderRadius: 8, border: bdr,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={lbl}>Insurance</div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 13, fontWeight: 600, marginTop: 4,
                    color: selectedProduct.insurance?.active ? C.green : C.gray,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: selectedProduct.insurance?.active ? C.green : C.gray,
                    }} />
                    {selectedProduct.insurance?.active ? 'Active' : 'Not Active'}
                  </div>
                  {selectedProduct.insurance?.certificateId && (
                    <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                      Certificate #{selectedProduct.insurance.certificateId}
                    </div>
                  )}
                </div>
                {selectedProduct.hasInsurance && !selectedProduct.insurance?.active && (
                  <Button onClick={() => { setSelectedProduct(null); openInsuranceModal(selectedProduct); }}>
                    Activate Insurance
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* ────────── CLAIM MODAL ────────── */}
        {showClaimModal && (
          <Modal isOpen onClose={() => setShowClaimModal(false)} title="Claim a Product">
            <div style={{ minHeight: 200 }}>
              {claimableLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                  <div style={{
                    width: 32, height: 32, border: `3px solid ${C.border}`,
                    borderTopColor: C.red, borderRadius: '50%',
                    animation: 'zai-spin 0.8s linear infinite', marginBottom: 16,
                  }} />
                  <span style={{ fontSize: 13, color: C.gray }}>Loading claimable products&hellip;</span>
                </div>
              ) : claimableError ? (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p style={{ color: C.red, fontSize: 14, marginBottom: 16 }}>{claimableError}</p>
                  <Button onClick={() => { setClaimableError(null); fetchClaimableRwas(); }}>Try Again</Button>
                </div>
              ) : claimableRwas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: C.gray }}>
                  <p style={{ fontSize: 14 }}>No claimable products available right now.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420, overflowY: 'auto' }}>
                  {claimableRwas.map(rwa => {
                    const isMinting = pendingMints.some(m => m.rwaName === rwa.name);
                    return (
                      <div
                        key={rwa.rwaId}
                        style={{
                          display: 'flex', gap: 14, padding: 12,
                          border: bdr, borderRadius: 8,
                          opacity: rwa.available ? 1 : 0.55,
                          background: C.pureWhite,
                        }}
                      >
                        {/* Thumbnail */}
                        <div style={{
                          width: 64, height: 64, borderRadius: 6, overflow: 'hidden',
                          background: C.surface, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {rwa.image ? (
                            <img src={rwa.image} alt={rwa.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: 24, color: C.border }}>&#x2B21;</span>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {rwa.name}
                          </div>
                          {rwa.collection && (
                            <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{rwa.collection}</div>
                          )}
                          <div style={{ fontSize: 12, color: C.mid }}>
                            {rwa.available ? (
                              <span style={{ color: C.green }}>Available</span>
                            ) : (
                              <span style={{ color: C.gray }}>Out of stock</span>
                            )}
                            {rwa.price && <span style={{ marginLeft: 8 }}>{rwa.currency || 'CHF'} {rwa.price}</span>}
                          </div>
                        </div>

                        {/* Claim button */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          <button
                            disabled={!rwa.available || isMinting}
                            onClick={() => handleClaim(rwa)}
                            style={{
                              padding: '8px 16px', fontSize: 12, fontWeight: 600,
                              border: 'none', borderRadius: 6,
                              cursor: rwa.available && !isMinting ? 'pointer' : 'default',
                              background: rwa.available ? C.red : C.border,
                              color: rwa.available ? C.pureWhite : C.gray,
                              opacity: isMinting ? 0.5 : 1,
                              fontFamily: C.font, letterSpacing: '0.05em',
                            }}
                          >
                            {isMinting ? 'Minting\u2026' : rwa.available ? 'Claim' : 'Unavailable'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Modal>
        )}

        {/* ────────── INSURANCE MODAL ────────── */}
        {showInsuranceModal && insuranceProduct && (
          <Modal isOpen onClose={() => setShowInsuranceModal(false)} title="Activate Insurance">
            {insuranceStep === 'form' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 480, overflowY: 'auto' }}>
                <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                  Fill in the details below to activate insurance for <strong>{insuranceProduct.name}</strong>.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Salutation</label>
                    <select
                      value={insuranceForm.salutation}
                      onChange={e => updateInsuranceField('salutation', Number(e.target.value))}
                      style={inputStyle}
                    >
                      {SALUTATIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Language</label>
                    <select value={insuranceForm.language} onChange={e => updateInsuranceField('language', e.target.value)} style={inputStyle}>
                      <option value="en">English</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Fran&ccedil;ais</option>
                      <option value="it">Italiano</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>First Name</label>
                    <input style={inputStyle} value={insuranceForm.firstname} onChange={e => updateInsuranceField('firstname', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name</label>
                    <input style={inputStyle} value={insuranceForm.lastname} onChange={e => updateInsuranceField('lastname', e.target.value)} />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Address</label>
                  <input style={inputStyle} value={insuranceForm.address1} onChange={e => updateInsuranceField('address1', e.target.value)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Zip</label>
                    <input style={inputStyle} value={insuranceForm.zip} onChange={e => updateInsuranceField('zip', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>City</label>
                    <input style={inputStyle} value={insuranceForm.city} onChange={e => updateInsuranceField('city', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Country</label>
                    <input style={inputStyle} value={insuranceForm.country} onChange={e => updateInsuranceField('country', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <input style={inputStyle} type="email" value={insuranceForm.email} onChange={e => updateInsuranceField('email', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} type="tel" value={insuranceForm.phone} onChange={e => updateInsuranceField('phone', e.target.value)} />
                  </div>
                </div>

                <div style={{ borderTop: bdr, paddingTop: 16, marginTop: 4 }}>
                  <div style={{ ...lbl, marginBottom: 12 }}>Device Information</div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Device Type</label>
                    <select value={insuranceForm.deviceType} onChange={e => updateInsuranceField('deviceType', Number(e.target.value))} style={inputStyle}>
                      {DEVICE_TYPES.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Make</label>
                    <input style={inputStyle} value={insuranceForm.makeName} readOnly />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Model</label>
                    <input style={inputStyle} value={insuranceForm.model} onChange={e => updateInsuranceField('model', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Serial Number</label>
                    <input style={inputStyle} value={insuranceForm.serial} onChange={e => updateInsuranceField('serial', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Price (CHF)</label>
                    <input style={inputStyle} type="number" value={insuranceForm.price} onChange={e => updateInsuranceField('price', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Length (cm)</label>
                    <input style={inputStyle} type="number" value={insuranceForm.length} onChange={e => updateInsuranceField('length', e.target.value)} />
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Date</label>
                    <input style={inputStyle} type="date" value={insuranceForm.purchasingdate} onChange={e => updateInsuranceField('purchasingdate', e.target.value)} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                  <Button onClick={() => setShowInsuranceModal(false)}>Cancel</Button>
                  <Button onClick={handleInsuranceSubmit}>Activate Insurance</Button>
                </div>
              </div>
            )}

            {insuranceStep === 'loading' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
                <div style={{
                  width: 40, height: 40, border: `3px solid ${C.border}`,
                  borderTopColor: C.red, borderRadius: '50%',
                  animation: 'zai-spin 0.8s linear infinite', marginBottom: 16,
                }} />
                <span style={{ fontSize: 14, color: C.mid }}>Activating insurance&hellip;</span>
                <span style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>This may take a moment</span>
              </div>
            )}

            {insuranceStep === 'success' && insuranceResult && (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2713;</div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Insurance Activated!</p>
                <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: '16px 24px', background: C.surface, borderRadius: 8 }}>
                  <div><span style={lbl}>Certificate ID: </span><span style={{ fontFamily: 'monospace' }}>{insuranceResult.certificateId}</span></div>
                  <div><span style={lbl}>Transaction ID: </span><span style={{ fontFamily: 'monospace' }}>{insuranceResult.transactionId}</span></div>
                </div>
                <div style={{ marginTop: 24 }}>
                  <Button onClick={() => setShowInsuranceModal(false)}>Done</Button>
                </div>
              </div>
            )}

            {insuranceStep === 'error' && (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2715;</div>
                <p style={{ color: C.red, fontSize: 14, marginBottom: 16 }}>{insuranceError}</p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <Button onClick={() => setInsuranceStep('form')}>Try Again</Button>
                  <Button onClick={() => setShowInsuranceModal(false)}>Close</Button>
                </div>
              </div>
            )}
          </Modal>
        )}

        {/* ────────── ZOOM IMAGE MODAL ────────── */}
        {zoomImage && (
          <Modal isOpen onClose={() => setZoomImage(null)} title="">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={zoomImage.src} alt={zoomImage.alt} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
            </div>
          </Modal>
        )}

      </div>
    </div>
  );
};

export default Products;
