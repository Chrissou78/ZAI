import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext  } from '../../context/AppContext';

// ── Design tokens — restricted to the brand's actual color scheme: Ochsen Blut
// burgundy (RGB 122/34/46), white, black, 40% grey, 70% grey. No blue, no gold. ──
const C = {
  black: '#0a0a0a', white: '#f5f4f0', burgundy: '#7A222E',
  grey40: '#B2B2B2', grey70: '#706F6F',
  gray: '#6a6a6a', border: '#e0ddd6', borderDark: '#2a2a2a', surface: '#f0ede6',
  green: '#4caf7d', pureWhite: '#ffffff', font: "'Inter', sans-serif",
};
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};

// ── Tier meta — icon colors follow the allowed palette: Red is the app's one
// burgundy, Blue and Diamond use the two greys (no blue or gold is permitted).
// Names/perks are translated at render time via the `key` below. ──
const TIERS = [
  { key: 'blue',    num: '01', floor: 0,     ceiling: 14999,  icon: C.grey40 },
  { key: 'red',     num: '02', floor: 15000, ceiling: 29999,  icon: C.burgundy },
  { key: 'black',   num: '03', floor: 30000, ceiling: 49999,  icon: '#f5f4f0' },
  { key: 'diamond', num: '04', floor: 50000, ceiling: null,   icon: C.grey70 },
];

// Highlighted perks shown for whichever tier the member currently holds.
// Titles/descriptions are translated at render time via the `key` below.
const TIER_HIGHLIGHTS = [
  {
    key: 'insurance',
    icon: <path d="M8 1l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />,
  },
  {
    key: 'vipEvents',
    icon: <><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M5 1v3M11 1v3M2 7h12" /></>,
  },
  {
    key: 'partnerElite',
    icon: <path d="M13 6c0 4-5 8-5 8S3 10 3 6a5 5 0 0110 0z" />,
  },
];

function tierIndex(name: string) {
  return TIERS.findIndex(t => t.key === (name || '').toLowerCase());
}

export default function Rewards() {
  const { t, i18n } = useTranslation();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Progress section switches from a 2-column (content + progress bar)
  // layout to a stacked one below 768px — not achievable with CSS alone
  // since the two columns have very different content types/widths.
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

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

  // Translated tier copy (name + perks) — the numeric/color meta above stays
  // static and is merged with the localized strings for rendering.
  const localizedTiers = useMemo(() => TIERS.map(tier => ({
    ...tier,
    name: t(`rewards.tiers.${tier.key}.name`),
    perks: t(`rewards.tiers.${tier.key}.perks`, { returnObjects: true }) as string[],
  })), [t, i18n.language]);

  const currentTierIdx = data ? tierIndex(data.tier) : 0;
  const currentTier = localizedTiers[currentTierIdx] || localizedTiers[0];
  const nextTier = currentTierIdx < localizedTiers.length - 1 ? localizedTiers[currentTierIdx + 1] : null;

  const progress = useMemo(() => {
    if (!data || !nextTier) return 100;
    const range = nextTier.floor - currentTier.floor;
    return Math.min(100, Math.max(0, ((data.balance - currentTier.floor) / range) * 100));
  }, [data, currentTier, nextTier]);

  const dateLocale = i18n.language === 'de' ? 'de-CH' : i18n.language === 'zh' ? 'zh-CN' : 'en-GB';

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.burgundy, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>{t('rewards.loading')}</span>
      </div>
    );
  }

  const balance = data?.balance || 0;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '32px 16px 56px' : '48px 40px 80px', fontFamily: C.font, color: C.gray, width: '100%', boxSizing: 'border-box' }}>

      {/* ══════ PAGE HEADER — matches every other page's header treatment ══════ */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ ...LABEL, color: C.burgundy, letterSpacing: '0.3em', marginBottom: 8, fontSize: 10 }}>
          {t('rewards.header.label')}
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 8px', color: C.black }}>
          {t('rewards.header.title')}
        </h1>
        <p style={{ color: C.gray, fontSize: 14, margin: 0, fontWeight: 300 }}>
          {t('rewards.header.description')}
        </p>
      </div>

      {/* ── Current tier banner ── */}
      <div style={{
        background: C.black, border: `1px solid ${C.borderDark}`, color: C.pureWhite,
        padding: isMobile ? '1.5rem' : '2rem',
        marginBottom: 1,
      }}>
        <div style={{ ...LABEL, color: '#666', marginBottom: 8 }}>{t('rewards.banner.label')}</div>
        <div style={{ fontSize: 'clamp(24px, 8vw, 36px)', fontWeight: 200 }}>
          {currentTier.name} <em style={{ fontStyle: 'normal', color: C.white }}>{t('rewards.banner.tierWord')}</em>
        </div>
      </div>

      {/* ── Tier cards ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 1, background: '#ddd', border: '1px solid #ddd', marginBottom: 1,
      }}>
        {localizedTiers.map((tier, i) => {
          const isCurrent = i === currentTierIdx;
          // The Black tier's icon color (near-white) is designed for its own
          // dark "current" card; on a plain white card it would be invisible.
          const iconColor = tier.key === 'black' && !isCurrent ? C.black : tier.icon;
          return (
            <div key={tier.key} style={{
              padding: isMobile ? '1.5rem 1.25rem' : '2rem 1.5rem', position: 'relative',
              background: isCurrent ? C.black : C.white,
              color: isCurrent ? C.pureWhite : C.black,
            }}>
              {isCurrent && (
                <div style={{
                  position: 'absolute', top: '1rem', right: '1rem', fontSize: 10,
                  letterSpacing: '0.2em', textTransform: 'uppercase', padding: '3px 8px',
                  background: C.burgundy, color: '#fff',
                }}>{t('rewards.yourTierBadge')}</div>
              )}
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 500, marginBottom: 20,
                background: `${iconColor}1a`, border: `1px solid ${iconColor}`,
                color: iconColor,
              }}>
                {tier.num}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
              }}>
                {tier.name}
              </div>
              <div style={{ fontSize: 11, color: isCurrent ? '#999' : C.gray, marginBottom: '1.5rem' }}>
                {tier.ceiling
                  ? t('rewards.tierRange.withCeiling', { floor: tier.floor.toLocaleString('de-CH'), ceiling: tier.ceiling.toLocaleString('de-CH') })
                  : t('rewards.tierRange.noCeiling', { floor: tier.floor.toLocaleString('de-CH') })}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tier.perks.map(b => (
                  <li key={b} style={{
                    fontSize: 11, lineHeight: 1.4,
                    color: isCurrent ? '#aaa' : '#555',
                    display: 'flex', alignItems: 'flex-start', gap: 7,
                  }}>
                    <span style={{
                      width: 4, height: 4, marginTop: 5, borderRadius: '50%',
                      background: iconColor, flexShrink: 0,
                    }} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ── Progress section — bar and CTA stay visible at max tier (100%
          filled) rather than disappearing, so the layout doesn't collapse
          and members can still claim products for points. ── */}
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderTop: 0,
        padding: isMobile ? '1.5rem' : '2rem',
        display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
        gap: isMobile ? '1.5rem' : '3rem', alignItems: 'center',
        marginBottom: '2.5rem',
      }}>
        <div>
          <div style={{ ...LABEL, marginBottom: 6 }}>
            {nextTier ? t('rewards.progress.toNextTier', { tier: nextTier.name.toUpperCase() }) : t('rewards.progress.maxTierReached')}
          </div>
          <div style={{ fontSize: 22, fontWeight: 200, color: C.black, lineHeight: 1.2 }}>
            {balance.toLocaleString('de-CH')}
            {nextTier && (
              <span style={{ color: C.gray, fontWeight: 300 }}> / <em style={{ fontStyle: 'normal', color: C.burgundy }}>{t('rewards.units.pointsValue', { value: nextTier.floor.toLocaleString('de-CH') })}</em></span>
            )}
          </div>
          <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
            {nextTier
              ? t('rewards.progress.helperNext')
              : t('rewards.progress.helperMax')}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.gray, marginBottom: 6 }}>
            <span>{t('rewards.progress.current')}</span><span>{nextTier ? nextTier.name : t('rewards.progress.max')}</span>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${C.burgundy},#b84055)`, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 6 }}>
            <span style={{ color: C.burgundy }}>{t('rewards.units.pointsValue', { value: balance.toLocaleString('de-CH') })}</span>
            {nextTier && <span style={{ color: C.gray }}>{t('rewards.units.pointsValue', { value: nextTier.floor.toLocaleString('de-CH') })}</span>}
          </div>
          <button
            onClick={() => navigate('/products')}
            style={{
              marginTop: '1rem', width: '100%', padding: '14px 28px',
              background: C.burgundy, color: '#fff', border: 'none',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: C.font, transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
            onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}
          >
            {t('rewards.progress.claimButton')}
          </button>
        </div>
      </div>

      {/* ── Your {tier} benefits ── */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{
          ...LABEL, marginBottom: '1rem', paddingBottom: '0.75rem',
          borderBottom: `1px solid ${C.border}`,
        }}>{t('rewards.highlights.sectionTitle', { tier: currentTier.name })}</div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 1, background: C.border, border: `1px solid ${C.border}`,
        }}>
          {TIER_HIGHLIGHTS.map(h => (
            <div key={h.key} style={{ background: C.white, padding: '1.5rem' }}>
              <div style={{
                width: 32, height: 32, border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem',
              }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill={C.burgundy}>{h.icon}</svg>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.black, marginBottom: 4 }}>{t(`rewards.highlights.${h.key}.title`)}</div>
              <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.6 }}>{t(`rewards.highlights.${h.key}.description`)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Points Activity ── */}
      {history.length > 0 && (
        <div>
          <div style={{ ...LABEL, marginBottom: 16 }}>{t('rewards.activity.sectionTitle')}</div>
          {history.map((h: any) => (
            <div key={h.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 8,
              padding: '12px 0', borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-word' }}>{h.description || h.type}</div>
                <div style={{ fontSize: 11, color: C.gray }}>
                  {new Date(h.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
              <div style={{
                fontSize: 14, fontWeight: 600, flexShrink: 0,
                color: h.amount > 0 ? C.green : C.burgundy,
              }}>
                {t('rewards.units.pointsValue', { value: `${h.amount > 0 ? '+' : ''}${h.amount.toLocaleString('de-CH')}` })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
