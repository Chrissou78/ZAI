import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { CameraIcon, UploadIcon, SmartphoneIcon } from '../Icons/ClaimIcons';
import ProductPicker from '../Common/ProductPicker';

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

interface PendingClaimRequest {
  id: string;
  status: string;
  productName: string;
  createdAt: string;
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
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E', burgundy: '#7D1E2C',
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
const sectionLabel: React.CSSProperties = {
  fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
  color: C.red, fontWeight: 500, fontFamily: C.font,
};

/* ── Carousel side-arrow styles ── */
const sideArrowBase: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 10,
  width: 36,
  height: 36,
  borderRadius: '50%',
  border: 'none',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 18,
  color: C.mid,
  transition: 'all 0.2s',
  padding: 0,
};

/* ───── Helpers ───── */

const formatClaimedDate = (d?: string | null): string => {
  if (!d) return 'Unknown';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return 'Unknown';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ── Product category detection ──
   The category comes straight from the RWA metadata (data.collection.value),
   which the route already passes through as product.collection. That value is
   the source of truth: "Ski", "Apparel" or "Accessory". We classify from it
   first and only fall back to keyword guessing when collection is empty. */
type Category = 'ski' | 'apparel' | 'accessory';

const SKI_KEYWORDS = ['ski', 'alpine', 'cross-country', 'freeride', 'slalom', 'race', 'touring'];
const ACCESSORY_KEYWORDS = ['accessor', 'pole', 'bag', 'helmet', 'goggle', 'wax', 'strap', 'cover'];

const getCategory = (name?: string, collection?: string, type?: string): Category => {
  const col = (collection || '').trim().toLowerCase();
  if (col.includes('ski')) return 'ski';
  if (col.includes('accessor')) return 'accessory';
  if (col.includes('apparel')) return 'apparel';

  // No usable collection value — fall back to keyword guessing.
  const text = `${name || ''} ${collection || ''} ${type || ''}`.toLowerCase();
  if (SKI_KEYWORDS.some(kw => text.includes(kw))) return 'ski';
  if (ACCESSORY_KEYWORDS.some(kw => text.includes(kw))) return 'accessory';
  return 'apparel';
};

// Insurance is only available for ski products.
const categorySupportsInsurance = (cat: Category) => cat === 'ski';

const CATEGORY_META: Record<Category, { label: string; badgeBg: string }> = {
  ski:       { label: 'SKI',       badgeBg: 'rgba(10,10,10,0.78)' },
  apparel:   { label: 'APPAREL',   badgeBg: 'rgba(106,106,106,0.78)' },
  accessory: { label: 'ACCESSORY', badgeBg: 'rgba(122,34,46,0.82)' },
};

const CATEGORY_ORDER: Category[] = ['ski', 'apparel', 'accessory'];

const MAX_GRID_CARDS = 3;

/* ───── Card sub-components (module scope = stable identity, so background
   refreshes re-render in place instead of remounting and reloading images) ───── */

const ClaimCard: React.FC<{ onClaim: () => void; style?: React.CSSProperties }> = ({ onClaim, style: extraStyle }) => (
  <div
    onClick={onClaim}
    style={{
      height: 300,
      border: `2px dashed ${C.border}`, borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
      ...extraStyle,
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
    <span style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Scan or upload your receipt</span>
  </div>
);

const ProductCard: React.FC<{
  product: Product;
  onSelect: (p: Product) => void;
  onActivateInsurance: (p: Product) => void;
  style?: React.CSSProperties;
}> = ({ product, onSelect, onActivateInsurance, style: extraStyle }) => {
  const category = getCategory(product.name, product.collection, product.type);
  const cat = CATEGORY_META[category];
  const canInsure = categorySupportsInsurance(category);

  return (
    <div
      style={{
        borderRadius: 8, border: bdr, overflow: 'hidden',
        background: C.pureWhite, transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
        ...extraStyle,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div
        onClick={() => onSelect(product)}
        style={{ height: 160, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
      >
        {product.image ? (
          <img src={product.image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 40, color: C.border }}>&#x2B21;</span>
        )}
        {/* Category badge */}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: cat.badgeBg,
          color: '#fff', fontSize: 8, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          padding: '3px 8px', borderRadius: 2,
          backdropFilter: 'blur(4px)',
        }}>
          {cat.label}
        </div>
      </div>

      <div onClick={() => onSelect(product)} style={{ padding: '12px 14px', flex: 1, cursor: 'pointer' }}>
        {product.collection && (
          <div style={{ ...lbl, marginBottom: 4 }}>{product.collection}</div>
        )}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </div>
        {(product.price || product.priceRaw) && (
          <div style={{ fontSize: 13, color: C.mid, marginBottom: 8 }}>
            {product.currency || 'CHF'} {product.price && product.price !== '0' ? product.price : product.priceRaw || product.price}
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
          {product.insurance?.active ? 'INSURED' : ''}
        </div>
      </div>

      <div style={{ padding: '0 14px 12px' }}>
        {canInsure ? (
          !product.insurance?.active ? (
            <div
              onClick={(e) => { e.stopPropagation(); onActivateInsurance(product); }}
              style={{
                paddingTop: 10, borderTop: bdr, cursor: 'pointer',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.05em',
                color: C.mid, display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.red)}
              onMouseLeave={e => (e.currentTarget.style.color = C.mid)}
            >
              ACTIVATE INSURANCE <span style={{ fontSize: 14 }}>→</span>
            </div>
          ) : (
            <div style={{
              paddingTop: 10, borderTop: bdr,
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: C.green,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              INSURANCE ACTIVE <span style={{ fontSize: 14 }}>✓</span>
            </div>
          )
        ) : (
          <div style={{
            paddingTop: 10, borderTop: bdr,
            fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: C.gray,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
            {cat.label}
          </div>
        )}
      </div>
    </div>
  );
};

/* ───── Component ───── */

const Products: React.FC = () => {
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPage, setScrollPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Old claim modal (kept but no longer triggered by default)
  const [claimableRwas, setClaimableRwas] = useState<ClaimableRwa[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [claimableError, setClaimableError] = useState<string | null>(null);

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

  // ── NEW: Receipt-based claim flow ──
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptProductName, setReceiptProductName] = useState('');
  const [receiptProductId, setReceiptProductId] = useState('');
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptSuccess, setReceiptSuccess] = useState(false);
  const [pendingClaimRequests, setPendingClaimRequests] = useState<PendingClaimRequest[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [receiptCid, setReceiptCid] = useState<string | null>(null);
  const [receiptKey, setReceiptKey] = useState<string | null>(null);

  const [showQrLink, setShowQrLink] = useState(false);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const [qrPolling, setQrPolling] = useState(false);
  const [isMobileDevice] = useState(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const uploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledValidatedRef = useRef<Set<string>>(new Set());

  const [allClaims, setAllClaims] = useState<any[]>([]);
  const [dismissedClaimIds, setDismissedClaimIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('zai_dismissed_claims');
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zai_dismissed_claims', JSON.stringify([...dismissedClaimIds]));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [dismissedClaimIds]);

  // Count products per category and apply the active filter. The carousel and
  // grid render the filtered list, so switching tabs re-lays out the cards.
  const categoryCounts = products.reduce(
    (acc, p) => {
      acc[getCategory(p.name, p.collection, p.type)] += 1;
      return acc;
    },
    { ski: 0, apparel: 0, accessory: 0 } as Record<Category, number>
  );

  const visibleProducts =
    activeCategory === 'all'
      ? products
      : products.filter(p => getCategory(p.name, p.collection, p.type) === activeCategory);

  const needsCarousel = visibleProducts.length > MAX_GRID_CARDS;

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

  /* ── Scroll tracking for carousel ── */
  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    if (!needsCarousel) return;
    const el = scrollRef.current;
    if (!el) return;

    const updatePages = () => {
      const cardWidth = 220 + 16;
      const visible = Math.max(1, Math.floor(el.clientWidth / cardWidth));
      const totalCards = visibleProducts.length + 1;
      const pages = Math.max(1, Math.ceil(totalCards / visible));
      setTotalPages(pages);
      updateScrollButtons();
    };
    const handleScroll = () => {
      const cardWidth = 220 + 16;
      const visible = Math.max(1, Math.floor(el.clientWidth / cardWidth));
      const page = Math.round(el.scrollLeft / (visible * cardWidth));
      setScrollPage(page);
      updateScrollButtons();
    };
    updatePages();
    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updatePages);
    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updatePages);
    };
  }, [visibleProducts.length, activeCategory, needsCarousel, updateScrollButtons]);

  // Reset carousel position when the category filter changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    setScrollPage(0);
  }, [activeCategory]);

  const scrollToPage = (page: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 220 + 16;
    const visible = Math.max(1, Math.floor(el.clientWidth / cardWidth));
    el.scrollTo({ left: page * visible * cardWidth, behavior: 'smooth' });
  };

  const scrollByCards = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 220 + 16;
    el.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
  };

  useEffect(() => {
    if (user?.id) fetchUserProducts();
  }, [user?.id]);

  const fetchUserProducts = useCallback(async (opts?: { background?: boolean }) => {
    const background = opts?.background === true;
    try {
      if (!background) setIsLoading(true);
      setError(null);
      const response = await apiService.get(`/products/user/${user?.id}`);
      if (response.data?.success) {
        setProducts(response.data.data || []);

        if ((response.data.data || []).length > 0) {
          window.dispatchEvent(new CustomEvent('zai:product-claimed'));
        }

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
      if (!background) setError(err.response?.data?.error || 'Failed to load products');
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [user?.id]);

  // ── Fetch user's pending claim requests ──
  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const fetchClaimRequests = async () => {
      try {
        const res = await apiService.get('/products/claim-requests?mine=true');
        if (res.data?.success && active) {
          const claims = (res.data.data || []) as any[];

          setPendingClaimRequests(
            claims
              .filter((c: any) => c.status === 'pending' || c.status === 'minting')
              .map((c: any) => ({
                id: c.id,
                status: c.status,
                productName: c.productName || '',
                createdAt: c.createdAt,
              }))
          );

          setAllClaims(claims);

          const newlyValidated = claims.some(
            (c: any) => c.status === 'validated' && !handledValidatedRef.current.has(c.id)
          );
          if (newlyValidated) {
            claims
              .filter((c: any) => c.status === 'validated')
              .forEach((c: any) => handledValidatedRef.current.add(c.id));
            fetchUserProducts({ background: true });
          }
        }
      } catch {
        // silently fail
      }
    };

    fetchClaimRequests();
    const interval = setInterval(fetchClaimRequests, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [user?.id]);

  const handleUsePhone = async () => {
    try {
      const res = await apiService.post('/products/claim-upload/create-token');
      const payload = res.data as any;
      if (payload?.success && payload.token) {
        setUploadToken(payload.token);
        setShowQrLink(true);
        setQrPolling(true);
      } else {
        setReceiptError('Failed to generate upload link');
      }
    } catch (err: any) {
      setReceiptError('Failed to generate upload link');
    }
  };

  // Poll for phone upload
  useEffect(() => {
    if (!qrPolling || !uploadToken) return;
    if (uploadPollRef.current) clearInterval(uploadPollRef.current);

    uploadPollRef.current = setInterval(async () => {
      try {
        const res = await apiService.get(`/products/claim-upload/${uploadToken}/status`);
        const data = res.data as any;
        if (data?.status === 'completed' && data?.proofImageCid) {
          setReceiptImage('phone-uploaded');
          setReceiptCid(data.proofImageCid || null);
          setReceiptKey(data.encryptionKey || null);
          setShowQrLink(false);
          setQrPolling(false);
          if (uploadPollRef.current) clearInterval(uploadPollRef.current);
        }
      } catch (err: any) {
        if (err?.response?.status === 410) {
          setQrPolling(false);
          setReceiptError('Upload link expired. Please try again.');
          setShowQrLink(false);
          if (uploadPollRef.current) clearInterval(uploadPollRef.current);
        }
      }
    }, 2000);

    return () => {
      if (uploadPollRef.current) { clearInterval(uploadPollRef.current); uploadPollRef.current = null; }
    };
  }, [qrPolling, uploadToken]);

  // ── Fetch available RWA products for the product picker ──
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
      const msg = err?.response?.data?.error || err?.message || 'Failed to load claimable products. Please try again.';
      setClaimableError(msg);
    } finally {
      setClaimableLoading(false);
    }
  };

  // ── NEW: Receipt-based claim handlers ──
  const openReceiptModal = () => {
    setShowReceiptModal(true);
    setReceiptImage(null);
    setReceiptCid(null);
    setReceiptKey(null);
    setReceiptProductName('');
    setReceiptProductId('');
    setIsCustomProduct(false);
    setReceiptError(null);
    setReceiptSuccess(false);
    setReceiptSubmitting(false);
    setClaimableError(null);
    setClaimableLoading(true);
    setTimeout(() => fetchClaimableRwas(), 0);
  };

  const handleReceiptCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setReceiptError('Image must be under 8 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
      setReceiptError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptSubmit = async () => {
    if (!receiptImage && !receiptCid) return;
    setReceiptSubmitting(true);
    setReceiptError(null);
    try {
      const body: any = { productName: receiptProductName };
      if (receiptProductId) body.productId = receiptProductId;
      if (receiptCid) {
        body.preUploadedCid = receiptCid;
        body.preUploadedKey = receiptKey;
      } else {
        body.proofImage = receiptImage;
      }
      const res = await apiService.post('/products/claim-request', body);
      const payload = res.data as any;
      if (payload?.success) {
        setReceiptSuccess(true);
        setPendingClaimRequests(prev => [{
          id: payload.claimId || '',
          status: 'pending',
          productName: receiptProductName,
          createdAt: new Date().toISOString(),
        }, ...prev]);
      } else {
        setReceiptError(payload?.error || 'Submission failed');
      }
    } catch (err: any) {
      setReceiptError(err?.response?.data?.error || err?.message || 'Submission failed');
    } finally {
      setReceiptSubmitting(false);
    }
  };

  // ── Insurance ──
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
      setInsuranceError(err?.response?.data?.error || err?.message || 'Failed to activate insurance');
      setInsuranceStep('error');
    }
  };

  const updateInsuranceField = (field: keyof InsuranceFormData, value: string | number) => {
    setInsuranceForm(prev => ({ ...prev, [field]: value }));
  };

  const totalClaimed = products.length;
  const activeInsurances = products.filter(p => p.insurance?.active).length;

  if (isLoading) {
    return (
      <div style={{ padding: '48px 48px 80px', fontFamily: C.font }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ height: 28, width: 200, background: C.surface, borderRadius: 4, marginBottom: 32, animation: 'zai-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 16, overflow: 'hidden' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                flex: '1 1 0%', height: 300, borderRadius: 8, background: C.surface,
                animation: 'zai-pulse 1.5s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '48px 48px 80px', fontFamily: C.font }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
          <p style={{ fontSize: 15, color: C.gray, marginBottom: 24 }}>{error}</p>
          <Button onClick={() => fetchUserProducts()}>Retry</Button>
        </div>
      </div>
    );
  }

  /* ── Helper: is proof ready to submit? ── */
  const hasProof = !!(receiptImage || receiptCid);

  /* ───── Render ───── */

  return (
    <div style={{ padding: '48px 48px 0', fontFamily: C.font, color: C.black }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ══════ HEADER ══════ */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: bdr,
        }}>
          <div>
            <div style={sectionLabel}>my collection</div>
            <h1 style={{
              fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300,
              lineHeight: 1.15, margin: '6px 0 6px', color: C.black,
            }}>
              Your zai Collection
            </h1>
            <p style={{ color: C.gray, fontSize: '13px', margin: 0, maxWidth: 480 }}>
              Claim products by uploading your proof of purchase. An admin will validate your claim and your product will appear here.
            </p>
          </div>
          <button
            onClick={openReceiptModal}
            style={{
              background: C.red, color: '#fff', border: 'none',
              padding: '14px 28px', fontSize: '10px', letterSpacing: '0.2em',
              textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.font,
              fontWeight: 500, transition: 'background 0.2s', whiteSpace: 'nowrap',
              marginTop: '0.5rem', borderRadius: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.burgundy)}
            onMouseLeave={e => (e.currentTarget.style.background = C.red)}
          >
            + Claim Product
          </button>
        </div>

        {/* ══════ CLAIM NOTIFICATIONS ══════ */}
        {allClaims.filter(c => !dismissedClaimIds.has(c.id)).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>

            {/* Pending */}
            {allClaims.filter(c => c.status === 'pending' && !dismissedClaimIds.has(c.id)).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(255,180,0,0.10)', border: '1px solid rgba(255,180,0,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
                    Claim pending review
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {c.productName || 'Product'} — submitted {formatClaimedDate(c.createdAt)}
                  </div>
                </div>
              </div>
            ))}

            {/* Minting */}
            {allClaims.filter(c => c.status === 'minting' && !dismissedClaimIds.has(c.id)).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(100,160,255,0.10)', border: '1px solid rgba(100,160,255,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⛏️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
                    Minting your product…
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {c.productName || 'Product'} — your NFT is being created
                  </div>
                </div>
              </div>
            ))}

            {/* Validated */}
            {allClaims.filter(c => c.status === 'validated' && !dismissedClaimIds.has(c.id)).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(76,175,125,0.10)', border: '1px solid rgba(76,175,125,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>
                    Product added to your collection!
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {c.productName || 'Product'} — validated {c.reviewedAt ? new Date(c.reviewedAt).toLocaleDateString() : ''}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, c.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            ))}

            {/* Rejected */}
            {allClaims.filter(c => c.status === 'rejected' && !dismissedClaimIds.has(c.id)).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(122,34,46,0.10)', border: '1px solid rgba(122,34,46,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#d44' }}>
                    Claim rejected
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {c.productName || 'Product'}
                    {c.adminNote ? ` — ${c.adminNote}` : ' — contact support for details'}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, c.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            ))}

            {/* Error */}
            {allClaims.filter(c => c.status === 'error' && !dismissedClaimIds.has(c.id)).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(255,100,0,0.10)', border: '1px solid rgba(255,100,0,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ff6400' }}>
                    Minting error — admin notified
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {c.productName || 'Product'} — {c.adminNote || 'an error occurred during minting'}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, c.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            ))}

          </div>
        )}

        {/* ══════ STATS BAR ══════ */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          border: bdr, marginBottom: 32,
        }}>
          <div style={{ padding: '20px 24px', borderRight: bdr, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: C.mid }}>■</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 300, color: C.black }}>{totalClaimed}</div>
              <div style={lbl}>Products Claimed</div>
            </div>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: C.green }}>●</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 300, color: C.black }}>{activeInsurances}</div>
              <div style={lbl}>Insurance Active</div>
            </div>
          </div>
        </div>

        {/* ══════ COLLECTION LABEL ══════ */}
        <div style={sectionLabel}>your collection</div>
        <div style={{ height: 16 }} />

        {/* ══════ CATEGORY FILTER ══════ */}
        {products.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'all' as const, label: 'All', count: products.length },
              ...CATEGORY_ORDER
                .filter(c => categoryCounts[c] > 0)
                .map(c => ({ key: c, label: CATEGORY_META[c].label, count: categoryCounts[c] })),
            ]).map(tab => {
              const active = activeCategory === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveCategory(tab.key)}
                  style={{
                    padding: '6px 14px', borderRadius: 16, cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                    textTransform: 'uppercase', fontFamily: C.font,
                    border: active ? `1px solid ${C.black}` : bdr,
                    background: active ? C.black : C.pureWhite,
                    color: active ? '#fff' : C.mid,
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                  }}
                >
                  {tab.label}
                  <span style={{ marginLeft: 6, opacity: 0.6 }}>{tab.count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ══════ PRODUCT CARDS — grid or carousel ══════ */}
        {!needsCarousel ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${visibleProducts.length + 1}, 1fr)`,
            gap: 16,
          }}>
            <ClaimCard onClaim={openReceiptModal} />
            {visibleProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={setSelectedProduct}
                onActivateInsurance={openInsuranceModal}
              />
            ))}
          </div>
        ) : (
          /* ── Carousel with side arrows ── */
          <div style={{ position: 'relative' }}>

            {/* LEFT ARROW */}
            {canScrollLeft && (
              <button
                onClick={() => scrollByCards(-1)}
                style={{ ...sideArrowBase, left: -18 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                aria-label="Scroll left"
              >
                ‹
              </button>
            )}

            {/* RIGHT ARROW */}
            {canScrollRight && (
              <button
                onClick={() => scrollByCards(1)}
                style={{ ...sideArrowBase, right: -18 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                aria-label="Scroll right"
              >
                ›
              </button>
            )}

            {/* SCROLLABLE TRACK */}
            <div
              ref={scrollRef}
              style={{
                display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8,
                scrollSnapType: 'x mandatory', scrollbarWidth: 'none',
              }}
            >
              <ClaimCard onClaim={openReceiptModal} style={{ minWidth: 220, maxWidth: 220, scrollSnapAlign: 'start', flexShrink: 0 }} />
              {visibleProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={setSelectedProduct}
                  onActivateInsurance={openInsuranceModal}
                  style={{ minWidth: 220, maxWidth: 220, scrollSnapAlign: 'start', flexShrink: 0 }}
                />
              ))}
            </div>

            {/* Pagination dots */}
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
                      transition: 'all 0.3s', padding: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ BLACK FOOTER — "How to claim" ══════ */}
        <div style={{
          marginTop: 48,
          background: C.black,
          color: '#fff',
          padding: '48px 40px 56px',
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: C.gray, marginBottom: 8,
          }}>
            how to claim
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 300, margin: '0 0 40px', color: '#fff' }}>
            Register your zai product
          </h2>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1px', background: '#2a2a2a',
          }}>
            {[
              {
                step: '01',
                title: 'Upload your receipt',
                desc: 'Take a photo of your purchase receipt or upload an image of your proof of purchase.',
              },
              {
                step: '02',
                title: 'Admin review',
                desc: 'Our team reviews your proof of purchase and validates your claim.',
              },
              {
                step: '03',
                title: 'Enjoy benefits',
                desc: 'Once validated, your product NFT is minted and you can access insurance, events, and community.',
              },
            ].map((item) => (
              <div key={item.step} style={{
                background: C.black, padding: '32px 28px',
              }}>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: C.red, marginBottom: 12, fontWeight: 600,
                }}>
                  step {item.step}
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', marginBottom: 8 }}>
                  {item.title}
                </div>
                <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.6 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>{/* end maxWidth: 1100 container */}

      {/* ════════════ PRODUCT DETAIL MODAL ════════════ */}
      {selectedProduct && (() => {
        const detailCategory = getCategory(selectedProduct.name, selectedProduct.collection, selectedProduct.type);
        const detailMeta = CATEGORY_META[detailCategory];
        const detailIsSki = detailCategory === 'ski';
        return (
          <Modal isOpen onClose={() => setSelectedProduct(null)} title={selectedProduct.name}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {selectedProduct.image && (
                <div
                  style={{
                    borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in',
                    background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    aspectRatio: '1 / 1',
                  }}
                  onClick={() => setZoomImage({ src: selectedProduct.image!, alt: selectedProduct.name })}
                >
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
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
                <div>
                  <div style={lbl}>Category</div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 600,
                    color: detailIsSki ? C.mid : C.gray,
                  }}>
                    {detailIsSki ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="2" x2="12" y2="22"/>
                        </svg>
                        {detailMeta.label}
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                        </svg>
                        {detailMeta.label}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Insurance section — only show for ski products */}
              {categorySupportsInsurance(detailCategory) && (
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
                  {!selectedProduct.insurance?.active && (
                    <button
                      onClick={() => { setSelectedProduct(null); openInsuranceModal(selectedProduct); }}
                      style={{
                        background: C.black, color: '#fff', border: 'none',
                        padding: '10px 20px', fontSize: 11, fontWeight: 600,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        cursor: 'pointer', fontFamily: C.font, borderRadius: 4,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                      onMouseLeave={e => (e.currentTarget.style.background = C.black)}
                    >
                      Activate Insurance
                    </button>
                  )}
                </div>
              )}

              {/* No-insurance note — apparel and accessory */}
              {!categorySupportsInsurance(detailCategory) && (
                <div style={{
                  padding: '12px 16px', borderRadius: 8, border: bdr,
                  background: C.surface,
                }}>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    Insurance is available for ski products only. This item is registered as {detailCategory === 'accessory' ? 'an accessory' : 'apparel'}.
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ════════════ RECEIPT UPLOAD MODAL (NEW CLAIM FLOW) ════════════ */}
      {showReceiptModal && (
        <Modal isOpen onClose={() => { setShowReceiptModal(false); setShowQrLink(false); setQrPolling(false); }} title="Claim a Product">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 200 }}>

            {receiptSuccess ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2713;</div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Claim Submitted!</p>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 24 }}>
                  Your proof of purchase is being reviewed. You&rsquo;ll be notified once your product is validated.
                </p>
                <Button onClick={() => setShowReceiptModal(false)}>Done</Button>
              </div>

            ) : showQrLink && uploadToken ? (
              /* ── QR Code screen — desktop waits for phone upload ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, textAlign: 'center' }}>
                  Scan with your phone to take a photo
                </p>
                <p style={{ fontSize: 12, color: C.gray, margin: 0, textAlign: 'center', maxWidth: 300 }}>
                  Your phone will open a camera page. After you take the photo it will appear here automatically.
                </p>
                <div style={{
                  padding: 16, background: '#fff', borderRadius: 12,
                  border: bdr, display: 'inline-block',
                }}>
                  <QRCodeSVG
                    value={`${window.location.origin}/api/products/claim-upload/${uploadToken}/page`}
                    size={200}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 16, height: 16, border: `2px solid ${C.border}`,
                    borderTopColor: C.red, borderRadius: '50%',
                    animation: 'zai-spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: 12, color: C.gray }}>Waiting for photo&hellip;</span>
                </div>
                <button
                  onClick={() => { setShowQrLink(false); setQrPolling(false); }}
                  style={{
                    background: 'none', border: 'none', color: C.gray,
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  &#8592; Back to upload options
                </button>
              </div>

            ) : (
              <>
                <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                  Take a photo of your purchase receipt or upload an image. An admin will review it and validate your claim.
                </p>

                {/* Product name (optional) — pick from claimable products */}
                <div>
                  <label style={labelStyle}>Product Name (optional)</label>
                  {claimableLoading ? (
                    <div style={{ fontSize: 12, color: C.gray, padding: '10px 0' }}>Loading products&hellip;</div>
                  ) : claimableRwas.length > 0 ? (
                    <>
                      <ProductPicker
                        products={claimableRwas.map(r => ({
                          id: r.rwaId,
                          name: r.name,
                          image: r.image,
                          price: r.price,
                          currency: r.currency,
                          collection: r.collection,
                          available: r.available,
                        }))}
                        value={receiptProductId}
                        onChange={(id, product) => {
                          setIsCustomProduct(false);
                          setReceiptProductId(id);
                          setReceiptProductName(product?.name || '');
                        }}
                        showOther
                        onOther={() => {
                          setIsCustomProduct(true);
                          setReceiptProductId('');
                          setReceiptProductName('');
                        }}
                        isOther={isCustomProduct}
                        placeholder="Select a product"
                      />
                      {isCustomProduct && (
                        <input
                          style={{ ...inputStyle, marginTop: 8 }}
                          placeholder="Enter product name"
                          value={receiptProductName}
                          onChange={e => setReceiptProductName(e.target.value)}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      style={inputStyle}
                      placeholder="e.g. ZAI Zermatt GT"
                      value={receiptProductName}
                      onChange={e => setReceiptProductName(e.target.value)}
                    />
                  )}
                </div>

                {/* Image capture / upload */}
                <div>
                  <label style={labelStyle}>Proof of Purchase</label>

                  {!receiptImage ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      {/* OPTION 1: Camera (mobile) or QR handoff (desktop) */}
                      {isMobileDevice ? (
                        <label
                          style={{
                            flex: 1, padding: '20px 16px', border: `2px dashed ${C.border}`, borderRadius: 8,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                        >
                          <CameraIcon size={28} color="#2e2e2e" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Take Photo</span>
                          <span style={{ fontSize: 10, color: C.gray }}>Open camera</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handleReceiptCapture}
                          />
                        </label>
                      ) : (
                        <div
                          onClick={handleUsePhone}
                          style={{
                            flex: 1, padding: '20px 16px', border: `2px dashed ${C.border}`, borderRadius: 8,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                        >
                          <SmartphoneIcon size={28} color="#2e2e2e" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Use Phone</span>
                          <span style={{ fontSize: 10, color: C.gray }}>Scan QR to take photo</span>
                        </div>
                      )}

                      {/* OPTION 2: File upload — always available */}
                      <label
                        style={{
                          flex: 1, padding: '20px 16px', border: `2px dashed ${C.border}`, borderRadius: 8,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.red)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <UploadIcon size={28} color="#2e2e2e" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>Upload Image</span>
                        <span style={{ fontSize: 10, color: C.gray }}>JPG, PNG, WebP</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          style={{ display: 'none' }}
                          onChange={handleReceiptCapture}
                          ref={fileInputRef}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      {receiptCid ? (
                        /* Phone-uploaded (encrypted) — show confirmation with SVG icon */
                        <div style={{
                          width: '100%', padding: '32px 20px', borderRadius: 8,
                          background: C.surface, textAlign: 'center',
                          border: `1px solid ${C.border}`,
                        }}>
                          <div style={{ marginBottom: 8 }}>
                            <CameraIcon size={40} color={C.mid} />
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginBottom: 4 }}>
                            Photo received from phone
                          </div>
                          <div style={{ fontSize: 11, color: C.gray }}>
                            Your receipt photo has been securely uploaded and is ready to submit.
                          </div>
                        </div>
                      ) : (
                        <img
                          src={receiptImage!}
                          alt="Receipt preview"
                          style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 8, background: C.surface }}
                        />
                      )}
                      <button
                        onClick={() => { setReceiptImage(null); setReceiptCid(null); setReceiptKey(null); }}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.6)', color: '#fff',
                          border: 'none', cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        &#x2715;
                      </button>
                    </div>
                  )}
                </div>

                {receiptError && (
                  <div style={{ color: C.red, fontSize: 13 }}>{receiptError}</div>
                )}

                {/* Submit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Button onClick={() => setShowReceiptModal(false)}>Cancel</Button>
                  <button
                    onClick={handleReceiptSubmit}
                    disabled={!hasProof || receiptSubmitting}
                    style={{
                      padding: '10px 24px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                      border: 'none', borderRadius: 4,
                      background: (!hasProof || receiptSubmitting) ? C.border : C.red,
                      color: '#fff', fontFamily: C.font,
                      cursor: (!hasProof || receiptSubmitting) ? 'default' : 'pointer',
                      opacity: receiptSubmitting ? 0.6 : 1,
                    }}
                  >
                    {receiptSubmitting ? 'Submitting\u2026' : 'Submit Claim'}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ════════════ INSURANCE MODAL ════════════ */}
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
                  <select value={insuranceForm.salutation} onChange={e => updateInsuranceField('salutation', Number(e.target.value))} style={inputStyle}>
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

      {/* ════════════ ZOOM IMAGE MODAL ════════════ */}
      {zoomImage && (
        <Modal isOpen onClose={() => setZoomImage(null)} title="">
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src={zoomImage.src} alt={zoomImage.alt} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }} />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Products;