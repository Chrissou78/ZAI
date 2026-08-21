import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppContext  } from '../../context/AppContext';
import { apiService } from '../../services/api';

// ── Design tokens — restricted to the brand's actual color scheme: Ochsen Blut
// burgundy (RGB 122/34/46), white, black, 40% grey, 70% grey. No blue, no gold. ──
const C = {
  black: '#0a0a0a', white: '#f5f4f0', burgundy: '#7A222E',
  grey40: '#B2B2B2', grey70: '#706F6F',
  gray: '#6a6a6a', border: '#e0ddd6', borderDark: '#2a2a2a', surface: '#f0ede6',
  green: '#4caf7d', pureWhite: '#ffffff', font: "'Inter', sans-serif",
  // Lightened burgundy — the one accent legible on the black "current tier" card.
  burgundyLight: '#b84055', burgundyTint: '#e0a3ac',
};
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
  color: C.gray, fontWeight: 500,
};
// Voucher codes must be unambiguous (O vs 0, I vs 1) — a system mono stack, no webfont.
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

// ── Tier meta for the five-tier scheme. Thresholds and voucher values mirror the
// backend (White 500 / Blue 2 500 / Red 5 000 / Black 10 000 / Diamond 15 000);
// `voucherCHF` is only a fallback — the live amount comes from /store/vouchers.
// `icon` is the accent on a light card, `iconOnDark` the one on the black
// "your tier" card. Names/perks are translated at render time via the `key`. ──
const TIERS = [
  { key: 'white',   num: '01', floor: 500,   ceiling: 2499,  voucherCHF: 25,  icon: C.grey70,   iconOnDark: C.grey40, solid: false },
  { key: 'blue',    num: '02', floor: 2500,  ceiling: 4999,  voucherCHF: 50,  icon: C.grey70,   iconOnDark: C.grey40, solid: false },
  { key: 'red',     num: '03', floor: 5000,  ceiling: 9999,  voucherCHF: 100, icon: C.burgundy, iconOnDark: C.burgundyLight, solid: false },
  { key: 'black',   num: '04', floor: 10000, ceiling: 14999, voucherCHF: 200, icon: C.black,    iconOnDark: C.white,  solid: false },
  { key: 'diamond', num: '05', floor: 15000, ceiling: null,  voucherCHF: 300, icon: C.black,    iconOnDark: C.white,  solid: true },
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

interface BalanceData {
  balance: number;
  /** null below 500 points — a member holds no tier at all until White. */
  tier: string | null;
  tierKey: string | null;
  tierFloor: number | null;
  /** null for Diamond, the top tier. */
  tierCeiling: number | null;
  voucherCHF: number | null;
  nextTier: string | null;
  nextTierFloor: number | null;
  pointsToNext: number | null;
}

interface VoucherTier {
  key: string;
  name: string;
  minPoints: number;
  amountCHF: number;
  unlocked: boolean;
  claimed: boolean;
  code: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
}

function tierIndex(name: string | null | undefined) {
  return TIERS.findIndex(t => t.key === (name || '').toLowerCase());
}

export default function Rewards() {
  const { t, i18n } = useTranslation();
  const { user } = useAppContext();
  const navigate = useNavigate();
  const [data, setData] = useState<BalanceData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<VoucherTier[] | null>(null);
  const [voucherLoadError, setVoucherLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Per-tier voucher interaction state, keyed by tier key.
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [claimedKey, setClaimedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectHintKey, setSelectHintKey] = useState<string | null>(null);
  // Progress section switches from a 2-column (content + progress bar)
  // layout to a stacked one below 768px — not achievable with CSS alone
  // since the two columns have very different content types/widths.
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Code <div>s, so the clipboard fallback can select the text it cannot copy.
  const codeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach(id => window.clearTimeout(id)); }, []);

  /** Shows a transient per-tier confirmation without leaving it on screen forever. */
  const flash = (setter: (v: string | null) => void, key: string, ms = 3000) => {
    setter(key);
    const id = window.setTimeout(() => setter(null), ms);
    timers.current.push(id);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Settled, not all-or-nothing: a failing history or voucher call must not
      // blank out the tier display, and vice versa.
      const [balRes, histRes, vouRes] = await Promise.allSettled([
        apiService.get<BalanceData>('/store/rewards/balance'),
        apiService.get<any[]>('/store/rewards/history?limit=10'),
        apiService.get<{ balance: number; currentTier: string | null; tiers: VoucherTier[] }>('/store/vouchers'),
      ]);
      if (cancelled) return;

      if (balRes.status === 'fulfilled' && balRes.value.data?.success) {
        setData(balRes.value.data.data as BalanceData);
      } else {
        setError(t('rewards.loadError'));
      }
      if (histRes.status === 'fulfilled' && histRes.value.data?.success) {
        setHistory((histRes.value.data.data as any[]) || []);
      }
      if (vouRes.status === 'fulfilled' && vouRes.value.data?.success) {
        setVouchers((vouRes.value.data.data as any)?.tiers || []);
      } else {
        setVoucherLoadError(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [t]);

  // Translated tier copy (name + perks) — the numeric/color meta above stays
  // static and is merged with the localized strings for rendering.
  const localizedTiers = useMemo(() => TIERS.map(tier => ({
    ...tier,
    name: t(`rewards.tiers.${tier.key}.name`),
    perks: t(`rewards.tiers.${tier.key}.perks`, { returnObjects: true }) as string[],
  })), [t, i18n.language]);

  const balance = data?.balance || 0;

  // Below 500 points the API returns tier: null and the member holds NO tier —
  // currentTierIdx stays -1 so no card is marked and the banner says so.
  const currentTierIdx = data ? tierIndex(data.tierKey || data.tier) : -1;
  const hasTier = currentTierIdx >= 0;
  const currentTier = hasTier ? localizedTiers[currentTierIdx] : null;
  const nextTier = hasTier
    ? (currentTierIdx < localizedTiers.length - 1 ? localizedTiers[currentTierIdx + 1] : null)
    : localizedTiers[0];

  const progress = useMemo(() => {
    if (!data || !nextTier) return 100;
    const floor = currentTier ? currentTier.floor : 0;
    const range = nextTier.floor - floor;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(0, ((balance - floor) / range) * 100));
  }, [data, balance, currentTier, nextTier]);

  const dateLocale = i18n.language === 'de' ? 'de-CH' : i18n.language === 'zh' ? 'zh-CN' : 'en-GB';
  const fmtDate = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const num = (n: number) => n.toLocaleString('de-CH');

  const voucherByKey = useMemo(() => {
    const map: Record<string, VoucherTier> = {};
    (vouchers || []).forEach(v => { if (v && v.key) map[String(v.key).toLowerCase()] = v; });
    return map;
  }, [vouchers]);

  /** Claims the event voucher for a tier and patches it into state in place. */
  const claimVoucher = async (tierKey: string) => {
    setClaiming(tierKey);
    setClaimErrors(prev => ({ ...prev, [tierKey]: '' }));
    try {
      const res = await apiService.post<any>(`/store/vouchers/${tierKey}/claim`);
      const payload: any = res.data?.data;
      // `alreadyClaimed: true` comes back with the existing code — same happy path.
      if (res.data?.success && payload?.code) {
        setVouchers(prev => (prev || []).map(v => v.key === tierKey ? {
          ...v,
          claimed: true,
          code: payload.code,
          expiresAt: payload.expiresAt ?? v.expiresAt,
          amountCHF: payload.amountCHF ?? v.amountCHF,
        } : v));
        flash(setClaimedKey, tierKey, 5000);
      } else {
        setClaimErrors(prev => ({ ...prev, [tierKey]: t('rewards.vouchers.errors.generic') }));
      }
    } catch (e: any) {
      const status = e?.response?.status;
      const body = e?.response?.data;
      if (status === 403) {
        const required = typeof body?.required === 'number' ? body.required : (TIERS.find(x => x.key === tierKey)?.floor ?? 0);
        setClaimErrors(prev => ({ ...prev, [tierKey]: t('rewards.vouchers.errors.notReached', { required: num(required) }) }));
      } else if (!e?.response) {
        setClaimErrors(prev => ({ ...prev, [tierKey]: t('rewards.vouchers.errors.network') }));
      } else {
        setClaimErrors(prev => ({ ...prev, [tierKey]: t('rewards.vouchers.errors.generic') }));
      }
    } finally {
      setClaiming(null);
    }
  };

  /** Fallback for non-secure origins: select the code so the member can copy it. */
  const selectCode = (tierKey: string) => {
    const el = codeRefs.current[tierKey];
    if (!el) return false;
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  };

  const copyCode = async (tierKey: string, code: string) => {
    let ok = false;
    // navigator.clipboard is undefined on non-secure origins — never assume it.
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(code);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      const selected = selectCode(tierKey);
      try {
        const legacy = (document as any).execCommand;
        if (selected && typeof legacy === 'function') ok = legacy.call(document, 'copy') === true;
      } catch {
        ok = false;
      }
      if (!ok) { flash(setSelectHintKey, tierKey, 6000); return; }
    }
    flash(setCopiedKey, tierKey);
  };

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.burgundy, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>{t('rewards.loading')}</span>
      </div>
    );
  }

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

      {error && (
        <div style={{
          border: `1px solid ${C.burgundy}`, background: 'rgba(122,34,46,0.06)',
          color: C.burgundy, fontSize: 12, padding: '12px 16px', marginBottom: 24,
        }}>{error}</div>
      )}

      {/* ── Current tier banner — a member below 500 points holds no tier ── */}
      <div style={{
        background: C.black, border: `1px solid ${C.borderDark}`, color: C.pureWhite,
        padding: isMobile ? '1.5rem' : '2rem',
        marginBottom: 1,
      }}>
        <div style={{ ...LABEL, color: '#666', marginBottom: 8 }}>{t('rewards.banner.label')}</div>
        {hasTier && currentTier ? (
          <div style={{ fontSize: 'clamp(24px, 8vw, 36px)', fontWeight: 200 }}>
            {currentTier.name} <em style={{ fontStyle: 'normal', color: C.white }}>{t('rewards.banner.tierWord')}</em>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 'clamp(24px, 8vw, 36px)', fontWeight: 200, color: C.grey40 }}>
              {t('rewards.banner.noTier')}
            </div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 6, fontWeight: 300 }}>
              {t('rewards.banner.noTierHint', {
                points: num(Math.max(0, localizedTiers[0].floor - balance)),
                tier: localizedTiers[0].name,
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Tier cards — all five tiers, each with its event voucher ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 1, background: '#ddd', border: '1px solid #ddd', marginBottom: 1,
      }}>
        {localizedTiers.map((tier, i) => {
          const isCurrent = i === currentTierIdx;
          // Each tier carries a light-card and a dark-card accent, since the
          // "your tier" card inverts to black and would swallow the light ones.
          const iconColor = isCurrent ? tier.iconOnDark : tier.icon;
          const muted = isCurrent ? '#999' : C.gray;
          const hairline = isCurrent ? C.borderDark : C.border;
          const errColor = isCurrent ? C.burgundyTint : C.burgundy;

          const v = voucherByKey[tier.key];
          const amount = typeof v?.amountCHF === 'number' ? v.amountCHF : tier.voucherCHF;
          // Derived from the live balance rather than the (cacheable) voucher
          // payload, so an unlock never lags behind the points total shown above.
          const unlocked = balance >= tier.floor;
          const claimed = !!(v && v.claimed && v.code);
          const redeemed = !!(v && v.redeemedAt);
          const needed = Math.max(0, tier.floor - balance);
          const claimError = claimErrors[tier.key];

          return (
            <div key={tier.key} style={{
              padding: isMobile ? '1.5rem 1.25rem' : '2rem 1.5rem', position: 'relative',
              background: isCurrent ? C.black : C.white,
              color: isCurrent ? C.pureWhite : C.black,
              display: 'flex', flexDirection: 'column',
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
                background: tier.solid ? iconColor : `${iconColor}1a`,
                border: `1px solid ${iconColor}`,
                color: tier.solid ? (isCurrent ? C.black : C.white) : iconColor,
              }}>
                {tier.num}
              </div>
              <div style={{
                fontSize: 14, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3,
              }}>
                {tier.name}
              </div>
              <div style={{ fontSize: 11, color: muted, marginBottom: '1.5rem' }}>
                {tier.ceiling
                  ? t('rewards.tierRange.withCeiling', { floor: num(tier.floor), ceiling: num(tier.ceiling) })
                  : t('rewards.tierRange.noCeiling', { floor: num(tier.floor) })}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(tier.perks || []).map(b => (
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

              {/* ── Event voucher: locked → claimable → claimed (→ redeemed) ──
                  The 20px spacer guarantees a gap above the rule while
                  `marginTop: auto` soaks up the slack, so the voucher blocks of
                  all five cards align even with different perk-list lengths. */}
              <div style={{ height: 20, flexShrink: 0 }} />
              <div style={{
                marginTop: 'auto', paddingTop: '1.25rem',
                borderTop: `1px solid ${hairline}`,
              }}>
                <div style={{ ...LABEL, color: muted, fontSize: 9, marginBottom: 6 }}>
                  {t('rewards.vouchers.blockLabel')}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 200, lineHeight: 1.1, marginBottom: 8,
                  color: unlocked ? (isCurrent ? C.pureWhite : C.black) : C.grey40,
                  opacity: redeemed ? 0.55 : 1,
                }}>
                  {t('rewards.vouchers.amount', { amount: num(amount) })}
                </div>

                {!unlocked && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={C.grey40} strokeWidth="1.5" aria-hidden="true">
                        <rect x="3" y="7" width="10" height="7" rx="1" />
                        <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
                      </svg>
                      <span style={{ ...LABEL, color: C.grey40, fontSize: 9 }}>{t('rewards.vouchers.locked')}</span>
                    </div>
                    <div style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>
                      {t('rewards.vouchers.lockedHint', { points: num(needed) })}
                    </div>
                  </div>
                )}

                {unlocked && !claimed && v && (
                  <>
                    <button
                      onClick={() => claimVoucher(tier.key)}
                      disabled={claiming === tier.key}
                      style={{
                        width: '100%', padding: '10px 12px',
                        background: 'transparent', color: isCurrent ? C.pureWhite : C.burgundy,
                        border: `1px solid ${isCurrent ? C.burgundyLight : C.burgundy}`,
                        fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                        cursor: claiming === tier.key ? 'wait' : 'pointer',
                        fontFamily: C.font, opacity: claiming === tier.key ? 0.6 : 1,
                        transition: 'background 0.2s, color 0.2s',
                      }}
                      onMouseEnter={e => { if (claiming !== tier.key) { e.currentTarget.style.background = C.burgundy; e.currentTarget.style.color = '#fff'; } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isCurrent ? C.pureWhite : C.burgundy; }}
                    >
                      {claiming === tier.key ? t('rewards.vouchers.claiming') : t('rewards.vouchers.claim')}
                    </button>
                    <div style={{ fontSize: 10, color: muted, marginTop: 6, lineHeight: 1.5 }}>
                      {t('rewards.vouchers.validityNote')}
                    </div>
                  </>
                )}

                {claimed && v && (
                  <div>
                    {claimedKey === tier.key && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={C.green} strokeWidth="2" aria-hidden="true">
                          <path d="M3 8.5l3.5 3.5L13 5" />
                        </svg>
                        <span style={{ fontSize: 10, color: C.green, fontWeight: 500 }}>{t('rewards.vouchers.claimedConfirmation')}</span>
                      </div>
                    )}
                    <div style={{ ...LABEL, color: muted, fontSize: 9, marginBottom: 4 }}>
                      {t('rewards.vouchers.codeLabel')}
                    </div>
                    <div
                      ref={el => { codeRefs.current[tier.key] = el; }}
                      style={{
                        fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em',
                        padding: '8px 10px', wordBreak: 'break-all', userSelect: 'all',
                        background: isCurrent ? '#161616' : C.surface,
                        border: `1px solid ${hairline}`,
                        color: isCurrent ? C.white : C.black,
                        opacity: redeemed ? 0.55 : 1,
                        textDecoration: redeemed ? 'line-through' : 'none',
                      }}
                    >
                      {v.code}
                    </div>
                    {redeemed ? (
                      <div style={{ fontSize: 10, color: muted, marginTop: 6, lineHeight: 1.5 }}>
                        {t('rewards.vouchers.redeemed', { date: fmtDate(v.redeemedAt) })}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => copyCode(tier.key, v.code || '')}
                          style={{
                            marginTop: 6, width: '100%', padding: '7px 10px',
                            background: 'transparent',
                            color: copiedKey === tier.key ? C.green : (isCurrent ? C.grey40 : C.gray),
                            border: `1px solid ${copiedKey === tier.key ? C.green : hairline}`,
                            fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase',
                            cursor: 'pointer', fontFamily: C.font, transition: 'color 0.2s, border-color 0.2s',
                          }}
                        >
                          {copiedKey === tier.key ? t('rewards.vouchers.copied') : t('rewards.vouchers.copy')}
                        </button>
                        {selectHintKey === tier.key && (
                          <div style={{ fontSize: 10, color: muted, marginTop: 5, lineHeight: 1.5 }}>
                            {t('rewards.vouchers.selectHint')}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: muted, marginTop: 6, lineHeight: 1.5 }}>
                          {t('rewards.vouchers.validUntil', { date: fmtDate(v.expiresAt) })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {claimError && (
                  <div role="alert" style={{
                    fontSize: 10, lineHeight: 1.5, marginTop: 8, padding: '7px 9px',
                    color: errColor, border: `1px solid ${errColor}`,
                    background: isCurrent ? 'transparent' : 'rgba(122,34,46,0.06)',
                  }}>{claimError}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Voucher terms — continues the stacked block between cards and progress ── */}
      <div style={{
        background: C.white, border: '1px solid #ddd', borderTop: 0,
        padding: isMobile ? '1.25rem 1.25rem' : '1.25rem 1.5rem', marginBottom: 1,
      }}>
        <div style={{ ...LABEL, marginBottom: 6 }}>{t('rewards.vouchers.sectionTitle')}</div>
        <p style={{ fontSize: 11, color: C.gray, lineHeight: 1.7, margin: 0, maxWidth: 760 }}>
          {t('rewards.vouchers.intro')}
        </p>
        {voucherLoadError && (
          <div role="alert" style={{ fontSize: 11, color: C.burgundy, marginTop: 8 }}>
            {t('rewards.vouchers.loadError')}
          </div>
        )}
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
            {num(balance)}
            {nextTier && (
              <span style={{ color: C.gray, fontWeight: 300 }}> / <em style={{ fontStyle: 'normal', color: C.burgundy }}>{t('rewards.units.pointsValue', { value: num(nextTier.floor) })}</em></span>
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
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${C.burgundy},${C.burgundyLight})`, borderRadius: 2, transition: 'width 0.6s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 6 }}>
            <span style={{ color: C.burgundy }}>{t('rewards.units.pointsValue', { value: num(balance) })}</span>
            {nextTier && <span style={{ color: C.gray }}>{t('rewards.units.pointsValue', { value: num(nextTier.floor) })}</span>}
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
        }}>{hasTier && currentTier
          ? t('rewards.highlights.sectionTitle', { tier: currentTier.name })
          : t('rewards.highlights.sectionTitleNoTier')}</div>
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
                {t('rewards.units.pointsValue', { value: `${h.amount > 0 ? '+' : ''}${num(h.amount)}` })}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
