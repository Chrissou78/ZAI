import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext  } from '../../context/AppContext';

// ── Design tokens — dark theme, matching the shared loyalty-program design ──
const C = {
  black: '#0a0a0a', card: '#141414', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', lightGray: '#999', border: '#e0ddd6', borderDark: '#2a2a2a',
  surface: '#f0ede6', surface2: '#e8e5de', green: '#4caf7d', pureWhite: '#ffffff',
  font: "'Inter', sans-serif",
};
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};

// ── Tier meta — each tier's own accent color drives its badge, top border,
// and bullet dots throughout the page. ──
const TIERS = [
  { name: 'Blue',    floor: 0,     ceiling: 14999,  color: '#4a7fb5',
    benefits: ['Product registration', 'Event newsletter', 'Digital warranty'] },
  { name: 'Red',     floor: 15000, ceiling: 29999,  color: C.red,
    benefits: ['Priority event access', 'Maintenance discount', 'Partner benefits', 'Dedicated support'] },
  { name: 'Black',   floor: 30000, ceiling: 49999,  color: '#9a9a9a',
    benefits: ['VIP event invitations', 'Early product launches', 'Custom fitting service', 'Partner elite access', 'Referral bonuses'] },
  { name: 'Diamond', floor: 50000, ceiling: null,   color: '#b8a888',
    benefits: ['Factory visits, Pontresina', 'Bespoke commission', 'Personal zai ambassador', 'All partner elite benefits', 'Annual zai retreat'] },
];

// Highlighted perks shown for whichever tier the member currently holds.
const TIER_HIGHLIGHTS = [
  {
    title: 'Free Ski Insurance',
    description: 'Complimentary insurance on every new zai ski purchase.',
    icon: <path d="M8 1l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />,
  },
  {
    title: 'VIP Event Access',
    description: 'Priority invitations to ski demos, factory tours, and exclusive experiences.',
    icon: <><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M5 1v3M11 1v3M2 7h12" /></>,
  },
  {
    title: 'Partner Elite Access',
    description: 'Premium perks with Revolut, Ikon Pass, Epic Pass and Engadin.',
    icon: <path d="M13 6c0 4-5 8-5 8S3 10 3 6a5 5 0 0110 0z" />,
  },
];

function tierIndex(name: string) {
  return TIERS.findIndex(t => t.name.toLowerCase() === (name || '').toLowerCase());
}

export default function Rewards() {
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const standingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [balRes, histRes] = await Promise.all([
          fetch('/api/store/rewards/balance', { headers: { Authorization: `Bearer ${localStorage.getItem('zai_token')}` } }),
          fetch('/api/store/rewards/history?limit=10', { headers: { Authorization: `Bearer ${localStorage.getItem('zai_token')}` } }),
        ]);
        if (!cancelled) {
          const balJson = await balRes.json();
          const histJson = await histRes.json();
          if (balJson.success) setData(balJson.data);
          if (histJson.success) setHistory(histJson.data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const currentTierIdx = data ? tierIndex(data.tier) : 0;
  const currentTier = TIERS[currentTierIdx] || TIERS[0];
  const nextTier = currentTierIdx < TIERS.length - 1 ? TIERS[currentTierIdx + 1] : null;

  const progress = useMemo(() => {
    if (!data || !nextTier) return 100;
    const range = nextTier.floor - currentTier.floor;
    return Math.min(100, Math.max(0, ((data.balance - currentTier.floor) / range) * 100));
  }, [data, currentTier, nextTier]);

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center', background: C.black, minHeight: '100vh' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.borderDark}`, borderTopColor: C.red, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>Loading rewards…</span>
      </div>
    );
  }

  const balance = data?.balance || 0;

  return (
    <div style={{ background: C.black, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 40px 80px', fontFamily: C.font, color: C.gray }}>

        {/* ══════ PAGE HEADER ══════ */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ ...LABEL, color: C.red, letterSpacing: '0.3em', marginBottom: 10, fontSize: 10 }}>
            LOYALTY PROGRAM
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 12px', color: C.pureWhite }}>
            Rewards &amp; Tiers
          </h1>
          <p style={{ color: C.lightGray, fontSize: 14, margin: 0, fontWeight: 300, maxWidth: 640, lineHeight: 1.6 }}>
            Earn 2.7 points for every CHF spent on zai products. Climb through four exclusive
            tiers to unlock increasingly premium rewards, deals, and experiences.
          </p>
        </div>

        {/* ── Tier showcase — the four tiers on their own terms, not scoped
            to "your" progress. Current tier gets a small marker rather than
            a full highlight, since the section below is where personal
            standing is the focus. ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 1, background: C.borderDark, marginBottom: 32,
        }}>
          {TIERS.map((tier, i) => {
            const isCurrent = i === currentTierIdx;
            return (
              <div key={tier.name} style={{
                padding: '2rem 1.5rem', position: 'relative',
                background: C.card, borderTop: `2px solid ${tier.color}`,
              }}>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: '1rem', right: '1rem', fontSize: 8,
                    letterSpacing: '0.15em', textTransform: 'uppercase', padding: '3px 7px',
                    background: `${tier.color}22`, border: `1px solid ${tier.color}`, color: tier.color,
                  }}>Your tier</div>
                )}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 600, marginBottom: 20,
                  background: tier.color, color: '#fff',
                }}>
                  {tier.name[0]}
                </div>
                <div style={{ fontSize: 17, fontWeight: 600, color: C.pureWhite, marginBottom: 3 }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: '1.5rem' }}>
                  {tier.floor === 0 ? 'Starting tier' : `${tier.floor.toLocaleString('de-CH')}+ pts`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {tier.benefits.map(b => (
                    <li key={b} style={{
                      fontSize: 12, lineHeight: 1.4, color: '#b8b8b8',
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <span style={{
                        width: 4, height: 4, marginTop: 5, borderRadius: '50%',
                        background: tier.color, flexShrink: 0,
                      }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <button
            onClick={() => standingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            style={{
              padding: '14px 32px', background: C.red, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
              borderRadius: 3, cursor: 'pointer', fontFamily: C.font, transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
            onMouseLeave={e => (e.currentTarget.style.background = C.red)}
          >
            View My Rewards
          </button>
        </div>

        {/* ── Your current standing ── */}
        <div ref={standingRef} style={{
          background: C.card, border: `1px solid ${C.borderDark}`, padding: '2rem',
          marginBottom: 1,
        }}>
          <div style={{ ...LABEL, color: C.lightGray, marginBottom: 8 }}>YOUR CURRENT STANDING</div>
          <div style={{ fontSize: 36, fontWeight: 200, color: C.pureWhite }}>
            {currentTier.name} <em style={{ fontStyle: 'normal', color: currentTier.color }}>Tier</em>
          </div>
        </div>

        {/* ── Progress section — bar and CTA stay visible at max tier (100%
            filled) rather than disappearing, so the layout doesn't collapse
            and members can still claim products for points. ── */}
        <div style={{
          background: C.card, border: `1px solid ${C.borderDark}`, borderTop: 0, padding: '2rem',
          display: 'grid', gridTemplateColumns: '1fr 280px', gap: '3rem', alignItems: 'center',
          marginBottom: '2.5rem',
        }}>
          <div>
            <div style={{ ...LABEL, marginBottom: 6 }}>
              {nextTier ? `PROGRESS TO ${nextTier.name.toUpperCase()}` : 'MAXIMUM TIER REACHED'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 200, color: C.pureWhite, lineHeight: 1.2 }}>
              {balance.toLocaleString('de-CH')}
              {nextTier && (
                <span style={{ color: C.gray, fontWeight: 300 }}> / <em style={{ fontStyle: 'normal' }}>{nextTier.floor.toLocaleString('de-CH')} points</em></span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
              {nextTier
                ? 'Claim a new ski (+500 pts) or attend an event (+150 pts) to accelerate your progress.'
                : "You've unlocked every tier. Keep claiming products and attending events to earn more points."}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.gray, marginBottom: 6 }}>
              <span>Current</span><span>{nextTier ? nextTier.name : 'Max'}</span>
            </div>
            <div style={{ height: 4, background: C.borderDark, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: C.red, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 6 }}>
              <span style={{ color: C.red }}>{balance.toLocaleString('de-CH')} pts</span>
              {nextTier && <span style={{ color: C.gray }}>{nextTier.floor.toLocaleString('de-CH')} pts</span>}
            </div>
            <button
              onClick={() => navigate('/products')}
              style={{
                marginTop: '1rem', width: '100%', padding: '14px 28px',
                background: C.red, color: '#fff', border: 'none',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: C.font, transition: 'background 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
              onMouseLeave={e => (e.currentTarget.style.background = C.red)}
            >
              Claim product · +500 pts
            </button>
          </div>
        </div>

        {/* ── Your {tier} benefits ── */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            ...LABEL, marginBottom: '1rem', paddingBottom: '0.75rem',
            borderBottom: `1px solid ${C.borderDark}`,
          }}>Your {currentTier.name} benefits</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 1, background: C.borderDark,
          }}>
            {TIER_HIGHLIGHTS.map(h => (
              <div key={h.title} style={{ background: C.card, padding: '1.5rem' }}>
                <div style={{
                  width: 32, height: 32, border: `1px solid ${C.borderDark}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem',
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill={C.red}>{h.icon}</svg>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.pureWhite, marginBottom: 4 }}>{h.title}</div>
                <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.6 }}>{h.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Points Activity ── */}
        {history.length > 0 && (
          <div>
            <div style={{ ...LABEL, marginBottom: 16 }}>RECENT ACTIVITY</div>
            {history.map((h: any) => (
              <div key={h.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: `1px solid ${C.borderDark}`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.pureWhite }}>{h.description || h.type}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>
                    {new Date(h.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: h.amount > 0 ? C.green : C.red,
                }}>
                  {h.amount > 0 ? '+' : ''}{h.amount.toLocaleString('de-CH')} pts
                </div>
              </div>
            ))}
          </div>
        )}

        <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
