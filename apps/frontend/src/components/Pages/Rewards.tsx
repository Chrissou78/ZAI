import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext  } from '../../context/AppContext';

// ── Design tokens (match your existing De/Ze) ──
const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6',
  surface2: '#e8e5de', green: '#4caf7d', pureWhite: '#ffffff',
  font: "'Inter', sans-serif",
};
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};

// ── Tier meta ──
const TIERS = [
  { name: 'Blue',    num: '01', floor: 0,     ceiling: 14999,
    benefits: ['Product registration', 'Event newsletter', 'Digital warranty'] },
  { name: 'Red',     num: '02', floor: 15000, ceiling: 29999,
    benefits: ['Priority event access', 'Maintenance discount', 'Partner benefits', 'Dedicated support'] },
  { name: 'Black',   num: '03', floor: 30000, ceiling: 49999,
    benefits: ['VIP event invitations', 'Early product launches', 'Custom fitting service', 'Partner elite access', 'Referral bonuses'] },
  { name: 'Diamond', num: '04', floor: 50000, ceiling: null,
    benefits: ['Factory visits, Pontresina', 'Bespoke commission', 'Personal zai ambassador', 'All partner elite benefits', 'Annual zai retreat'] },
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
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.red, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>Loading rewards…</span>
      </div>
    );
  }

  const balance = data?.balance || 0;

  return (
    <div style={{ fontFamily: C.font, color: C.black, paddingBottom: 64 }}>
      {/* ── TOP: Current Standing ── */}
      <div style={{
        background: C.black, color: C.white, padding: '48px 48px 40px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, fontWeight: 500, marginBottom: 12 }}>
            POINTS &amp; TIERS
          </div>
          <div style={{ ...LABEL, color: '#999', marginBottom: 8 }}>YOUR CURRENT STANDING</div>
          <h1 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 300, margin: 0, lineHeight: 1.15 }}>
            {currentTier.name} Tier
          </h1>
        </div>
      </div>

      {/* ── MIDDLE: 4 Tier Cards ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 0, marginTop: -1, border: `1px solid ${C.border}`,
        }}>
          {TIERS.map((tier, i) => {
            const isCurrent = i === currentTierIdx;
            return (
              <div key={tier.name} style={{
                padding: '28px 24px', borderRight: i < 3 ? `1px solid ${C.border}` : 'none',
                background: isCurrent ? C.black : C.pureWhite,
                color: isCurrent ? C.white : C.black, position: 'relative',
              }}>
                {isCurrent && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12, fontSize: 8,
                    fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
                    padding: '3px 8px', border: '1px solid #555', color: '#ccc',
                  }}>YOUR TIER</div>
                )}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  border: `2px solid ${isCurrent ? C.white : i <= currentTierIdx ? C.red : C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, marginBottom: 16,
                  background: i <= currentTierIdx && !isCurrent ? C.red : 'transparent',
                  color: i <= currentTierIdx ? (isCurrent ? C.white : C.pureWhite) : C.gray,
                }}>
                  {tier.num}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  {tier.name}
                </div>
                <div style={{
                  fontSize: 12, color: isCurrent ? '#999' : C.gray, marginBottom: 16,
                }}>
                  {tier.ceiling ? `${tier.floor.toLocaleString('de-CH')} – ${tier.ceiling.toLocaleString('de-CH')} points` : `${tier.floor.toLocaleString('de-CH')}+ points`}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {tier.benefits.map(b => (
                    <li key={b} style={{
                      fontSize: 12, lineHeight: 1.7,
                      color: isCurrent ? '#ccc' : C.gray,
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                    }}>
                      <span style={{ color: isCurrent ? C.white : C.red, fontSize: 8, marginTop: 5 }}>●</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── BOTTOM: Progress Bar ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          flexWrap: 'wrap', gap: 24, padding: '40px 0 32px',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: '1 1 400px' }}>
            <div style={{ ...LABEL, marginBottom: 10 }}>
              {nextTier ? `PROGRESS TO ${nextTier.name.toUpperCase()}` : 'MAXIMUM TIER REACHED'}
            </div>
            <div style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 300, marginBottom: 6 }}>
              {balance.toLocaleString('de-CH')}
              {nextTier && (
                <span style={{ color: C.red }}> / {nextTier.floor.toLocaleString('de-CH')} points</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>
              Claim a new ski (+500 pts) or attend an event (+150 pts) to accelerate your progress.
            </div>
          </div>

          <div style={{ flex: '1 1 300px', maxWidth: 360 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 6 }}>
              <span>Current<br /><strong style={{ color: C.black }}>{balance.toLocaleString('de-CH')} pts</strong></span>
              {nextTier && <span style={{ textAlign: 'right' }}>{nextTier.name}<br /><strong style={{ color: C.black }}>{nextTier.floor.toLocaleString('de-CH')} pts</strong></span>}
            </div>
            <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: C.red, borderRadius: 2, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          <button
            onClick={() => navigate('/products')}
            style={{
              padding: '14px 28px', background: C.red, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
              borderRadius: 4, cursor: 'pointer', fontFamily: C.font, whiteSpace: 'nowrap',
            }}
          >
            CLAIM PRODUCT · +500 PTS
          </button>
        </div>

        {/* ── Recent Points Activity ── */}
        {history.length > 0 && (
          <div style={{ padding: '32px 0' }}>
            <div style={{ ...LABEL, marginBottom: 16 }}>RECENT ACTIVITY</div>
            {history.map((h: any) => (
              <div key={h.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 0', borderBottom: `1px solid ${C.border}`,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{h.description || h.type}</div>
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
      </div>

      <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
