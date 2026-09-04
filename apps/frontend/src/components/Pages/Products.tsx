import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  { id: 1, key: 'skiAlpine' },
  { id: 2, key: 'snowboard' },
  { id: 3, key: 'crossCountry' },
];

const SALUTATIONS = [
  { id: 1, key: 'mr' },
  { id: 2, key: 'ms' },
];

/* ───── Insurance eligibility window ─────
   Complimentary insurance is only available for products purchased within
   the last 30 days. The accepted window is [today - 30 days … today],
   both ends inclusive — keep this identical to the server-side check in
   api/products/[...path].js, which is the authoritative one.

   Everything below works on LOCAL calendar parts on purpose. Calling
   `toISOString()` on a Date converts to UTC first, which rolls the day
   over for anyone east of UTC in the evening (and back for anyone west of
   UTC in the early morning) — that would hand the user a window that is
   off by one relative to the date their own date picker shows.

   Note: this is a UI guard only. The window is also enforced server-side;
   nothing here should be treated as the authoritative check. */
const INSURANCE_WINDOW_DAYS = 30;

/** Formats a Date as `YYYY-MM-DD` from its local parts (no UTC shift). */
const toLocalDateInputValue = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** The single source of truth for the window bounds, as `YYYY-MM-DD`. */
const getInsuranceDateWindow = (): { min: string; max: string } => {
  const now = new Date();
  // Rebuild at local midnight so the day arithmetic can't be nudged by the
  // time-of-day component, then step back INSURANCE_WINDOW_DAYS. Date's
  // setDate handles month/year underflow and DST for us.
  const earliest = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  earliest.setDate(earliest.getDate() - INSURANCE_WINDOW_DAYS);
  return { min: toLocalDateInputValue(earliest), max: toLocalDateInputValue(now) };
};

/** True when `value` is a real `YYYY-MM-DD` date inside the eligibility window. */
const isInsuranceDateEligible = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  // Local-time construction, and a round-trip check so rubbish that parses
  // (e.g. 2026-02-31 → 3 March) is rejected rather than silently shifted.
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return false;
  const { min, max } = getInsuranceDateWindow();
  // All three strings are zero-padded `YYYY-MM-DD`, so a lexicographic
  // compare is a chronological compare — no re-parsing needed.
  return value >= min && value <= max;
};

/* Minimal translate-function shape used by module-scope helpers below
   (avoids depending on react-i18next's exact TFunction generic signature). */
type TFn = (key: string, opts?: Record<string, any>) => string;

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

const formatClaimedDate = (t: TFn, d?: string | null): string => {
  if (!d) return t('products.dates.unknown');
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return t('products.dates.unknown');
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/* ── Experience card detection for notification wording ──
   If the claimed item is an "experience card" we say "card" instead of
   "product" in every notification banner so users aren't confused. */
const isExperienceCard = (name?: string): boolean => {
  const n = (name || '').toLowerCase();
  return n.includes('experience') && n.includes('card');
};
const getItemLabel = (t: TFn, name?: string): string =>
  isExperienceCard(name) ? t('products.itemLabel.card') : t('products.itemLabel.product');
const getItemLabelCap = (t: TFn, name?: string): string =>
  isExperienceCard(name) ? t('products.itemLabel.cardCap') : t('products.itemLabel.productCap');

/* ── Robust price display ──
   The backend may return price as "0" after a metadata update while the real
   value lives in priceRaw, or vice-versa. This helper picks the first
   meaningful value so the card never shows "CHF 0". */
const getDisplayPrice = (price?: string, priceRaw?: string): string | null => {
  const p = price?.trim();
  const r = priceRaw?.trim();
  // prefer formatted price, fall back to raw; skip "0" / empty
  if (p && p !== '0' && p !== '0.00') return p;
  if (r && r !== '0' && r !== '0.00') return r;
  // both are zero / empty → return null so the UI hides the row entirely
  return null;
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

const CATEGORY_META: Record<Category, { key: string; badgeBg: string }> = {
  ski:       { key: 'ski',       badgeBg: 'rgba(10,10,10,0.78)' },
  apparel:   { key: 'apparel',   badgeBg: 'rgba(106,106,106,0.78)' },
  accessory: { key: 'accessory', badgeBg: 'rgba(122,34,46,0.82)' },
};

const getCategoryLabel = (t: TFn, category: Category): string => t(`products.categories.${CATEGORY_META[category].key}`);

const CATEGORY_ORDER: Category[] = ['ski', 'apparel', 'accessory'];

const MAX_GRID_CARDS = 3;

/* ───── Card sub-components (module scope = stable identity, so background
   refreshes re-render in place instead of remounting and reloading images) ───── */

const ClaimCard: React.FC<{ onClaim: () => void; style?: React.CSSProperties }> = ({ onClaim, style: extraStyle }) => {
  const { t } = useTranslation();
  return (
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
      <span style={{ fontSize: 13, fontWeight: 600, color: C.mid }}>{t('products.claimCard.title')}</span>
      <span style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{t('products.claimCard.subtitle')}</span>
    </div>
  );
};

const ProductCard: React.FC<{
  product: Product;
  onSelect: (p: Product) => void;
  onActivateInsurance: (p: Product) => void;
  style?: React.CSSProperties;
}> = ({ product, onSelect, onActivateInsurance, style: extraStyle }) => {
  const { t } = useTranslation();
  const category = getCategory(product.name, product.collection, product.type);
  const cat = CATEGORY_META[category];
  const catLabel = getCategoryLabel(t, category);
  const canInsure = categorySupportsInsurance(category);
  const displayPrice = getDisplayPrice(product.price, product.priceRaw);

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
        {/* Insured badge — only shown when insurance is active */}
        {product.insurance?.active && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(76,175,125,0.9)', color: '#fff', fontSize: 8, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 2,
          }}>{t('products.card.insuredBadge')}</div>
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
          {catLabel}
        </div>
      </div>

      <div onClick={() => onSelect(product)} style={{ padding: '12px 14px', flex: 1, cursor: 'pointer' }}>
        {product.collection && (
          <div style={{ ...lbl, marginBottom: 4 }}>{product.collection}</div>
        )}
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {product.name}
        </div>
        {displayPrice && (
          <div style={{ fontSize: 13, color: C.mid, marginBottom: 8 }}>
            {product.currency || 'CHF'} {displayPrice}
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
          {product.insurance?.active ? t('products.card.insuredBadge') : ''}
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
              {t('products.card.activateInsurance')} <span style={{ fontSize: 14 }}>→</span>
            </div>
          ) : (
            <div style={{
              paddingTop: 10, borderTop: bdr,
              fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: C.green,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {t('products.card.insuranceActive')} <span style={{ fontSize: 14 }}>✓</span>
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
            {catLabel}
          </div>
        )}
      </div>
    </div>
  );
};

/* ───── Component ───── */

const Products: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAppContext();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Width-tracking for layout branches that CSS alone can't express
  // (carousel arrow offsets, footer step grid stacking on phone widths).
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPage, setScrollPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Claimable RWAs for the product picker
  const [claimableRwas, setClaimableRwas] = useState<ClaimableRwa[]>([]);
  const [claimableLoading, setClaimableLoading] = useState(false);
  const [claimableError, setClaimableError] = useState<string | null>(null);

  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [insuranceProduct, setInsuranceProduct] = useState<Product | null>(null);
  const [insuranceStep, setInsuranceStep] = useState<'form' | 'loading' | 'success' | 'error'>('form');
  const [insuranceError, setInsuranceError] = useState<string | null>(null);
  const [insuranceResult, setInsuranceResult] = useState<{ certificateId: number; transactionId: number } | null>(null);
  const [insuranceForm, setInsuranceForm] = useState<InsuranceFormData>({
    salutation: 1, firstname: '', lastname: '', address1: '', zip: '', city: '', country: 'CH', language: 'de', email: '', phone: '',
    // makeId 118 is ZAI's real registered make ID in SAS's catalog
    // (confirmed via a live GET /getMakes call) — this was previously
    // hardcoded to 1, which is "4FRNT-SKIS", an unrelated brand. Every
    // insurance registration submitted so far sent the wrong make.
    // purchasingdate still defaults to today, but from LOCAL date parts:
    // `new Date().toISOString()` is UTC, so for users west of UTC in the
    // afternoon it produced tomorrow's date — which now sits outside the
    // eligibility window and would fail its own max= bound.
    deviceType: 1, makeName: 'ZAI', makeId: 118, model: '', serial: '', price: '', length: '', purchasingdate: toLocalDateInputValue(new Date()),
  });

  const [zoomImage, setZoomImage] = useState<{ src: string; alt: string } | null>(null);

  // ── Receipt-based claim flow ──
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

  // Count products per category and apply the active filter.
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
      if (!background) setError(err.response?.data?.error || t('products.errors.failedToLoadProducts'));
    } finally {
      if (!background) setIsLoading(false);
    }
  }, [user?.id]);

  // ── Fetch user's pending claim requests ──
  // Extracted to a stable callback (rather than declared inline inside the
  // polling effect) so it can also be invoked immediately after a claim is
  // submitted below — this is what makes the "claim pending review" banner
  // appear right away instead of waiting for the next poll / a manual page
  // refresh.
  const fetchClaimRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await apiService.get('/products/claim-requests?mine=true');
      if (res.data?.success) {
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
  }, [user?.id, fetchUserProducts]);

  useEffect(() => {
    if (!user?.id) return;

    fetchClaimRequests();
    // Poll frequently (15s) so status changes made elsewhere — an admin
    // validating a claim, minting completing, etc. — surface within seconds.
    const interval = setInterval(fetchClaimRequests, 15000);
    // Also resync the moment the tab regains focus, in case updates happened
    // while it was backgrounded.
    const resync = () => fetchClaimRequests();
    window.addEventListener('focus', resync);
    document.addEventListener('visibilitychange', resync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', resync);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [user?.id, fetchClaimRequests]);

  const handleUsePhone = async () => {
    try {
      const res = await apiService.post('/products/claim-upload/create-token');
      const payload = res.data as any;
      if (payload?.success && payload.token) {
        setUploadToken(payload.token);
        setShowQrLink(true);
        setQrPolling(true);
      } else {
        setReceiptError(t('products.errors.failedGenerateUploadLink'));
      }
    } catch (err: any) {
      setReceiptError(t('products.errors.failedGenerateUploadLink'));
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
          setReceiptError(t('products.errors.uploadLinkExpired'));
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
        setClaimableError(payload?.error || t('products.errors.failedToLoadClaimableProducts'));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('products.errors.failedToLoadClaimableProducts');
      setClaimableError(msg);
    } finally {
      setClaimableLoading(false);
    }
  };

  // ── Receipt-based claim handlers ──
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
      setReceiptError(t('products.errors.imageTooLarge'));
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
    if (!receiptProductId.trim() && !receiptProductName.trim()) {
      setReceiptError(t('products.errors.pleaseChooseProduct'));
      return;
    }
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

        // Optimistic update: show the "pending review" notification on My
        // Collection instantly, without waiting for the next poll.
        const optimisticClaim = {
          id: payload.claimId || `optimistic-${Date.now()}`,
          status: 'pending',
          productName: receiptProductName,
          createdAt: new Date().toISOString(),
        };
        setPendingClaimRequests(prev => [optimisticClaim, ...prev]);
        setAllClaims(prev => [optimisticClaim, ...prev]);

        // Reconcile with the server right away (real claim id, timestamps,
        // any other claims) instead of waiting for the 15s poll.
        fetchClaimRequests();
      } else {
        setReceiptError(payload?.error || t('products.errors.submissionFailed'));
      }
    } catch (err: any) {
      setReceiptError(err?.response?.data?.error || err?.message || t('products.errors.submissionFailed'));
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
      // Re-seed with today: the modal keeps its state between openings, so a
      // tab left open past midnight could otherwise carry a stale date.
      purchasingdate: toLocalDateInputValue(new Date()),
    }));
  };

  const handleInsuranceSubmit = async () => {
    if (!insuranceProduct) return;

    // Purchases older than the eligibility window can't be insured. Blocked
    // here for a fast, clear message — the server re-checks independently.
    if (!isInsuranceDateEligible(insuranceForm.purchasingdate)) {
      setInsuranceError(t('products.insuranceModal.errors.purchaseDateOutOfWindow', { days: INSURANCE_WINDOW_DAYS }));
      return;
    }

    setInsuranceStep('loading');
    setInsuranceError(null);
    try {
      const response = await apiService.post(`/products/${insuranceProduct.id}/activate-insurance`, insuranceForm);
      const payload = response.data as any;
      if (!payload?.success) throw new Error(payload?.error || t('products.errors.failedActivateInsurance'));
      setInsuranceResult({ certificateId: payload.certificateId, transactionId: payload.transactionId });
      setInsuranceStep('success');
      fetchUserProducts();
    } catch (err: any) {
      // `detail` is where the actionable reason lives — the provider's own
      // field-level validation feedback, or the eligibility-window explanation.
      // Only `error` was being read, so members saw a bare "Insurance
      // activation failed" while the server had already said why.
      const data = err?.response?.data;
      const reason = data?.detail || data?.error || err?.message;
      setInsuranceError(reason || t('products.errors.failedActivateInsurance'));
      setInsuranceStep('error');
    }
  };

  const updateInsuranceField = (field: keyof InsuranceFormData, value: string | number) => {
    setInsuranceForm(prev => ({ ...prev, [field]: value }));
  };

  // Bounds for the purchase-date picker. Derived from the same helper the
  // submit-time check uses, so the two can't drift apart.
  const insuranceDateWindow = getInsuranceDateWindow();

  const totalClaimed = products.length;
  const activeInsurances = products.filter(p => p.insurance?.active).length;

  if (isLoading) {
    return (
      <div style={{ padding: 'clamp(20px, 5vw, 48px) clamp(16px, 5vw, 48px) 80px', fontFamily: C.font, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ height: 28, width: 200, background: C.surface, borderRadius: 4, marginBottom: 32, animation: 'zai-pulse 1.5s ease-in-out infinite' }} />
          <div style={{ display: 'flex', gap: 16, overflow: 'hidden', flexWrap: 'wrap' }}>
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
      <div style={{ padding: 'clamp(20px, 5vw, 48px) clamp(16px, 5vw, 48px) 80px', fontFamily: C.font, boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
          <p style={{ fontSize: 15, color: C.gray, marginBottom: 24 }}>{error}</p>
          <Button onClick={() => fetchUserProducts()}>{t('products.errors.retry')}</Button>
        </div>
      </div>
    );
  }

  /* ── Helper: is proof ready to submit? ── */
  const hasProof = !!(receiptImage || receiptCid);
  const hasProduct = !!(receiptProductId.trim() || receiptProductName.trim());

  /* ── Claim notification: only the single latest claim, never a pile-up ──
     This used to show one banner per claim ever made (pending/minting had
     no dismiss control at all), so every claim attempt left a permanent
     banner until individually dismissed — testing a few products left
     several stacked forever, reappearing on every visit. The API already
     returns claims ORDER BY created_at DESC, so the first non-dismissed
     entry is the latest; showing only that one means a new claim
     naturally replaces whatever was shown before. */
  const latestClaim = allClaims.find(c => !dismissedClaimIds.has(c.id));

  /* ───── Render ───── */

  return (
    <div style={{ padding: 'clamp(20px, 5vw, 48px) clamp(16px, 5vw, 48px) 0', fontFamily: C.font, color: C.black, boxSizing: 'border-box', overflowX: 'hidden' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* ══════ HEADER ══════ */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 16,
          marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: bdr,
        }}>
          <div>
            <div style={sectionLabel}>{t('products.header.eyebrow')}</div>
            <h1 style={{
              fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300,
              lineHeight: 1.15, margin: '6px 0 6px', color: C.black,
            }}>
              {t('products.header.title')}
            </h1>
            <p style={{ color: C.gray, fontSize: '13px', margin: 0, maxWidth: 480 }}>
              {t('products.header.subtitle')}
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
            {t('products.header.claimButton')}
          </button>
        </div>

        {/* ══════ CLAIM NOTIFICATION — latest only ══════ */}
        {latestClaim && (
          <div style={{ marginBottom: 24 }}>

            {latestClaim.status === 'pending' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(255,180,0,0.10)', border: '1px solid rgba(255,180,0,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
                    {t('products.notifications.pending.title')}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {t('products.notifications.pending.detail', {
                      item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName),
                      date: formatClaimedDate(t, latestClaim.createdAt),
                    })}
                  </div>
                </div>
              </div>
            )}

            {latestClaim.status === 'minting' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(100,160,255,0.10)', border: '1px solid rgba(100,160,255,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⛏️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>
                    {t('products.notifications.minting.title', { item: getItemLabel(t, latestClaim.productName) })}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {t('products.notifications.minting.detail', { item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName) })}
                  </div>
                </div>
              </div>
            )}

            {latestClaim.status === 'validated' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(76,175,125,0.10)', border: '1px solid rgba(76,175,125,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>✅</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.green }}>
                    {t('products.notifications.validated.title', {
                      item: getItemLabelCap(t, latestClaim.productName),
                      destination: isExperienceCard(latestClaim.productName)
                        ? t('products.notifications.validated.destinationAccount')
                        : t('products.notifications.validated.destinationCollection'),
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {t('products.notifications.validated.detail', {
                      item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName),
                      date: latestClaim.reviewedAt ? new Date(latestClaim.reviewedAt).toLocaleDateString() : '',
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, latestClaim.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}

            {latestClaim.status === 'rejected' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(122,34,46,0.10)', border: '1px solid rgba(122,34,46,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#d44' }}>
                    {t('products.notifications.rejected.title')}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {latestClaim.adminNote
                      ? t('products.notifications.rejected.detailWithNote', { item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName), note: latestClaim.adminNote })
                      : t('products.notifications.rejected.detailNoNote', { item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName) })}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, latestClaim.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}

            {latestClaim.status === 'error' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 20px',
                background: 'rgba(255,100,0,0.10)', border: '1px solid rgba(255,100,0,0.25)', borderRadius: 10,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#ff6400' }}>
                    {t('products.notifications.error.title')}
                  </div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
                    {t('products.notifications.error.detail', {
                      item: latestClaim.productName || getItemLabelCap(t, latestClaim.productName),
                      note: latestClaim.adminNote || t('products.notifications.error.defaultNote'),
                    })}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedClaimIds(prev => new Set([...prev, latestClaim.id]))}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    fontSize: 16, padding: '4px 8px', flexShrink: 0,
                  }}
                >✕</button>
              </div>
            )}

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
              <div style={lbl}>{t('products.stats.productsClaimed')}</div>
            </div>
          </div>
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, color: C.green }}>●</span>
            <div>
              <div style={{ fontSize: 28, fontWeight: 300, color: C.black }}>{activeInsurances}</div>
              <div style={lbl}>{t('products.stats.insuranceActive')}</div>
            </div>
          </div>
        </div>

        {/* ══════ COLLECTION LABEL ══════ */}
        <div style={sectionLabel}>{t('products.collectionLabel')}</div>
        <div style={{ height: 16 }} />

        {/* ══════ CATEGORY FILTER ══════ */}
        {products.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {([
              { key: 'all' as const, label: t('products.categoryFilter.all'), count: products.length },
              ...CATEGORY_ORDER
                .filter(c => categoryCounts[c] > 0)
                .map(c => ({ key: c, label: getCategoryLabel(t, c), count: categoryCounts[c] })),
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
            // Fixed-width tracks, not 1fr. `auto-fit` with a fractional max
            // divides the whole row between however few items exist, so a new
            // member with one product saw that product and the claim card
            // stretched to half the page each. Cards now keep the same width
            // whether there are two or twenty, filling from the left and
            // leaving the remainder of the row empty. 220px matches the width
            // the carousel below already uses for the same cards.
            // min(100%, 220px) as the floor keeps a plain 220px track from
            // overflowing a container narrower than that — this grid is chosen
            // by product count, not viewport, so it renders on phones too.
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 220px))',
            justifyContent: 'start',
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
                style={{ ...sideArrowBase, left: isMobile ? 0 : -18 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                aria-label={t('products.carousel.scrollLeft')}
              >
                ‹
              </button>
            )}

            {/* RIGHT ARROW */}
            {canScrollRight && (
              <button
                onClick={() => scrollByCards(1)}
                style={{ ...sideArrowBase, right: isMobile ? 0 : -18 }}
                onMouseEnter={e => { e.currentTarget.style.background = C.pureWhite; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.92)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                aria-label={t('products.carousel.scrollRight')}
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
          padding: 'clamp(28px, 6vw, 48px) clamp(20px, 5vw, 40px) clamp(32px, 6vw, 56px)',
          borderRadius: 8,
          boxSizing: 'border-box',
        }}>
          <div style={{
            fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: C.gray, marginBottom: 8,
          }}>
            {t('products.howToClaim.eyebrow')}
          </div>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 26px)', fontWeight: 300, margin: '0 0 40px', color: '#fff' }}>
            {t('products.howToClaim.title')}
          </h2>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1px', background: '#2a2a2a',
          }}>
            {[
              {
                step: '01',
                title: t('products.howToClaim.step1.title'),
                desc: t('products.howToClaim.step1.desc'),
              },
              {
                step: '02',
                title: t('products.howToClaim.step2.title'),
                desc: t('products.howToClaim.step2.desc'),
              },
              {
                step: '03',
                title: t('products.howToClaim.step3.title'),
                desc: t('products.howToClaim.step3.desc'),
              },
            ].map((item) => (
              <div key={item.step} style={{
                background: C.black, padding: '32px 28px',
              }}>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: C.red, marginBottom: 12, fontWeight: 600,
                }}>
                  {t('products.howToClaim.stepLabel', { num: item.step })}
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
        const detailLabel = getCategoryLabel(t, detailCategory);
        const detailIsSki = detailCategory === 'ski';
        const detailPrice = getDisplayPrice(selectedProduct.price, selectedProduct.priceRaw);
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
                    loading="lazy"
                    decoding="async"
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
                {detailPrice && (
                  <div>
                    <div style={lbl}>{t('products.detail.price')}</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{selectedProduct.currency || 'CHF'} {detailPrice}</div>
                  </div>
                )}
                {selectedProduct.materials && (
                  <div>
                    <div style={lbl}>{t('products.detail.materials')}</div>
                    <div style={{ fontSize: 13 }}>{selectedProduct.materials}</div>
                  </div>
                )}
                {/* "Claimed" row removed — product is in the collection so it's self-evident */}
                <div>
                  <div style={lbl}>{t('products.detail.category')}</div>
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
                        {detailLabel}
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                        </svg>
                        {detailLabel}
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
                    <div style={lbl}>{t('products.detail.insurance')}</div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 600, marginTop: 4,
                      color: selectedProduct.insurance?.active ? C.green : C.gray,
                    }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: selectedProduct.insurance?.active ? C.green : C.gray,
                      }} />
                      {selectedProduct.insurance?.active ? t('products.detail.active') : t('products.detail.notActive')}
                    </div>
                    {selectedProduct.insurance?.certificateId && (
                      <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                        {t('products.detail.certificate', { id: selectedProduct.insurance.certificateId })}
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
                      {t('products.detail.activateInsurance')}
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
                    {t('products.detail.noInsuranceNote', {
                      category: detailCategory === 'accessory' ? t('products.detail.categoryAccessory') : t('products.detail.categoryApparel'),
                    })}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ════════════ RECEIPT UPLOAD MODAL (CLAIM FLOW) ════════════ */}
      {showReceiptModal && (
        <Modal isOpen onClose={() => { setShowReceiptModal(false); setShowQrLink(false); setQrPolling(false); }} title={t('products.receiptModal.title')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 200 }}>

            {receiptSuccess ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2713;</div>
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{t('products.receiptModal.success.title')}</p>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 24 }}>
                  {t('products.receiptModal.success.desc', { item: getItemLabel(t, receiptProductName) })}
                </p>
                <Button onClick={() => setShowReceiptModal(false)}>{t('products.receiptModal.success.done')}</Button>
              </div>

            ) : showQrLink && uploadToken ? (
              /* ── QR Code screen — desktop waits for phone upload ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, textAlign: 'center' }}>
                  {t('products.receiptModal.qr.scanTitle')}
                </p>
                <p style={{ fontSize: 12, color: C.gray, margin: 0, textAlign: 'center', maxWidth: 300 }}>
                  {t('products.receiptModal.qr.scanDesc')}
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
                  <span style={{ fontSize: 12, color: C.gray }}>{t('products.receiptModal.qr.waitingForPhoto')}</span>
                </div>
                <button
                  onClick={() => { setShowQrLink(false); setQrPolling(false); }}
                  style={{
                    background: 'none', border: 'none', color: C.gray,
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  {t('products.receiptModal.qr.backToUploadOptions')}
                </button>
              </div>

            ) : (
              <>
                <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                  {t('products.receiptModal.form.intro')}
                </p>

                {/* Product name (optional) — pick from claimable products */}
                <div>
                  <label style={labelStyle}>{t('products.receiptModal.form.productNameLabel')}</label>
                  {claimableLoading ? (
                    <div style={{ fontSize: 12, color: C.gray, padding: '10px 0' }}>{t('products.receiptModal.form.loadingProducts')}</div>
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
                        placeholder={t('products.receiptModal.form.selectProductPlaceholder')}
                      />
                      {isCustomProduct && (
                        <input
                          style={{ ...inputStyle, marginTop: 8 }}
                          placeholder={t('products.receiptModal.form.enterProductNamePlaceholder')}
                          value={receiptProductName}
                          onChange={e => setReceiptProductName(e.target.value)}
                        />
                      )}
                    </>
                  ) : (
                    <input
                      style={inputStyle}
                      placeholder={t('products.receiptModal.form.exampleProductPlaceholder')}
                      value={receiptProductName}
                      onChange={e => setReceiptProductName(e.target.value)}
                    />
                  )}
                </div>

                {/* Image capture / upload */}
                <div>
                  <label style={labelStyle}>{t('products.receiptModal.form.proofOfPurchaseLabel')}</label>

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
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>{t('products.receiptModal.form.takePhoto')}</span>
                          <span style={{ fontSize: 10, color: C.gray }}>{t('products.receiptModal.form.openCamera')}</span>
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
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>{t('products.receiptModal.form.usePhone')}</span>
                          <span style={{ fontSize: 10, color: C.gray }}>{t('products.receiptModal.form.scanQrToTakePhoto')}</span>
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
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.mid }}>{t('products.receiptModal.form.uploadImage')}</span>
                        <span style={{ fontSize: 10, color: C.gray }}>{t('products.receiptModal.form.fileTypes')}</span>
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
                            {t('products.receiptModal.form.photoReceivedTitle')}
                          </div>
                          <div style={{ fontSize: 11, color: C.gray }}>
                            {t('products.receiptModal.form.photoReceivedDesc')}
                          </div>
                        </div>
                      ) : (
                        <img
                          src={receiptImage!}
                          alt="Receipt preview"
                          loading="lazy"
                          decoding="async"
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
                  <Button onClick={() => setShowReceiptModal(false)}>{t('products.receiptModal.form.cancel')}</Button>
                  <button
                    onClick={handleReceiptSubmit}
                    disabled={!hasProof || !hasProduct || receiptSubmitting}
                    style={{
                      padding: '10px 24px', fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                      border: 'none', borderRadius: 4,
                      background: (!hasProof || !hasProduct || receiptSubmitting) ? C.border : C.red,
                      color: '#fff', fontFamily: C.font,
                      cursor: (!hasProof || !hasProduct || receiptSubmitting) ? 'default' : 'pointer',
                      opacity: receiptSubmitting ? 0.6 : 1,
                    }}
                  >
                    {receiptSubmitting ? t('products.receiptModal.form.submitting') : t('products.receiptModal.form.submitClaim')}
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ════════════ INSURANCE MODAL ════════════ */}
      {showInsuranceModal && insuranceProduct && (
        <Modal isOpen onClose={() => setShowInsuranceModal(false)} title={t('products.insuranceModal.title')}>
          {insuranceStep === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 480, overflowY: 'auto' }}>
              <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>
                {t('products.insuranceModal.formIntro', { name: insuranceProduct.name })}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.salutation')}</label>
                  <select value={insuranceForm.salutation} onChange={e => updateInsuranceField('salutation', Number(e.target.value))} style={inputStyle}>
                    {SALUTATIONS.map(s => <option key={s.id} value={s.id}>{t(`products.salutations.${s.key}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.language')}</label>
                  {/* The insurer's API only accepts DE/FR/IT (no English) —
                      offering "English" here would let a user submit a
                      value that's guaranteed to be rejected downstream. */}
                  <select value={insuranceForm.language} onChange={e => updateInsuranceField('language', e.target.value)} style={inputStyle}>
                    <option value="de">Deutsch</option>
                    <option value="fr">Fran&ccedil;ais</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.firstName')}</label>
                  <input style={inputStyle} value={insuranceForm.firstname} onChange={e => updateInsuranceField('firstname', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.lastName')}</label>
                  <input style={inputStyle} value={insuranceForm.lastname} onChange={e => updateInsuranceField('lastname', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t('products.insuranceModal.labels.address')}</label>
                <input style={inputStyle} value={insuranceForm.address1} onChange={e => updateInsuranceField('address1', e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.zip')}</label>
                  <input style={inputStyle} value={insuranceForm.zip} onChange={e => updateInsuranceField('zip', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.city')}</label>
                  <input style={inputStyle} value={insuranceForm.city} onChange={e => updateInsuranceField('city', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.country')}</label>
                  <input style={inputStyle} value={insuranceForm.country} onChange={e => updateInsuranceField('country', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.email')}</label>
                  <input style={inputStyle} type="email" value={insuranceForm.email} onChange={e => updateInsuranceField('email', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.phone')}</label>
                  <input style={inputStyle} type="tel" value={insuranceForm.phone} onChange={e => updateInsuranceField('phone', e.target.value)} />
                </div>
              </div>
              <div style={{ borderTop: bdr, paddingTop: 16, marginTop: 4 }}>
                <div style={{ ...lbl, marginBottom: 12 }}>{t('products.insuranceModal.labels.deviceInformation')}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.deviceType')}</label>
                  <select value={insuranceForm.deviceType} onChange={e => updateInsuranceField('deviceType', Number(e.target.value))} style={inputStyle}>
                    {DEVICE_TYPES.map(d => <option key={d.id} value={d.id}>{t(`products.deviceTypes.${d.key}`)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.make')}</label>
                  <input style={inputStyle} value={insuranceForm.makeName} readOnly />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.model')}</label>
                  <input style={inputStyle} value={insuranceForm.model} onChange={e => updateInsuranceField('model', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.serialNumber')}</label>
                  <input style={inputStyle} value={insuranceForm.serial} onChange={e => updateInsuranceField('serial', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.price')}</label>
                  <input style={inputStyle} type="number" value={insuranceForm.price} onChange={e => updateInsuranceField('price', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.length')}</label>
                  <input style={inputStyle} type="number" value={insuranceForm.length} onChange={e => updateInsuranceField('length', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{t('products.insuranceModal.labels.purchaseDate')}</label>
                  <input
                    style={inputStyle}
                    type="date"
                    value={insuranceForm.purchasingdate}
                    min={insuranceDateWindow.min}
                    max={insuranceDateWindow.max}
                    onChange={e => {
                      updateInsuranceField('purchasingdate', e.target.value);
                      // Drop a stale eligibility complaint as soon as the user edits.
                      if (insuranceError) setInsuranceError(null);
                    }}
                  />
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 6, lineHeight: 1.4 }}>
                    {t('products.insuranceModal.purchaseDateHint', { days: INSURANCE_WINDOW_DAYS })}
                  </div>
                </div>
              </div>

              {insuranceError && (
                <div style={{ color: C.red, fontSize: 13 }}>{insuranceError}</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <Button onClick={() => setShowInsuranceModal(false)}>{t('products.insuranceModal.cancel')}</Button>
                <Button onClick={handleInsuranceSubmit}>{t('products.insuranceModal.activateInsurance')}</Button>
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
              <span style={{ fontSize: 14, color: C.mid }}>{t('products.insuranceModal.loading.activating')}</span>
              <span style={{ fontSize: 12, color: C.gray, marginTop: 8 }}>{t('products.insuranceModal.loading.mayTake')}</span>
            </div>
          )}

          {insuranceStep === 'success' && insuranceResult && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2713;</div>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{t('products.insuranceModal.success.title')}</p>
              <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: '16px 24px', background: C.surface, borderRadius: 8 }}>
                <div><span style={lbl}>{t('products.insuranceModal.success.certificateId')} </span><span style={{ fontFamily: 'monospace' }}>{insuranceResult.certificateId}</span></div>
                <div><span style={lbl}>{t('products.insuranceModal.success.transactionId')} </span><span style={{ fontFamily: 'monospace' }}>{insuranceResult.transactionId}</span></div>
              </div>
              <div style={{ marginTop: 24 }}>
                <Button onClick={() => setShowInsuranceModal(false)}>{t('products.insuranceModal.success.done')}</Button>
              </div>
            </div>
          )}

          {insuranceStep === 'error' && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2715;</div>
              <p style={{ color: C.red, fontSize: 14, marginBottom: 16 }}>{insuranceError}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                <Button onClick={() => { setInsuranceError(null); setInsuranceStep('form'); }}>{t('products.insuranceModal.error.tryAgain')}</Button>
                <Button onClick={() => setShowInsuranceModal(false)}>{t('products.insuranceModal.error.close')}</Button>
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
