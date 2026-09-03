import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { CameraIcon, UploadIcon, SmartphoneIcon } from '../Icons/ClaimIcons';

interface DashboardStats {
  productsClaimed: number;
  eventsAttended: number;
  eventsUpcoming: number;
  insuranceActive: number;
}

interface Activity {
  id: string;
  type: 'product' | 'event' | 'membership' | 'referral' | 'purchase' | 'collectible';
  title: string;
  date: string;
  icon: string;
  points?: number;
}

/* ── Tier meta (mirrors TIERS in api/points.js, the source of truth) ──
   There is no entry tier: below White's 500 points a member has NO tier, so
   tierForBalance returns null. It previously fell back to TIERS[0], which is
   why a brand-new member with 0 points was shown as "Blue Tier". */
const TIERS = [
  { name: 'White', floor: 500, ceiling: 2499 },
  { name: 'Blue', floor: 2500, ceiling: 4999 },
  { name: 'Red', floor: 5000, ceiling: 9999 },
  { name: 'Black', floor: 10000, ceiling: 14999 },
  { name: 'Diamond', floor: 15000, ceiling: null as number | null },
];

function tierForBalance(balance: number) {
  return TIERS.find(t => balance >= t.floor && (t.ceiling === null || balance <= t.ceiling)) || null;
}

/** Next tier up, or the first tier when the member has none yet. */
function nextTierFor(current: typeof TIERS[number] | null) {
  if (!current) return TIERS[0];
  const idx = TIERS.findIndex(t => t.name === current.name);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

/* ── Sanitize WalletTwo/Engage values — some fields echo back the literal
   string "true"/"false" instead of real data (or absent data as a boolean);
   render those as blank rather than the literal word. ── */
function clean(val: any): string {
  if (val === true || val === 'true') return '';
  if (val === false || val === 'false') return '';
  if (val === null || val === undefined) return '';
  return String(val);
}

/* ── Derive a clean display name from user fields ── */
function getDisplayName(user: any): { first: string; last: string; display: string } {
  const first = (user?.givenName || user?.firstName || '').trim();
  const last = (user?.familyName || user?.lastName || '').trim();
  if (first || last) {
    return { first, last, display: [first, last].filter(Boolean).join(' ') };
  }
  // Fallback: extract from email
  const emailLocal = (user?.email || '').split('@')[0] || '';
  const parts = emailLocal.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
  const fallbackFirst = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : '';
  const fallbackLast = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : '';
  return {
    first: fallbackFirst,
    last: fallbackLast,
    display: [fallbackFirst, fallbackLast].filter(Boolean).join(' ') || user?.email || 'User',
  };
}

/* ── Skeleton shimmer keyframes (injected once) ── */
const SHIMMER_ID = 'zai-shimmer-keyframes';
function ensureShimmerStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_ID;
  style.textContent = `
    @keyframes zaiShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    @keyframes zai-spin { 100% { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
}

const shimmerStyle: React.CSSProperties = {
  background: 'linear-gradient(90deg, #f0ede6 25%, #e8e4db 50%, #f0ede6 75%)',
  backgroundSize: '800px 100%',
  animation: 'zaiShimmer 1.6s infinite ease-in-out',
  borderRadius: '4px',
};

const SkeletonBlock: React.FC<{ width?: string; height?: string; style?: React.CSSProperties }> = ({
  width = '100%',
  height = '14px',
  style,
}) => <div style={{ ...shimmerStyle, width, height, ...style }} />;

const DashboardSkeleton: React.FC = () => {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  return (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '48px 48px 80px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
    <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6' }}>
      <SkeletonBlock width="60px" height="11px" style={{ marginBottom: '0.6rem' }} />
      <SkeletonBlock width="220px" height="36px" style={{ marginBottom: '0.5rem' }} />
      <SkeletonBlock width="360px" height="13px" style={{ maxWidth: '100%' }} />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', marginBottom: '1px' }}>
      <div style={{ background: '#f0ede6', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <SkeletonBlock width="56px" height="56px" style={{ borderRadius: '50%', marginBottom: '1rem' }} />
        <SkeletonBlock width="140px" height="16px" style={{ marginBottom: '6px' }} />
        <SkeletonBlock width="200px" height="11px" style={{ marginBottom: '1.25rem', maxWidth: '100%' }} />
        <SkeletonBlock width="100px" height="10px" />
      </div>
      <div style={{ background: '#1a1a1a', padding: '2rem' }}>
        <SkeletonBlock width="100px" height="10px" style={{ marginBottom: '0.75rem', background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
        <SkeletonBlock width="240px" height="28px" style={{ marginBottom: '1rem', background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
        <SkeletonBlock width="300px" height="12px" style={{ maxWidth: '100%', background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0, marginBottom: '1px' }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <SkeletonBlock width="50px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBlock width="120px" height="11px" style={{ marginBottom: '4px' }} />
          <SkeletonBlock width="180px" height="11px" style={{ maxWidth: '100%' }} />
        </div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0 }}>
      <div style={{ background: '#fff', padding: '1.75rem' }}>
        <SkeletonBlock width="130px" height="11px" style={{ marginBottom: '1.25rem' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '0.75rem' }}>
            <SkeletonBlock width="20px" height="20px" style={{ flexShrink: 0, borderRadius: '50%' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <SkeletonBlock width="80%" height="12px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="60px" height="10px" />
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: '#f0ede6', padding: '1.75rem' }}>
        <SkeletonBlock width="120px" height="11px" style={{ marginBottom: '1.25rem' }} />
        {[0, 1].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '0.9rem' }}>
            <SkeletonBlock width="32px" height="32px" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <SkeletonBlock width="70%" height="12px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="50%" height="11px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
  );
};

/* ── Locked overlay for gated sections (light theme) ── */
const LockedOverlay: React.FC<{
  children: React.ReactNode;
  locked: boolean;
  message?: string;
}> = ({ children, locked, message }) => {
  const { t } = useTranslation();
  const [hover, setHover] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ opacity: 0.25, pointerEvents: 'none', filter: 'grayscale(80%)' }}>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid #e0ddd6',
            borderRadius: 8,
            padding: '8px 16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <span style={{ fontSize: 14 }}>🔒</span>
          <span style={{ fontSize: 10, letterSpacing: '0.1em', fontWeight: 600, color: '#7A222E', textTransform: 'uppercase' }}>
            {t('dashboard.locked.badge')}
          </span>
        </div>
      </div>
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            marginTop: 28,
            background: '#fff',
            border: '1px solid #7A222E',
            borderRadius: 8,
            padding: '10px 16px',
            zIndex: 100,
            minWidth: 240,
            maxWidth: 300,
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: 12, color: '#1a1a1a', lineHeight: 1.6 }}>
            {message || t('dashboard.locked.defaultMessage')}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Shared style constants ── */
const EC_BORDER = '#e0ddd6';
const EC_RED = '#7A222E';
const EC_GOLD = '#7A222E';
const EC_SURFACE = '#f0ede6';

/* ── Experience Card image path ──
   Save the experience card image to: apps/frontend/public/images/experience-card.png
   If you don't have the file yet, use the external URL as fallback. */
const EC_IMAGE = '/images/experience-card.png';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isLoading } = useAppContext();
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const [stats, setStats] = useState<DashboardStats>({
    productsClaimed: 0,
    eventsAttended: 0,
    eventsUpcoming: 0,
    insuranceActive: 0,
  });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Rewards / tier state ──
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsThisMonth, setPointsThisMonth] = useState(0);

  // ── Experience card & admin checks ──
  const [hasExperienceCard, setHasExperienceCard] = useState(false);
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'owner';
  const exclusive = hasExperienceCard || isAdmin;

  // ── Derive display name (consistent with Sidebar) ──
  const { first: userFirst, last: userLast, display: userDisplay } = user ? getDisplayName(user) : { first: '', last: '', display: '' };

  // Preload pages the user is likely to visit next
  useEffect(() => {
    const timer = setTimeout(() => {
      import('../Pages/Products');
      import('../Pages/Events');
    }, 2000); // Wait 2s after dashboard renders, then preload
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    ensureShimmerStyle();
  }, []);

  useEffect(() => {
    if (!user && !isLoading) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id]);

  // ── Auto-grant the Experience Club Card ──
  // Membership is no longer gated, so every registered member is entitled to
  // a card with no application and no proof of purchase. The grant lives
  // behind its own endpoint rather than the login handler so a slow or
  // failing RWA mint can never block sign-in — which means something has to
  // call it, and the dashboard is where members land after logging in.
  //
  // The endpoint is idempotent (PRIMARY KEY on user_id), so calling it on
  // every dashboard visit is intentional: it doubles as a retry for anyone
  // whose first attempt failed while the mint service was down. Only
  // re-fetch on the call that actually granted, to avoid a pointless second
  // round trip on every later visit.
  const cardGrantAttempted = useRef(false);
  useEffect(() => {
    if (!user?.id || cardGrantAttempted.current) return;
    cardGrantAttempted.current = true;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.post('/products/ensure-experience-card', {});
        const data = res.data as any;
        if (!cancelled && data?.granted) {
          // Newly granted — refresh so the unlocked state and the
          // zai_experience_card cache other pages read are up to date.
          fetchDashboardData();
        }
      } catch {
        // Non-fatal by design: a 409 (no wallet yet) or 502 (mint service
        // down) just means the next dashboard visit retries.
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const fetchDashboardData = async () => {
    try {
      setDashboardLoading(true);
      setError(null);

      const [productsResponse, eventsResponse, balanceResponse, historyResponse] = await Promise.all([
        apiService.get(`/products/user/${user?.id}`),
        apiService.get('/events'),
        apiService.get('/store/rewards/balance').catch(() => null),
        apiService.get('/store/rewards/history', { params: { limit: 50 } }).catch(() => null),
      ]);

      const responseData = productsResponse.data as any;
      const products = responseData?.data || [];

      const ecFound = !!responseData?.experienceCard || !!responseData?.stats?.hasExperienceCard;
      setHasExperienceCard(ecFound);

      if (ecFound) {
        const ecPayload = responseData?.experienceCard
          ? JSON.stringify(responseData.experienceCard)
          : 'true';
        localStorage.setItem('zai_experience_card', ecPayload);
      } else {
        localStorage.removeItem('zai_experience_card');
      }
      window.dispatchEvent(new Event('zai:experience-card-updated'));

      const allEvents = (eventsResponse.data as any)?.data || [];
      const attendedEvents = allEvents.filter((e: any) => e.registered && e.status === 'past');
      const upcomingRegisteredEvents = allEvents.filter((e: any) => e.registered && e.status === 'upcoming');

      // ── Points balance + this-month total ──
      const balanceData = (balanceResponse?.data as any)?.data;
      setPointsBalance(balanceData?.balance || 0);

      const ledger = ((historyResponse?.data as any)?.data || []) as any[];
      const now = new Date();
      const monthTotal = ledger
        .filter(h => {
          const d = new Date(h.created_at);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((sum, h) => sum + (h.amount || 0), 0);
      setPointsThisMonth(monthTotal);

      // ── Recent activity: driven by the points ledger (always carries a point value) ──
      const recentActivity: Activity[] = ledger.slice(0, 5).map((h: any) => ({
        id: h.id,
        type: (h.type === 'referral' ? 'referral' : h.type === 'collectible' ? 'collectible' : h.type === 'purchase' || h.type === 'deal_redeem' ? 'purchase' : 'product') as Activity['type'],
        title: h.description || t('dashboard.activity.pointsActivity'),
        date: h.created_at,
        icon: h.type,
        points: h.amount,
      }));

      setStats({
        productsClaimed: products.length,
        eventsAttended: attendedEvents.length,
        eventsUpcoming: upcomingRegisteredEvents.length,
        insuranceActive: products.filter((p: any) => p.insurance?.active).length,
      });

      setActivity(recentActivity);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.error || t('dashboard.errors.dashboardLoadFailed'));
    } finally {
      setDashboardLoading(false);
    }
  };

  const handleCopyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopiedWallet(true);
      setTimeout(() => setCopiedWallet(false), 2000);
    }
  };

  if (isLoading || !user) {
    return <div style={{ padding: '2rem' }}>{t('dashboard.loading')}</div>;
  }

  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return t('dashboard.dateFormat.claimed');
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return t('dashboard.dateFormat.claimed');

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const isFuture = diffMs < 0;
      const absDiffMs = Math.abs(diffMs);
      const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
      const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

      if (isFuture) {
        if (diffDays === 0 && diffHours < 24) return t('dashboard.dateFormat.today');
        if (diffDays === 1) return t('dashboard.dateFormat.tomorrow');
        if (diffDays < 7) return t('dashboard.dateFormat.inDays', { count: diffDays });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (diffMinutes < 1) return t('dashboard.dateFormat.justNow');
      if (diffMinutes < 60) return t('dashboard.dateFormat.minutesAgo', { count: diffMinutes });
      if (diffHours < 24) return t('dashboard.dateFormat.hoursAgo', { count: diffHours });
      if (diffDays === 1) return t('dashboard.dateFormat.yesterday');
      if (diffDays < 7) return t('dashboard.dateFormat.daysAgo', { count: diffDays });
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return t('dashboard.dateFormat.weeksAgo', { count: weeks });
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return t('dashboard.dateFormat.monthsAgo', { count: months });
      }

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr || t('dashboard.dateFormat.claimed');
    }
  };

  const getActivityDotColor = (type: string) => {
    if (type === 'product') return '#7A222E';
    if (type === 'event') return '#2563eb';
    if (type === 'referral') return '#4caf7d';
    return '#6a6a6a';
  };

  /* ── Should we show the EC card image on the right? ── */
  const showEcCardRight = exclusive;

  // ── Tier progress (every member starts at Blue, independent of Experience Card status) ──
  const currentTier = tierForBalance(pointsBalance);
  const nextTier = nextTierFor(currentTier);
  const tierProgress = nextTier
    ? Math.min(100, Math.max(0, ((pointsBalance - (currentTier?.floor ?? 0)) / (nextTier.floor - (currentTier?.floor ?? 0))) * 100))
    : 100;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '24px 16px 48px' : '48px 48px 80px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
      {/* Page Header */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'flex-start' : 'flex-end',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.4rem' }}>
            {t('dashboard.header.eyebrow')}
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem', color: '#1a1a1a' }}>
            {t('dashboard.header.title')}
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>
            {t('dashboard.header.subtitle')}
          </p>
        </div>

        {/* ── GATED: Claim Product button (red with white text) ── */}
        {exclusive ? (
          <button
            style={{
              background: '#7A222E',
              color: '#fff',
              border: 'none',
              padding: '13px 28px',
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              borderRadius: 4,
              transition: 'background 0.2s',
            }}
            onClick={() => navigate('/products')}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#7A222E')}
          >
            {t('dashboard.header.claimProduct')}
          </button>
        ) : (
          <LockedOverlay locked message={t('dashboard.locked.claimProduct')}>
            <button
              style={{
                background: '#7A222E',
                color: '#fff',
                border: 'none',
                padding: '13px 28px',
                fontSize: '11px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                borderRadius: 4,
              }}
            >
              {t('dashboard.header.claimProduct')}
            </button>
          </LockedOverlay>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#7A222E', marginBottom: '1rem', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* Profile + Welcome (split layout: left profile, right welcome + optional EC card) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '300px 1fr',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          marginBottom: '1px',
        }}
      >
        {/* ── Left: User profile card ── */}
        <div
          style={{
            background: '#f0ede6',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#1a1a1a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: '300',
              marginBottom: '1rem',
              color: '#f5f4f0',
              letterSpacing: '0.05em',
            }}
          >
            {userFirst?.[0]?.toUpperCase() || userDisplay?.[0]?.toUpperCase() || ''}
          </div>
          <div style={{ fontSize: '22px', fontWeight: 400, marginBottom: '2px', color: '#1a1a1a' }}>
            {userFirst || userDisplay}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {clean(user.city) || t('dashboard.profile.locationNotSet')} · {clean(user.country) || t('dashboard.profile.countryNotSet')}
          </div>

          {/* ── Tier badge (every member starts at Blue) ── */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              border: '1px solid #7A222E',
              background: 'rgba(122,34,46,0.06)',
              borderRadius: 4,
              marginBottom: '0.9rem',
            }}
          >
            <div style={{ width: '4px', height: '4px', background: '#7A222E', borderRadius: '50%' }} />
            <span style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, color: '#7A222E' }}>
              {currentTier
                ? t('dashboard.profile.tierBadge', { tier: currentTier.name })
                : t('dashboard.profile.noTierBadge')}
            </span>
          </div>

          {/* ── Tier progress bar ── */}
          <div style={{ width: '100%', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6a6a6a', marginBottom: '6px' }}>
              <span>{t('dashboard.profile.points', { count: pointsBalance, points: pointsBalance.toLocaleString('de-CH') })}</span>
              <span>{nextTier ? t('dashboard.profile.pointsToNextTier', { points: nextTier.floor.toLocaleString('de-CH'), tier: nextTier.name }) : t('dashboard.profile.maxTier')}</span>
            </div>
            <div style={{ height: '4px', background: '#e0ddd6', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${tierProgress}%`, background: '#7A222E', borderRadius: '2px', transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* ── Member / Admin since ── */}
          <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '4px', height: '4px', background: '#7A222E', borderRadius: '50%' }} />
            <span style={{ color: exclusive ? '#7A222E' : '#6a6a6a', fontWeight: exclusive ? 600 : 400 }}>
              {isAdmin
                ? t('dashboard.profile.adminSince', { year: memberSince })
                : hasExperienceCard
                  ? t('dashboard.profile.exclusiveMemberSince', { year: memberSince })
                  : t('dashboard.profile.memberSince', { year: memberSince })}
            </span>
          </div>

          {/* ── Exclusive Member badge (when user has the card) ── */}
          {hasExperienceCard && !isAdmin && (
            <div style={{
              marginTop: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              background: 'linear-gradient(135deg, #7A222E 0%, #9a2535 100%)',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(122,34,46,0.3)',
            }}>
              <span style={{ fontSize: 12, color: '#fff' }}>★</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#fff' }}>
                {t('dashboard.profile.exclusiveMemberBadge')}
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Welcome panel (split into greeting + optional EC card) ── */}
        <div
          style={{
            background: '#1a1a1a',
            padding: isMobile ? '1.5rem' : '2rem',
            display: 'grid',
            gridTemplateColumns: showEcCardRight ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
            gap: showEcCardRight ? '2rem' : 0,
            alignItems: 'center',
            color: '#fff',
          }}
        >
          {/* Left part: Greeting */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', height: '100%' }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>
              {t('dashboard.welcome.greeting')}
            </div>
            <div style={{ fontSize: 'clamp(28px, 3.2vw, 38px)', fontWeight: 200, lineHeight: 1.2, marginBottom: '1rem' }}>
              {t('dashboard.welcome.welcomeBack')}<br />
              <span style={{ color: '#f5f4f0' }}>{userFirst || userDisplay}.</span>
            </div>
            <div style={{ fontSize: '15px', color: '#999', lineHeight: 1.8, maxWidth: '420px' }}>
              {exclusive
                ? t('dashboard.welcome.exclusiveDesc')
                : t('dashboard.welcome.standardDesc')}
            </div>
          </div>

          {/* Right part: Experience Card image (only for exclusive members) */}
          {showEcCardRight && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}>
              <img
                src={EC_IMAGE}
                alt={t('dashboard.welcome.ecImageAlt')}
                style={{
                  width: '100%',
                  maxWidth: 280,
                  height: 'auto',
                  borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  objectFit: 'contain',
                }}
                onError={(e) => {
                  // Fallback to external URL if local file missing
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src="/images/experience-card.png";
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          borderTop: 0,
          marginBottom: '1px',
        }}
      >
        {/* Total Points */}
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
            {pointsBalance.toLocaleString('de-CH')}
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
            {t('dashboard.stats.totalPoints')}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
            {pointsThisMonth !== 0
              ? t('dashboard.stats.pointsThisMonth', { sign: pointsThisMonth > 0 ? '+' : '', count: pointsThisMonth.toLocaleString('de-CH') })
              : t('dashboard.stats.noActivityThisMonth')}
          </div>
        </div>

        {/* Products Claimed — always visible */}
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
            {stats.productsClaimed}
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
            {t('dashboard.stats.productsClaimed')}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
            {stats.productsClaimed === 0 ? t('dashboard.stats.getStartedClaim') : t('dashboard.stats.withActiveInsurance', { count: stats.insuranceActive })}
          </div>
        </div>

        {/* Events Attended (always visible, shows 0 for standard users) */}
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
            {exclusive ? stats.eventsAttended : 0}
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
            {t('dashboard.stats.eventsAttended')}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
            {t('dashboard.stats.upcomingCount', { count: exclusive ? stats.eventsUpcoming : 0 })}
          </div>
        </div>
      </div>

      {/* Activity + Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          borderTop: 0,
        }}
      >
        {/* Recent Activity */}
        <div style={{ background: '#fff', padding: isMobile ? '1.25rem' : '1.75rem' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#1a1a1a',
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}
          >
            {t('dashboard.activity.heading')}
          </div>

          {activity.length === 0 ? (
            <div style={{ color: '#6a6a6a', fontSize: '12px' }}>
              {t('dashboard.activity.empty')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activity.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: i < activity.length - 1 ? '0.75rem 0' : '0',
                    borderBottom: i < activity.length - 1 ? '1px solid #e0ddd6' : 'none',
                  }}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getActivityDotColor(item.type),
                      flexShrink: 0,
                      marginTop: '5px',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6a6a6a', marginTop: '2px' }}>
                      {formatDate(item.date)}
                    </div>
                  </div>
                  {typeof item.points === 'number' && item.points !== 0 && (
                    <div style={{ fontSize: '12px', fontWeight: 600, color: item.points > 0 ? '#4caf7d' : '#7A222E', whiteSpace: 'nowrap' }}>
                      {t('dashboard.activity.pointsValue', { sign: item.points > 0 ? '+' : '', count: item.points.toLocaleString('de-CH') })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Wallet Info */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e0ddd6' }}>
            <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1rem' }}>
              <strong style={{ color: '#1a1a1a' }}>{t('dashboard.activity.wallet.label')}</strong>
            </div>
            {user.walletAddress ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    background: '#f5f4f0',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    flex: 1,
                    minWidth: 0,
                    wordBreak: 'break-all',
                  }}
                >
                  {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-8)}
                </span>
                <button
                  onClick={handleCopyWallet}
                  style={{
                    background: copiedWallet ? '#2ecc71' : '#1a1a1a',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedWallet) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#333';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedWallet) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#1a1a1a';
                    }
                  }}
                >
                  {copiedWallet ? '✓' : t('dashboard.activity.wallet.copy')}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#6a6a6a' }}>{t('dashboard.activity.wallet.notConnected')}</div>
            )}
          </div>
        </div>

        {/* ── Quick Actions (always accessible) ── */}
        <div style={{ background: '#f0ede6', padding: isMobile ? '1.25rem' : '1.75rem' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#1a1a1a',
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}
          >
            {t('dashboard.quickActions.heading')}
          </div>
          {[
            {
              title: t('dashboard.quickActions.claimProduct.title'),
              sub: t('dashboard.quickActions.claimProduct.sub'),
              page: '/products',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              ),
            },
            {
              title: t('dashboard.quickActions.browseEvents.title'),
              sub: t('dashboard.quickActions.browseEvents.sub'),
              page: '/events',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              title: t('dashboard.quickActions.viewTier.title'),
              sub: nextTier
                ? t('dashboard.quickActions.viewTier.subProgress', { tier: currentTier ? currentTier.name : t('dashboard.profile.noTierShort'), points: Math.max(0, nextTier.floor - pointsBalance).toLocaleString('de-CH'), nextTier: nextTier.name })
                : t('dashboard.quickActions.viewTier.subMax', { tier: currentTier ? currentTier.name : t('dashboard.profile.noTierShort') }),
              page: '/rewards',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ),
            },
            {
              title: t('dashboard.quickActions.shareReferral.title'),
              sub: t('dashboard.quickActions.shareReferral.sub'),
              page: '/profile',
              icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
          ].map((action, i, arr) => (
            <div
              key={i}
              onClick={() => navigate(action.page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0.9rem 0',
                borderBottom: i < arr.length - 1 ? '1px solid #e0ddd6' : 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: '#fff',
                  border: '1px solid #e0ddd6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {action.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{action.title}</div>
                <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '1px' }}>{action.sub}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#6a6a6a', fontSize: '14px' }}>›</div>
            </div>
          ))}
        </div>
      </div>

      {/* NOTE: the welcome-gift modal that used to live here is gone. Its
          full-screen backdrop (z-index 10002) covered the OnboardingWidget
          (z-index 9999) for precisely the new members it was aimed at, so the
          offer was merged into that widget's "Complete your profile" step —
          see components/Onboarding/OnboardingWidget.tsx. */}

    </div>
  );
};

export default Dashboard;
