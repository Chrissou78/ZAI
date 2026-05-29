import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

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

/* ── Loading overlay for the whole dashboard content ── */
const DashboardSkeleton: React.FC = () => (
  <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: "'Inter', sans-serif" }}>
    {/* Header skeleton */}
    <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6' }}>
      <SkeletonBlock width="60px" height="11px" style={{ marginBottom: '0.6rem' }} />
      <SkeletonBlock width="220px" height="36px" style={{ marginBottom: '0.5rem' }} />
      <SkeletonBlock width="360px" height="13px" />
    </div>

    {/* Profile + Welcome skeleton */}
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

    {/* Stats skeleton */}
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
      {[0, 1].map((i) => (
        <div key={i} style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <SkeletonBlock width="50px" height="32px" style={{ marginBottom: '8px' }} />
          <SkeletonBlock width="120px" height="11px" style={{ marginBottom: '4px' }} />
          <SkeletonBlock width="180px" height="11px" />
        </div>
      ))}
    </div>

    {/* Activity + Quick actions skeleton */}
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

  const fetchDashboardData = async () => {
    try {
      setDashboardLoading(true);
      setError(null);

      const productsResponse = await apiService.get(`/products/user/${user?.id}`);
      const products = productsResponse.data?.data || [];

      const eventsResponse = await apiService.get('/events', { params: { status: 'upcoming' } });
      const upcomingEvents = eventsResponse.data?.data || [];

      const recentActivity: Activity[] = [];

      if (products.length > 0) {
        // ── CHANGED: sort products with unknown dates last instead of first ──
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
            // Use claimedAt from API — never fake it with new Date()
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

      setStats({
        productsClaimed: products.length,
        eventsAttended: upcomingEvents.length,
        insuranceActive: products.filter((p: any) => p.insurance?.active).length,
      });

      setActivity(recentActivity);
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

  if (isLoading || !user) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (dashboardLoading) {
    return <DashboardSkeleton />;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  // ── CHANGED: formatDate now returns "Claimed" (no date) for unknown product dates ──
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

  /* Activity dot color: product = red, event = blue */
  const getActivityDotColor = (type: string) => {
    if (type === 'product') return '#7A222E';
    if (type === 'event') return '#2563eb';
    return '#6a6a6a';
  };

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
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#7A222E',
              marginBottom: '0.4rem',
            }}
          >
            overview
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem', color: '#1a1a1a' }}>
            Dashboard
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>
            Your zai experience club at a glance — products, events, and upcoming activity.
          </p>
        </div>
        <button
          style={{
            background: '#7D1E2C',
            color: '#fff',
            border: 'none',
            padding: '13px 28px',
            fontSize: '11px',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            fontFamily: "'Inter', sans-serif",
            transition: 'background 0.2s',
          }}
          onClick={() => navigate('/products')}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
        >
          Claim Product
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#7A222E', marginBottom: '1rem', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {/* Profile + Welcome */}
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
            {user.givenName?.[0]}{user.familyName?.[0]}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 300, marginBottom: '2px' }}>
            {user.givenName} {user.familyName}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {user.email} · {user.city || 'Location not set'} - {user.country || 'Country not set'}
          </div>
          <div style={{ fontSize: '10px', color: '#6a6a6a', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '4px', height: '4px', background: '#7A222E', borderRadius: '50%' }} />
            Member since {memberSince}
          </div>
        </div>

        <div
          style={{
            background: '#1a1a1a',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            color: '#fff',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>
              Good to see you
            </div>
            <div style={{ fontSize: '28px', fontWeight: 200, lineHeight: 1.2, marginBottom: '1rem' }}>
              Welcome back,<br />
              <span style={{ color: '#f5f4f0' }}>{user.givenName}.</span>
            </div>
            <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.8, maxWidth: '380px' }}>
              {user.email && 'Explore exclusive events, manage your registered products, and access the full zai experience club.'}
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
            <div style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 200, color: '#fff' }}>
                {stats.eventsAttended}
              </div>
              <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '2px' }}>
                Events
              </div>
            </div>
          </div>
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
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>
            {stats.eventsAttended}
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>
            Upcoming events
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
            {stats.eventsAttended === 0 ? 'Check upcoming events' : 'Registrations active'}
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
                  {/* Red/Blue dot */}
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

        {/* Quick Actions */}
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
    </div>
  );
};

export default Dashboard;
