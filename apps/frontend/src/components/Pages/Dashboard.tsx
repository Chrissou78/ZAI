import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { CameraIcon, UploadIcon, SmartphoneIcon } from '../Icons/ClaimIcons';

interface DashboardStats {
  productsClaimed: number;
  eventsAttended: number;
  insuranceActive: number;
}

interface Activity {
  id: string;
  type: 'product' | 'event' | 'membership';
  title: string;
  date: string;
  icon: string;
}

// Preload pages the user is likely to visit next
  useEffect(() => {
    const timer = setTimeout(() => {
      import('../Pages/Products');
      import('../Pages/Events');
    }, 2000); // Wait 2s after dashboard renders, then preload
    return () => clearTimeout(timer);
  }, []);

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

const DashboardSkeleton: React.FC = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: "'Inter', sans-serif" }}>
    <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6' }}>
      <SkeletonBlock width="60px" height="11px" style={{ marginBottom: '0.6rem' }} />
      <SkeletonBlock width="220px" height="36px" style={{ marginBottom: '0.5rem' }} />
      <SkeletonBlock width="360px" height="13px" />
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', marginBottom: '1px' }}>
      <div style={{ background: '#f0ede6', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <SkeletonBlock width="56px" height="56px" style={{ borderRadius: '50%', marginBottom: '1rem' }} />
        <SkeletonBlock width="140px" height="16px" style={{ marginBottom: '6px' }} />
        <SkeletonBlock width="200px" height="11px" style={{ marginBottom: '1.25rem' }} />
        <SkeletonBlock width="100px" height="10px" />
      </div>
      <div style={{ background: '#1a1a1a', padding: '2rem' }}>
        <SkeletonBlock width="100px" height="10px" style={{ marginBottom: '0.75rem', background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
        <SkeletonBlock width="240px" height="28px" style={{ marginBottom: '1rem', background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
        <SkeletonBlock width="300px" height="12px" style={{ background: 'linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)', backgroundSize: '800px 100%', animation: 'zaiShimmer 1.6s infinite ease-in-out' }} />
      </div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0, marginBottom: '1px' }}>
      {[0, 1].map((i) => (
        <div key={i} style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <SkeletonBlock width="50px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBlock width="120px" height="11px" style={{ marginBottom: '4px' }} />
          <SkeletonBlock width="180px" height="11px" />
        </div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0 }}>
      <div style={{ background: '#fff', padding: '1.75rem' }}>
        <SkeletonBlock width="130px" height="11px" style={{ marginBottom: '1.25rem' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '0.75rem' }}>
            <SkeletonBlock width="20px" height="20px" style={{ flexShrink: 0, borderRadius: '50%' }} />
            <div style={{ flex: 1 }}>
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
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="70%" height="12px" style={{ marginBottom: '4px' }} />
              <SkeletonBlock width="50%" height="11px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ── Locked overlay for gated sections (light theme) ── */
const LockedOverlay: React.FC<{
  children: React.ReactNode;
  locked: boolean;
  message?: string;
}> = ({ children, locked, message }) => {
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
            Exclusive
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
            {message || 'Access exclusive content with the Experience Card membership.'}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Shared style constants ── */
const EC_BORDER = '#e0ddd6';
const EC_GRAY = '#6a6a6a';
const EC_RED = '#7A222E';
const EC_GOLD = '#7A222E';
const EC_SURFACE = '#f0ede6';

const ecInputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: `1px solid ${EC_BORDER}`,
  fontSize: '13px', boxSizing: 'border-box', fontFamily: "'Inter', sans-serif",
  borderRadius: 4,
};
const ecLabelStyle: React.CSSProperties = {
  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
  color: EC_GRAY, marginBottom: '6px', display: 'block',
};

/* ── Experience Card image path ──
   Save the experience card image to: apps/frontend/public/images/experience-card.png
   If you don't have the file yet, use the external URL as fallback. */
const EC_IMAGE = '/images/experience-card.png';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAppContext();
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    productsClaimed: 0,
    eventsAttended: 0,
    insuranceActive: 0,
  });
  const [activity, setActivity] = useState<Activity[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Experience card & admin checks ──
  const [hasExperienceCard, setHasExperienceCard] = useState(false);
  const [ecClaimStatus, setEcClaimStatus] = useState<'none' | 'pending' | 'validated'>('none');
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'owner';
  const exclusive = hasExperienceCard || isAdmin;

  // ── Derive display name (consistent with Sidebar) ──
  const { first: userFirst, last: userLast, display: userDisplay } = user ? getDisplayName(user) : { first: '', last: '', display: '' };

  // Detect a pending or validated Experience Card claim so the CTA can show
  // "under review" instead of inviting another claim.
  useEffect(() => {
    if (!user?.id || isAdmin || hasExperienceCard) { setEcClaimStatus('none'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.get('/products/claim-requests?mine=true');
        if (cancelled) return;
        const claims = ((res.data as any)?.data || []) as any[];
        const ec = claims.find(c => {
          const n = (c.productName || '').toLowerCase();
          return n.includes('experience') && n.includes('card');
        });
        setEcClaimStatus(ec ? (ec.status === 'validated' ? 'validated' : 'pending') : 'none');
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.id, isAdmin, hasExperienceCard]);
  const [showECModal, setShowECModal] = useState(false);
  const [ecData, setEcData] = useState<any>(null);
  const [ecLoading, setEcLoading] = useState(false);
  const [ecError, setEcError] = useState<string | null>(null);
  const [ecImage, setEcImage] = useState<string | null>(null);
  const [ecCid, setEcCid] = useState<string | null>(null);
  const [ecKey, setEcKey] = useState<string | null>(null);
  const [ecSubmitting, setEcSubmitting] = useState(false);
  const [ecSuccess, setEcSuccess] = useState(false);
  const ecFileInputRef = useRef<HTMLInputElement>(null);

  // Phone upload (QR handoff)
  const [ecShowQr, setEcShowQr] = useState(false);
  const [ecUploadToken, setEcUploadToken] = useState<string | null>(null);
  const [ecQrPolling, setEcQrPolling] = useState(false);
  const ecUploadPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isMobileDevice] = useState(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

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

  // ── Phone upload polling ──
  useEffect(() => {
    if (!ecQrPolling || !ecUploadToken) return;
    if (ecUploadPollRef.current) clearInterval(ecUploadPollRef.current);

    ecUploadPollRef.current = setInterval(async () => {
      try {
        const res = await apiService.get(`/products/claim-upload/${ecUploadToken}/status`);
        const data = res.data as any;
        if (data?.status === 'completed' && data?.proofImageCid) {
          setEcImage('phone-uploaded');
          setEcCid(data.proofImageCid || null);
          setEcKey(data.encryptionKey || null);
          setEcShowQr(false);
          setEcQrPolling(false);
          if (ecUploadPollRef.current) clearInterval(ecUploadPollRef.current);
        }
      } catch (err: any) {
        if (err?.response?.status === 410) {
          setEcQrPolling(false);
          setEcError('Upload link expired. Please try again.');
          setEcShowQr(false);
          if (ecUploadPollRef.current) clearInterval(ecUploadPollRef.current);
        }
      }
    }, 2000);

    return () => {
      if (ecUploadPollRef.current) { clearInterval(ecUploadPollRef.current); ecUploadPollRef.current = null; }
    };
  }, [ecQrPolling, ecUploadToken]);

  const fetchDashboardData = async () => {
    try {
      setDashboardLoading(true);
      setError(null);

      // Show cached data instantly while fetching fresh data
      const cached = sessionStorage.getItem(`zai_dashboard_${user?.id}`);
      if (cached) {
        try {
          const { stats: cachedStats, activity: cachedActivity, hasEc } = JSON.parse(cached);
          setStats(cachedStats);
          setActivity(cachedActivity);
          setHasExperienceCard(hasEc);
          setDashboardLoading(false); // Show cached data immediately
        } catch {}
      }

      const [productsResponse, eventsResponse] = await Promise.all([
        apiService.get(`/products/user/${user?.id}`),
        apiService.get('/events', { params: { status: 'upcoming' } }),
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

      const upcomingEvents = (eventsResponse.data as any)?.data || [];

      const recentActivity: Activity[] = [];

      if (products.length > 0) {
        const sortedProducts = [...products].sort((a: any, b: any) => {
          const dateA = a.claimedAt ? new Date(a.claimedAt).getTime() : 0;
          const dateB = b.claimedAt ? new Date(b.claimedAt).getTime() : 0;
          return dateB - dateA;
        });

        sortedProducts.slice(0, 3).forEach((product: any) => {
          recentActivity.push({
            id: product.id,
            type: 'product',
            title: `Product claimed: ${product.name}`,
            date: product.claimedAt || product.createdAt || '',
            icon: 'product',
          });
        });
      }

      if (upcomingEvents.length > 0) {
        upcomingEvents.slice(0, 2).forEach((event: any) => {
          recentActivity.push({
            id: event.id,
            type: 'event',
            title: `Event: ${event.title}`,
            date: event.date,
            icon: 'event',
          });
        });
      }

      recentActivity.sort((a, b) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });

      const newStats = {
        productsClaimed: products.length,
        eventsAttended: upcomingEvents.length,
        insuranceActive: products.filter((p: any) => p.insurance?.active).length,
      };

      setStats(newStats);
      setActivity(recentActivity);

      // Cache for instant display on next visit
      sessionStorage.setItem(`zai_dashboard_${user?.id}`, JSON.stringify({
        stats: newStats,
        activity: recentActivity,
        hasEc: ecFound,
      }));

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.error || 'Failed to load dashboard');
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

  // ── Experience Card claim handlers ──
  const handleClaimMembership = async () => {
    setShowECModal(true);
    setEcLoading(true);
    setEcError(null);
    setEcSuccess(false);
    setEcImage(null);
    setEcCid(null);
    setEcKey(null);
    setEcData(null);
    setEcShowQr(false);
    setEcQrPolling(false);
    setEcUploadToken(null);
    try {
      const res = await apiService.get('/products/experience-card');
      const data = (res.data as any)?.data;
      if (!data) {
        setEcError('Experience Card not available at the moment.');
        return;
      }
      setEcData(data);
    } catch (err: any) {
      setEcError(err?.response?.data?.error || 'Failed to load Experience Card details.');
    } finally {
      setEcLoading(false);
    }
  };

  const handleEcImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setEcError('Image must be under 8 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEcImage(reader.result as string);
      setEcError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleEcUsePhone = async () => {
    try {
      const res = await apiService.post('/products/claim-upload/create-token');
      const payload = res.data as any;
      if (payload?.success && payload.token) {
        setEcUploadToken(payload.token);
        setEcShowQr(true);
        setEcQrPolling(true);
      } else {
        setEcError('Failed to generate upload link');
      }
    } catch {
      setEcError('Failed to generate upload link');
    }
  };

  const handleEcSubmit = async () => {
    if (!ecImage && !ecCid) return;
    setEcSubmitting(true);
    setEcError(null);
    try {
      const body: any = {
        productName: ecData?.name || 'zai Experience Club Card',
        productId: ecData?.rwaId || '',
      };
      if (ecCid) {
        body.preUploadedCid = ecCid;
        body.preUploadedKey = ecKey;
      } else {
        body.proofImage = ecImage;
      }
      const res = await apiService.post('/products/claim-request', body);
      const payload = res.data as any;
      if (payload?.success) {
        setEcSuccess(true);
        setEcClaimStatus('pending');
      } else {
        setEcError(payload?.error || 'Submission failed');
      }
    } catch (err: any) {
      setEcError(err?.response?.data?.error || err?.message || 'Submission failed');
    } finally {
      setEcSubmitting(false);
    }
  };

  const closeECModal = () => {
    setShowECModal(false);
    setEcShowQr(false);
    setEcQrPolling(false);
    if (ecUploadPollRef.current) { clearInterval(ecUploadPollRef.current); ecUploadPollRef.current = null; }
  };

  if (isLoading || !user) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  const formatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'Claimed';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Claimed';

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const isFuture = diffMs < 0;
      const absDiffMs = Math.abs(diffMs);
      const diffMinutes = Math.floor(absDiffMs / (1000 * 60));
      const diffHours = Math.floor(absDiffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));

      if (isFuture) {
        if (diffDays === 0 && diffHours < 24) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays < 7) return `In ${diffDays} days`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
      }
      if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      }

      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr || 'Claimed';
    }
  };

  const getActivityDotColor = (type: string) => {
    if (type === 'product') return '#7A222E';
    if (type === 'event') return '#2563eb';
    return '#6a6a6a';
  };

  /* ── Should we show the EC card image on the right? ── */
  const showEcCardRight = exclusive;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header */}
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
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.4rem' }}>
            overview
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem', color: '#1a1a1a' }}>
            Dashboard
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>
            Your zai experience club at a glance — products, events, and upcoming activity.
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
            Claim Product
          </button>
        ) : (
          <LockedOverlay locked message="Claim your Experience Card to unlock product claims.">
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
              Claim Product
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
          gridTemplateColumns: '300px 1fr',
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
            alignItems: 'center',
            textAlign: 'center',
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
          <div style={{ fontSize: '17px', fontWeight: 300, marginBottom: '2px' }}>
            {userFirst || userDisplay}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {user.city || 'Location not set'} · {user.country || 'Country not set'}
          </div>
          {/* ── Tier badge ── */}
          <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '4px', height: '4px', background: '#7A222E', borderRadius: '50%' }} />
            <span style={{ color: exclusive ? '#7A222E' : '#6a6a6a', fontWeight: exclusive ? 600 : 400 }}>
              {isAdmin ? 'Admin' : hasExperienceCard ? 'Exclusive Member' : 'Member'} since {memberSince}
            </span>
          </div>

          {/* ── Claim Membership CTA (only for non-exclusive, non-admin users) ── */}
          {!exclusive && ecClaimStatus === 'pending' ? (
            <div
              style={{
                marginTop: '1rem',
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid #7A222E',
                color: '#7A222E',
                fontSize: '10px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                borderRadius: 4,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                width: 'fit-content',
              }}
            >
              <span>&#9203;</span> Membership under review
            </div>
          ) : !exclusive ? (
            <button
              onClick={handleClaimMembership}
              style={{
                marginTop: '1rem',
                padding: '10px 20px',
                background: '#7A222E',
                border: 'none',
                color: '#fff',
                fontSize: '10px',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                transition: 'background 0.2s',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#9a2535';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#7A222E';
              }}
            >
              CLAIM YOUR ZAI EXPERIENCE CLUB MEMBERSHIP
            </button>
          ) : null}

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
                Exclusive Member
              </span>
            </div>
          )}
        </div>

        {/* ── Right: Welcome panel (split into greeting + optional EC card) ── */}
        <div
          style={{
            background: '#1a1a1a',
            padding: '2rem',
            display: 'grid',
            gridTemplateColumns: showEcCardRight ? '1fr 1fr' : '1fr',
            gap: showEcCardRight ? '2rem' : 0,
            alignItems: 'center',
            color: '#fff',
          }}
        >
          {/* Left part: Greeting + stats */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>
                Good to see you
              </div>
              <div style={{ fontSize: '28px', fontWeight: 200, lineHeight: 1.2, marginBottom: '1rem' }}>
                Welcome back,<br />
                <span style={{ color: '#f5f4f0' }}>{userFirst || userDisplay}.</span>
              </div>
              <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.8, maxWidth: '380px' }}>
                {exclusive
                  ? 'Explore exclusive events, manage your registered products, and access the full zai experience club.'
                  : 'Claim your zai Experience Card to unlock your collection, exclusive events, and the full zai experience.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0, border: '1px solid #2a2a2a', marginTop: '1.5rem', width: 'fit-content' }}>
              <div style={{ padding: '1rem 1.5rem', borderRight: '1px solid #2a2a2a', textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: 200, color: '#f5f4f0' }}>
                  {stats.productsClaimed}
                </div>
                <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '2px' }}>
                  Products
                </div>
              </div>
              {/* ── Events counter (always visible, shows 0 for standard users) ── */}
                <div style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 200, color: exclusive ? '#fff' : '#555' }}>
                    {exclusive ? stats.eventsAttended : 0}
                  </div>
                  <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '2px' }}>
                    Events
                  </div>
                </div>
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
                alt="zai Experience Club Card"
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
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          borderTop: 0,
          marginBottom: '1px',
        }}
      >
        {/* Products Claimed — always visible */}
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
            {stats.productsClaimed}
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
            Products claimed
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
            {stats.productsClaimed === 0 ? 'Get started by claiming a product' : `${stats.insuranceActive} with active insurance`}
          </div>
        </div>

        {/* ── Upcoming Events stat (always visible, shows 0 for standard users) ── */}
          <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
            <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
              {exclusive ? stats.eventsAttended : 0}
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
              Upcoming events
            </div>
            <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
              {exclusive
                ? (stats.eventsAttended === 0 ? 'Check upcoming events' : 'Registrations active')
                : '0 events'}
            </div>
          </div>
      </div>

      {/* Activity + Quick Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
          borderTop: 0,
        }}
      >
        {/* Recent Activity */}
        <div style={{ background: '#fff', padding: '1.75rem' }}>
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
            Recent activity
          </div>

          {activity.length === 0 ? (
            <div style={{ color: '#6a6a6a', fontSize: '12px' }}>
              No recent activity. Start by claiming a product or registering for an event!
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: '#1a1a1a', fontWeight: 500 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6a6a6a', marginTop: '2px' }}>
                      {formatDate(item.date)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Wallet Info */}
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e0ddd6' }}>
            <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1rem' }}>
              <strong style={{ color: '#1a1a1a' }}>Wallet Address:</strong>
            </div>
            {user.walletAddress ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    background: '#f5f4f0',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    flex: 1,
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
                  {copiedWallet ? '✓' : 'Copy'}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#6a6a6a' }}>No wallet connected</div>
            )}
          </div>
        </div>

        {/* ── Quick Actions (always accessible) ── */}
        <div style={{ background: '#f0ede6', padding: '1.75rem' }}>
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
            Quick actions
          </div>
          {[
            {
              title: 'Claim a product',
              sub: 'NFC or serial number',
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
              title: 'Browse events',
              sub: 'See upcoming events',
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
          ].map((action, i) => (
            <div
              key={i}
              onClick={() => navigate(action.page)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0.9rem 0',
                borderBottom: i === 0 ? '1px solid #e0ddd6' : 'none',
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{action.title}</div>
                <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '1px' }}>{action.sub}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: '#6a6a6a', fontSize: '14px' }}>›</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════ Experience Card Claim Modal (proof-of-purchase flow) ══════ */}
      {showECModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => { if (!ecSubmitting) closeECModal(); }}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, padding: '2rem',
              maxWidth: 480, width: '90%', position: 'relative',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              fontFamily: "'Inter', sans-serif",
              maxHeight: '90vh', overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeECModal}
              disabled={ecSubmitting}
              style={{
                position: 'absolute', top: 12, right: 12,
                background: 'none', border: 'none', fontSize: 18,
                cursor: ecSubmitting ? 'not-allowed' : 'pointer',
                color: '#999', padding: '4px 8px',
              }}
            >
              &times;
            </button>

            {ecSuccess ? (
              /* ── Success state ── */
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>&#x2713;</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: '#1a1a1a' }}>
                  Claim Submitted!
                </h3>
                <p style={{ fontSize: 13, color: EC_GRAY, lineHeight: 1.6, marginBottom: 20 }}>
                  Your proof of ownership is being reviewed. Once validated, your zai Experience Club Card will be minted and your exclusive membership activated.
                </p>
                <button
                  onClick={() => { closeECModal(); fetchDashboardData(); }}
                  style={{
                    background: EC_RED, color: '#fff', border: 'none',
                    padding: '12px 28px', fontSize: 12, letterSpacing: '0.15em',
                    textTransform: 'uppercase', cursor: 'pointer', borderRadius: 4,
                    fontFamily: "'Inter', sans-serif", fontWeight: 600,
                  }}
                >
                  Done
                </button>
              </div>

            ) : ecLoading && !ecData ? (
              /* ── Loading state ── */
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <div style={{
                  width: 32, height: 32,
                  border: `3px solid ${EC_BORDER}`,
                  borderTopColor: EC_RED,
                  borderRadius: '50%',
                  animation: 'zai-spin 0.8s linear infinite',
                  margin: '0 auto 16px',
                }} />
                <p style={{ fontSize: 13, color: EC_GRAY }}>Loading Experience Card...</p>
              </div>

            ) : ecShowQr && ecUploadToken ? (
              /* ── QR Code screen — desktop waits for phone upload ── */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '16px 0' }}>
                <div style={{
                  fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: EC_RED, fontWeight: 600,
                }}>
                  Exclusive Membership
                </div>
                <p style={{ fontSize: 14, fontWeight: 500, margin: 0, textAlign: 'center' }}>
                  Scan with your phone to take a photo
                </p>
                <p style={{ fontSize: 12, color: EC_GRAY, margin: 0, textAlign: 'center', maxWidth: 300 }}>
                  Your phone will open a camera page. After you take the photo it will appear here automatically.
                </p>
                <div style={{
                  padding: 16, background: '#fff', borderRadius: 12,
                  border: `1px solid ${EC_BORDER}`, display: 'inline-block',
                }}>
                  <QRCodeSVG
                    value={`https://${window.location.host}/api/products/claim-upload/${ecUploadToken}/page`}
                    size={200}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 16, height: 16, border: `2px solid ${EC_BORDER}`,
                    borderTopColor: EC_RED, borderRadius: '50%',
                    animation: 'zai-spin 0.8s linear infinite',
                  }} />
                  <span style={{ fontSize: 12, color: EC_GRAY }}>Waiting for photo&hellip;</span>
                </div>
                <button
                  onClick={() => { setEcShowQr(false); setEcQrPolling(false); }}
                  style={{
                    background: 'none', border: 'none', color: EC_GRAY,
                    fontSize: 12, cursor: 'pointer', textDecoration: 'underline',
                  }}
                >
                  &larr; Back to upload options
                </button>
              </div>

            ) : (
              /* ── Main claim form ── */
              <>
                <div style={{
                  fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase',
                  color: EC_RED, marginBottom: 12, fontWeight: 600,
                }}>
                  Exclusive Membership
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: '#1a1a1a' }}>
                  {ecData?.name || 'zai Experience Club Card'}
                </h3>
                <p style={{ fontSize: 13, color: EC_GRAY, lineHeight: 1.6, marginBottom: 16 }}>
                  The zai Experience Club is an exclusive club for zai members who have spent more than CHF 500 on zai products. If you feel like you meet this criteria, please upload your invoice using one of the options below to submit your membership request.
                </p>

                {ecData?.image && (
                  <div style={{
                    width: '100%', borderRadius: 8, overflow: 'hidden',
                    marginBottom: 16, background: EC_SURFACE,
                  }}>
                    <img
                      src={ecData.image}
                      alt={ecData.name}
                      style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 8 }}
                    />
                  </div>
                )}

                {/* ── Proof of Ownership ── */}
                <div style={{ marginBottom: 16 }}>
                  <label style={ecLabelStyle}>Proof of Ownership</label>

                  {!ecImage ? (
                    <div style={{ display: 'flex', gap: 12 }}>
                      {/* OPTION 1: Camera (mobile) or QR handoff (desktop) */}
                      {isMobileDevice ? (
                        <label
                          style={{
                            flex: 1, padding: '20px 16px', border: `2px dashed ${EC_BORDER}`, borderRadius: 8,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = EC_RED)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = EC_BORDER)}
                        >
                          <CameraIcon size={28} color="#2e2e2e" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#2e2e2e' }}>Take Photo</span>
                          <span style={{ fontSize: 10, color: EC_GRAY }}>Open camera</span>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            style={{ display: 'none' }}
                            onChange={handleEcImageCapture}
                          />
                        </label>
                      ) : (
                        <div
                          onClick={handleEcUsePhone}
                          style={{
                            flex: 1, padding: '20px 16px', border: `2px dashed ${EC_BORDER}`, borderRadius: 8,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = EC_RED)}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = EC_BORDER)}
                        >
                          <SmartphoneIcon size={28} color="#2e2e2e" />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#2e2e2e' }}>Use Phone</span>
                          <span style={{ fontSize: 10, color: EC_GRAY }}>Scan QR to take photo</span>
                        </div>
                      )}

                      {/* OPTION 2: File upload */}
                      <label
                        style={{
                          flex: 1, padding: '20px 16px', border: `2px dashed ${EC_BORDER}`, borderRadius: 8,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'border-color 0.2s', textAlign: 'center',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = EC_RED)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = EC_BORDER)}
                      >
                        <UploadIcon size={28} color="#2e2e2e" />
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#2e2e2e' }}>Upload Image</span>
                        <span style={{ fontSize: 10, color: EC_GRAY }}>JPG, PNG, WebP</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic"
                          style={{ display: 'none' }}
                          onChange={handleEcImageCapture}
                          ref={ecFileInputRef}
                        />
                      </label>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      {ecCid ? (
                        /* Phone-uploaded (encrypted) — show confirmation */
                        <div style={{
                          width: '100%', padding: '24px 20px', borderRadius: 8,
                          background: EC_SURFACE, textAlign: 'center',
                          border: `1px solid ${EC_BORDER}`,
                        }}>
                          <div style={{ marginBottom: 8 }}>
                            <CameraIcon size={32} color="#2e2e2e" />
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
                            Photo received from phone
                          </div>
                          <div style={{ fontSize: 11, color: EC_GRAY }}>
                            Encrypted and ready to submit
                          </div>
                        </div>
                      ) : (
                        /* Local file preview */
                        <img
                          src={ecImage!}
                          alt="Proof of ownership"
                          style={{
                            width: '100%', maxHeight: 200, objectFit: 'contain',
                            borderRadius: 8, border: `1px solid ${EC_BORDER}`,
                          }}
                        />
                      )}
                      {/* Remove image button */}
                      <button
                        onClick={() => { setEcImage(null); setEcCid(null); setEcKey(null); }}
                        style={{
                          position: 'absolute', top: 8, right: 8,
                          background: 'rgba(0,0,0,0.6)', color: '#fff',
                          border: 'none', borderRadius: '50%',
                          width: 24, height: 24, fontSize: 14,
                          cursor: 'pointer', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        &times;
                      </button>
                    </div>
                  )}
                </div>

                {ecError && (
                  <div style={{
                    padding: '10px 12px', background: '#fff5f5', border: '1px solid #ffdddd',
                    color: EC_RED, fontSize: 12, borderRadius: 6, marginBottom: 16,
                  }}>
                    {ecError}
                  </div>
                )}

                <button
                  onClick={handleEcSubmit}
                  disabled={ecSubmitting || (!ecImage && !ecCid)}
                  style={{
                    width: '100%',
                    background: (ecSubmitting || (!ecImage && !ecCid)) ? '#ccc' : EC_RED,
                    color: '#fff', border: 'none',
                    padding: '14px', fontSize: 11, letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: (ecSubmitting || (!ecImage && !ecCid)) ? 'not-allowed' : 'pointer',
                    borderRadius: 4, fontFamily: "'Inter', sans-serif",
                    fontWeight: 600, transition: 'background 0.2s',
                  }}
                >
                  {ecSubmitting ? 'Submitting...' : 'Submit for Review'}
                </button>

                <p style={{ fontSize: 11, color: EC_GRAY, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                  An admin will review your proof and mint your membership card once validated.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
