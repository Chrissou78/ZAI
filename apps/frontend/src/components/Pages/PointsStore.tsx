import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../services/api';

/* ── House tokens (mirrors Updates.tsx / Rewards.tsx) ── */
const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6',
  pureWhite: '#ffffff', green: '#4caf7d', font: "'Inter', sans-serif",
};

const RED_LABEL: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, fontWeight: 500,
};
const META_LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, fontWeight: 500,
};

/* ── Types ── */
interface PointsDeal {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  price_chf?: string | number | null;
  image_url?: string | null;
  ends_at?: string | null;
  spots_total?: number | null;
  spots_left?: number | null;
  members_only?: boolean;
  featured?: boolean;
  active?: boolean;
  points_only?: boolean;
  points_price?: string | number | null;
}

interface RedeemedInfo {
  redemptionId: string;
  pointsSpent: number;
}

type CardError = { key: string; shortfall?: number };

/** Reason a card cannot be actioned right now — drives the muted/disabled UI. */
type Availability =
  | { kind: 'affordable' }
  | { kind: 'short'; shortfall: number }
  | { kind: 'soldOut' }
  | { kind: 'expired' };

/* ── Helpers ── */
// price_chf / points_price arrive as numeric strings from the API (same as the
// money deals on Updates), so never trust them to already be numbers.
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
};

const isExpired = (d: PointsDeal): boolean =>
  !!d.ends_at && new Date(d.ends_at).getTime() <= Date.now();

// spots_total === 0 means "unlimited", so an empty spots_left only counts as
// sold out when the deal actually declares a capacity.
const isSoldOut = (d: PointsDeal): boolean =>
  num(d.spots_total) > 0 && num(d.spots_left) <= 0;

function availabilityOf(deal: PointsDeal, balance: number): Availability {
  if (isExpired(deal)) return { kind: 'expired' };
  if (isSoldOut(deal)) return { kind: 'soldOut' };
  const cost = num(deal.points_price);
  if (balance < cost) return { kind: 'short', shortfall: cost - balance };
  return { kind: 'affordable' };
}

/**
 * The redeem endpoint's documented failures are plain English strings, not
 * codes — map them onto our own translation keys so the member reads their own
 * language, and fall back to a generic message for anything undocumented
 * rather than leaking a raw server string into the UI.
 */
function mapServerError(payload: any): CardError {
  const raw = String(payload?.error ?? '');
  if (raw === 'Not enough points') {
    const shortfall = Number.isFinite(Number(payload?.shortfall))
      ? Math.max(0, Number(payload.shortfall))
      : undefined;
    return { key: 'notEnoughPoints', shortfall };
  }
  if (raw === 'Sold out') return { key: 'soldOut' };
  if (raw === 'Deal has expired') return { key: 'expired' };
  if (raw === 'This item is not a points-only redemption') return { key: 'notPointsOnly' };
  return { key: 'generic' };
}

/* ── Reward card ── */
function RewardCard({
  deal, balance, phase, error, onStartConfirm, onCancelConfirm, onConfirm, redeemed,
}: {
  deal: PointsDeal;
  balance: number;
  phase: 'idle' | 'confirming' | 'submitting';
  error?: CardError;
  redeemed?: RedeemedInfo;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const cost = num(deal.points_price);
  const avail = availabilityOf(deal, balance);
  const locked = !redeemed && avail.kind !== 'affordable';
  const submitting = phase === 'submitting';

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const statusLine = (() => {
    if (redeemed) return { text: t('pointsStore.card.redeemedNote'), color: C.green };
    if (avail.kind === 'short') {
      return { text: t('pointsStore.card.shortfall', { count: Math.ceil(avail.shortfall) }), color: C.red };
    }
    if (avail.kind === 'soldOut') return { text: t('pointsStore.card.soldOut'), color: C.gray };
    if (avail.kind === 'expired') return { text: t('pointsStore.card.expired'), color: C.gray };
    return null;
  })();

  return (
    <div style={{
      border: `1px solid ${redeemed ? 'rgba(76,175,125,0.5)' : C.border}`,
      background: locked ? C.surface : C.pureWhite,
      display: 'flex', flexDirection: 'column',
      opacity: locked ? 0.62 : 1,
      boxSizing: 'border-box', minWidth: 0, position: 'relative',
      transition: 'opacity 0.2s, border-color 0.2s',
    }}>
      {/* Visual */}
      <div style={{
        position: 'relative', height: 150, flexShrink: 0,
        background: C.black, overflow: 'hidden',
      }}>
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt={deal.title}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: locked ? 'grayscale(1) brightness(0.75)' : 'none',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2e2e2e 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#555', fontSize: 32 }}>⬡</span>
          </div>
        )}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontSize: 7.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
          padding: '4px 8px', color: '#fff',
          background: redeemed ? 'rgba(76,175,125,0.92)' : 'rgba(122,34,46,0.92)',
        }}>
          {redeemed ? t('pointsStore.card.redeemedBadge') : t('pointsStore.card.pointsOnlyBadge')}
        </div>
      </div>

      {/* Body */}
      <div style={{
        padding: 'clamp(16px, 3vw, 22px)', display: 'flex', flexDirection: 'column',
        flex: 1, minWidth: 0, boxSizing: 'border-box',
      }}>
        {deal.category && (
          <div style={{
            fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
            color: locked ? C.gray : C.red, marginBottom: 9,
          }}>{deal.category}</div>
        )}

        <div style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 6 }}>
          {deal.title}
        </div>

        {deal.description && (
          <div style={{
            fontSize: 11.5, color: C.gray, lineHeight: 1.6, marginBottom: 14, flex: 1,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{deal.description}</div>
        )}
        {!deal.description && <div style={{ flex: 1, minHeight: 8 }} />}

        {/* Cost */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 10, flexWrap: 'wrap', paddingTop: 14, borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...META_LABEL, marginBottom: 2 }}>{t('pointsStore.card.costLabel')}</div>
            <div style={{ fontSize: 24, fontWeight: 200, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
              {t('pointsStore.units.points', { count: cost })}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 10, color: C.gray, lineHeight: 1.7, flexShrink: 0 }}>
            {num(deal.spots_total) > 0 && !isSoldOut(deal) && (
              <div>{t('pointsStore.card.spotsLeft', { count: num(deal.spots_left) })}</div>
            )}
            {deal.ends_at && !isExpired(deal) && <div>{t('pointsStore.card.until', { date: fmtDate(deal.ends_at) })}</div>}
          </div>
        </div>

        {statusLine && (
          <div style={{ fontSize: 11, fontWeight: 500, color: statusLine.color, marginTop: 10 }}>
            {statusLine.text}
          </div>
        )}

        {/* Inline error — never an alert() */}
        {error && (
          <div role="alert" style={{
            marginTop: 12, padding: '10px 12px', fontSize: 11.5, lineHeight: 1.55,
            color: '#8a1f1f', background: 'rgba(229,57,53,0.08)',
            border: '1px solid rgba(229,57,53,0.2)',
          }}>
            {error.key === 'notEnoughPoints'
              ? t('pointsStore.errors.notEnoughPoints', { count: Math.max(0, Math.ceil(error.shortfall ?? Math.max(0, cost - balance))) })
              : t(`pointsStore.errors.${error.key}`)}
          </div>
        )}

        {/* Action area */}
        {redeemed ? (
          <div style={{
            marginTop: 14, padding: '12px 14px', background: 'rgba(76,175,125,0.09)',
            border: '1px solid rgba(76,175,125,0.35)', fontSize: 11.5, lineHeight: 1.6, color: C.black,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{t('pointsStore.success.cardTitle')}</div>
            <div style={{ color: C.gray }}>
              {t('pointsStore.success.cardBody', {
                points: t('pointsStore.units.points', { count: redeemed.pointsSpent }),
              })}
            </div>
          </div>
        ) : phase === 'confirming' ? (
          /* Inline confirm — deliberately part of the card rather than a
             full-screen modal: a redemption is irreversible, and the past
             mobile bug was a modal with no reachable dismiss target. Nothing
             here can cover the page, and Cancel is always visible. */
          <div style={{
            marginTop: 14, padding: '13px 14px', background: C.pureWhite,
            border: `1px solid ${C.red}`, boxSizing: 'border-box',
          }}>
            <div style={{ ...RED_LABEL, fontSize: 9, marginBottom: 7 }}>
              {t('pointsStore.confirm.label')}
            </div>
            <div style={{ fontSize: 11.5, lineHeight: 1.6, color: C.black, marginBottom: 4 }}>
              {t('pointsStore.confirm.body', {
                points: t('pointsStore.units.points', { count: cost }),
              })}
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 12 }}>
              {t('pointsStore.confirm.balanceAfter', {
                points: t('pointsStore.units.points', { count: Math.max(0, balance - cost) }),
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={onCancelConfirm}
                disabled={submitting}
                style={{
                  flex: '1 1 110px', padding: '11px 12px', background: C.pureWhite, color: C.black,
                  border: `1px solid ${C.border}`, fontSize: 10, fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: C.font,
                  cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.5 : 1,
                }}
              >{t('pointsStore.confirm.cancel')}</button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                style={{
                  flex: '1 1 130px', padding: '11px 12px',
                  background: submitting ? '#999' : C.red, color: '#fff', border: 'none',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  fontFamily: C.font, cursor: submitting ? 'default' : 'pointer',
                }}
              >{submitting ? t('pointsStore.confirm.submitting') : t('pointsStore.confirm.confirm')}</button>
            </div>
          </div>
        ) : locked ? (
          <button
            type="button"
            disabled
            aria-disabled="true"
            style={{
              marginTop: 14, width: '100%', padding: '12px', background: 'transparent',
              color: C.gray, border: `1px solid ${C.border}`, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: C.font,
              cursor: 'not-allowed',
            }}
          >
            {avail.kind === 'soldOut'
              ? t('pointsStore.card.soldOut')
              : avail.kind === 'expired'
                ? t('pointsStore.card.expired')
                : t('pointsStore.card.locked')}
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartConfirm}
            style={{
              marginTop: 14, width: '100%', padding: '13px', background: C.red, color: '#fff',
              border: 'none', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.15em',
              textTransform: 'uppercase', fontFamily: C.font, cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
            onMouseLeave={e => (e.currentTarget.style.background = C.red)}
          >{t('pointsStore.card.redeem')}</button>
        )}
      </div>
    </div>
  );
}

/* ── Page ── */
export default function PointsStore() {
  const { t } = useTranslation();
  const [deals, setDeals] = useState<PointsDeal[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, CardError>>({});
  const [redeemed, setRedeemed] = useState<Record<string, RedeemedInfo>>({});
  const [banner, setBanner] = useState<{ title: string; pointsSpent: number } | null>(null);

  // GET /api/store/deals is the shared storefront feed — every money deal
  // lives there too, and belongs to a different page. `points_only` is the
  // only thing that makes an item ours. Archived (`active === false`) items
  // are dropped because admins get them back from this endpoint; expired ones
  // are deliberately kept so the member sees *why* they can't redeem.
  const fetchDeals = useCallback(async () => {
    const res = await apiService.get<PointsDeal[]>('/store/deals');
    if (!res.data?.success) throw new Error('deals');
    const all = (res.data.data || []) as PointsDeal[];
    setDeals(all.filter(d => d.points_only === true && d.active !== false));
  }, []);

  const fetchBalance = useCallback(async () => {
    const res = await apiService.get<{ balance: number }>('/store/rewards/balance');
    if (res.data?.success) setBalance(num(res.data.data?.balance));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The balance is the whole point of this page, but a failure there
        // shouldn't blank the catalogue — only a failed deals fetch does.
        const [dealsResult] = await Promise.allSettled([fetchDeals(), fetchBalance()]);
        if (cancelled) return;
        setLoadError(dealsResult.status === 'rejected');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchDeals, fetchBalance]);

  const retry = () => {
    setLoading(true);
    setLoadError(false);
    Promise.allSettled([fetchDeals(), fetchBalance()])
      .then(([dealsResult]) => setLoadError(dealsResult.status === 'rejected'))
      .finally(() => setLoading(false));
  };

  const sorted = useMemo(
    () => [...deals].sort((a, b) => num(a.points_price) - num(b.points_price)),
    [deals],
  );

  const clearError = (id: string) =>
    setCardErrors(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleRedeem = async (deal: PointsDeal) => {
    if (submittingId) return;
    setSubmittingId(deal.id);
    clearError(deal.id);
    try {
      const res = await apiService.post<{ redemptionId: string; pointsSpent: number; balance: number }>(
        `/store/deals/${deal.id}/redeem-points`,
      );
      const data = res.data?.data;
      if (!res.data?.success || !data) {
        setCardErrors(prev => ({ ...prev, [deal.id]: mapServerError(res.data) }));
        return;
      }

      // There is no payment step: a 2xx here means the redemption is done.
      setBalance(num(data.balance));
      setRedeemed(prev => ({
        ...prev,
        [deal.id]: { redemptionId: data.redemptionId, pointsSpent: num(data.pointsSpent) },
      }));
      setBanner({ title: deal.title, pointsSpent: num(data.pointsSpent) });
      setConfirmingId(null);
      // Re-read the catalogue so spots_left reflects the seat we just took.
      // The POST already purged the cached /store responses, so this is fresh.
      fetchDeals().catch(() => { /* card already shows the confirmed state */ });
    } catch (err: any) {
      const payload = err?.response?.data;
      if (payload) {
        const mapped = mapServerError(payload);
        setCardErrors(prev => ({ ...prev, [deal.id]: mapped }));
        // 'Not enough points' carries the authoritative balance — adopt it so
        // the header and every other card stop disagreeing with the server.
        if (Number.isFinite(Number(payload.balance))) setBalance(num(payload.balance));
      } else {
        setCardErrors(prev => ({ ...prev, [deal.id]: { key: 'network' } }));
      }
    } finally {
      setSubmittingId(null);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{
          width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.red,
          borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <span style={{ fontSize: 13, color: C.gray }}>{t('pointsStore.loading')}</span>
        <style>{'@keyframes zai-spin { 100% { transform: rotate(360deg); } }'}</style>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: C.font, color: C.black,
      paddingTop: 'clamp(24px, 5vw, 48px)', paddingBottom: 'clamp(32px, 6vw, 64px)',
      paddingLeft: 'clamp(16px, 4vw, 48px)', paddingRight: 'clamp(16px, 4vw, 48px)',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          flexWrap: 'wrap', gap: 16, paddingBottom: 20, marginBottom: 28,
          borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <div style={RED_LABEL}>{t('pointsStore.header.label')}</div>
            <h1 style={{
              fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, margin: '8px 0 8px', lineHeight: 1.15,
            }}>{t('pointsStore.header.title')}</h1>
            <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.65, margin: 0, maxWidth: 620 }}>
              {t('pointsStore.header.description')}
            </p>
          </div>
          <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 140 }}>
            <div style={META_LABEL}>{t('pointsStore.header.balanceLabel')}</div>
            <div style={{
              fontSize: 'clamp(22px, 2.4vw, 28px)', fontWeight: 300, letterSpacing: '-0.02em', marginTop: 4,
            }}>{t('pointsStore.units.points', { count: balance })}</div>
          </div>
        </div>

        {/* Success banner */}
        {banner && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14,
            padding: 'clamp(14px, 3vw, 20px)', marginBottom: 28, boxSizing: 'border-box',
            background: 'rgba(76,175,125,0.09)', border: '1px solid rgba(76,175,125,0.4)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {t('pointsStore.success.title', { title: banner.title })}
              </div>
              <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.65 }}>
                {t('pointsStore.success.body', {
                  points: t('pointsStore.units.points', { count: banner.pointsSpent }),
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              aria-label={t('pointsStore.success.dismiss')}
              style={{
                background: 'none', border: 'none', color: C.gray, fontSize: 18,
                lineHeight: 1, cursor: 'pointer', padding: '0 2px', flexShrink: 0, fontFamily: C.font,
              }}
            >✕</button>
          </div>
        )}

        {/* Load failure */}
        {loadError && (
          <div role="alert" style={{
            padding: 'clamp(14px, 3vw, 20px)', marginBottom: 28, boxSizing: 'border-box',
            background: 'rgba(229,57,53,0.08)', border: '1px solid rgba(229,57,53,0.2)',
          }}>
            <div style={{ fontSize: 12.5, color: '#8a1f1f', lineHeight: 1.6, marginBottom: 12 }}>
              {t('pointsStore.errors.loadFailed')}
            </div>
            <button
              type="button"
              onClick={retry}
              style={{
                padding: '10px 20px', background: C.red, color: '#fff', border: 'none',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: C.font,
              }}
            >{t('pointsStore.errors.retry')}</button>
          </div>
        )}

        {/* Grid */}
        {sorted.length > 0 ? (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(258px, 1fr))',
            gap: 'clamp(14px, 2.5vw, 24px)', alignItems: 'stretch',
          }}>
            {sorted.map(deal => (
              <RewardCard
                key={deal.id}
                deal={deal}
                balance={balance}
                phase={
                  submittingId === deal.id ? 'submitting'
                    : confirmingId === deal.id ? 'confirming'
                      : 'idle'
                }
                error={cardErrors[deal.id]}
                redeemed={redeemed[deal.id]}
                onStartConfirm={() => { clearError(deal.id); setConfirmingId(deal.id); }}
                onCancelConfirm={() => setConfirmingId(null)}
                onConfirm={() => handleRedeem(deal)}
              />
            ))}
          </div>
        ) : !loadError && (
          <div style={{ textAlign: 'center', padding: 'clamp(32px, 8vw, 64px) 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 400, marginBottom: 8 }}>
              {t('pointsStore.empty.title')}
            </div>
            <div style={{ fontSize: 12.5, color: C.gray, lineHeight: 1.7, maxWidth: 420, margin: '0 auto' }}>
              {t('pointsStore.empty.body')}
            </div>
          </div>
        )}

        {sorted.length > 0 && (
          <div style={{ fontSize: 11, color: C.gray, lineHeight: 1.7, marginTop: 28 }}>
            {t('pointsStore.footnote')}
          </div>
        )}
      </div>

      <style>{'@keyframes zai-spin { 100% { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
