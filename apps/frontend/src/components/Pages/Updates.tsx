import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import { stripePromise } from '../../lib/stripe';
import ProductImageFallback from '../Common/ProductImageFallback';
import { PRODUCT_IMAGE_RATIO, PRODUCT_IMAGE_MAX_HEIGHT, PRODUCT_GRID_COLUMNS, PRODUCT_CARD_MAX_WIDTH } from '../Common/productCard';
import PointsStore from './PointsStore';

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', surface: '#f0ede6',
  pureWhite: '#ffffff', green: '#4caf7d', font: "'Inter', sans-serif",
};
const LABEL: React.CSSProperties = {
  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: C.gray, fontWeight: 500,
};
const RED_LABEL: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: C.red, fontWeight: 500,
};

const token = () => localStorage.getItem('zai_token') || '';
const authHeaders = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

// GET /api/store/deals returns every deal (including expired/archived ones)
// to admin accounts, so their own admin oversight view stays intact — but
// this page is the member-facing storefront, and an admin previewing it
// should see exactly what a real member would: a still-active "Apply
// Points" button on an already-expired deal just leads straight to the
// "Deal has expired" error at checkout. Filter client-side regardless of
// which branch the API took, rather than change that shared endpoint's
// admin behavior.
const isDealLive = (d: any) =>
  d.active !== false && (!d.ends_at || new Date(d.ends_at) > new Date());
// Points-only rewards share this same feed but carry `price_chf` 0 and are
// redeemed with points, never bought — left in, they rendered as a "CHF 0"
// money card with a Claim Deal button straight into the Stripe flow. They
// belong exclusively to the embedded <PointsStore /> section further down the
// page, which selects on `points_only === true`; these two sets never overlap.
const isMoneyDeal = (d: any) => d.points_only !== true;
const filterLiveDeals = (deals: any[]) =>
  (deals || []).filter(d => isDealLive(d) && isMoneyDeal(d));

// ─── Inline Payment Form ───
// Stripe confirming the payment client-side is NOT the same as your points
// being deducted and your product being minted — that fulfillment used to
// live only in the Stripe webhook, which isn't guaranteed to reach every
// deployment. So after Stripe confirms, we call a server endpoint that
// verifies the payment directly with Stripe (using the secret key) and only
// THEN runs fulfillment. We don't tell the user "success" until that call
// comes back — that's what makes "I paid but got nothing" impossible.
function InlinePaymentForm({ onSuccess, onBack, amount, redemptionId }: {
  onSuccess: () => void;
  onBack: () => void;
  amount: number;
  redemptionId: string;
}) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const confirmFulfillment = async () => {
    const r = await fetch(`/api/store/deals/redemptions/${redemptionId}/confirm`, {
      method: 'POST', headers: authHeaders(),
    });
    const json = await r.json();
    if (!json.success) {
      throw new Error(json.error || t('updates.payment.errors.fulfillmentFailed'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || loading) return;

    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || t('updates.payment.errors.checkDetails'));
        setLoading(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/updates?payment=success&redemptionId=' + redemptionId,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || t('updates.payment.errors.paymentFailed'));
        setLoading(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded') {
        // Card / wallet paid without a redirect — the common case. Finalize
        // right now so the user never sees a false "success".
        try {
          await confirmFulfillment();
          localStorage.removeItem('zai_pending_redemption');
          onSuccess();
        } catch (fulfillErr: any) {
          setError(fulfillErr?.message || t('updates.payment.errors.fulfillmentFailedRetry'));
          setLoading(false);
        }
      } else {
        // A redirect happened (3D Secure / some local payment methods) — the
        // browser will navigate to return_url, and the redemptionId we
        // stashed in localStorage lets Updates finish confirmation there.
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || t('updates.payment.errors.unexpected'));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement onReady={() => setReady(true)} options={{ layout: 'tabs' }} />

      {!ready && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: C.gray, fontSize: 13 }}>
          <div style={{
            width: 18, height: 18, border: `2px solid ${C.border}`, borderTopColor: C.red,
            borderRadius: '50%', animation: 'zai-spin 0.6s linear infinite',
            margin: '0 auto 8px', display: 'inline-block',
          }} />
          <div>{t('updates.common.loading')}</div>
        </div>
      )}

      {error && (
        <div style={{
          color: '#e53935', marginTop: 14, fontSize: 13, padding: '10px 14px',
          background: 'rgba(229,57,53,0.08)', borderRadius: 6,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button type="button" onClick={onBack} disabled={loading} style={{
          flex: 1, padding: '14px', border: `1px solid ${C.border}`, background: C.pureWhite,
          color: C.black, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: 6,
          fontFamily: C.font, opacity: loading ? 0.5 : 1,
        }}>{t('updates.payment.back')}</button>
        <button type="submit" disabled={!stripe || !ready || loading} style={{
          flex: 1, padding: '14px', border: 'none',
          background: (!stripe || !ready || loading) ? '#999' : C.red,
          color: '#fff', cursor: (!stripe || !ready || loading) ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          borderRadius: 6, fontFamily: C.font,
        }}>
          {loading ? t('updates.common.processing') : t('updates.payment.pay', { amount: amount.toFixed(2) })}
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: C.gray, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {t('updates.payment.securedByStripe')}
      </div>
    </form>
  );
}

// ─── Deal Modal (2 steps in one modal) ───
function DealModal({ deal, onClose, onSuccess }: {
  deal: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [points, setPoints] = useState(0);
  const [step, setStep] = useState<'points' | 'pay'>('points');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ clientSecret: string; amount: number; redemptionId: string } | null>(null);

  useEffect(() => {
    fetch('/api/store/rewards/balance', { headers: authHeaders() })
      .then(r => r.json()).then(d => { if (d.success) setBalance(d.data.balance); });
  }, []);

  const max = Math.min(balance, deal.max_points_discount || 0);
  const discount = points / 100;
  const finalPrice = Math.max(0, parseFloat(deal.price_chf) - discount);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/store/deals/${deal.id}/redeem`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ pointsToUse: points }),
      });
      const json = await r.json();
      // Points covered the whole price, so there is nothing to charge and the
      // server has already settled the redemption — no clientSecret comes
      // back. Without this branch the falsy clientSecret fell through to the
      // error alert below, telling the member it failed after their points had
      // been spent and the item fulfilled.
      if (json.success && json.data?.fullyCoveredByPoints) {
        localStorage.removeItem('zai_pending_redemption');
        onClose();
        onSuccess();
      } else if (json.success && json.data?.clientSecret) {
        setPaymentData({ clientSecret: json.data.clientSecret, amount: json.data.amount, redemptionId: json.data.redemptionId });
        // Survives a 3D-Secure/local-payment-method redirect so Updates can
        // finish confirmation on return, even though this component unmounts.
        localStorage.setItem('zai_pending_redemption', json.data.redemptionId);
        setStep('pay');
      } else {
        alert(json.error || t('updates.alerts.createPaymentFailed'));
      }
    } catch {
      alert(t('updates.alerts.somethingWrong'));
    } finally {
      setLoading(false);
    }
  };

  const elementsOptions = useMemo(() => paymentData ? {
    clientSecret: paymentData.clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: C.red,
        colorText: C.black,
        fontFamily: C.font,
        borderRadius: '6px',
      },
      rules: {
        '.Input': { border: `1px solid ${C.border}`, boxShadow: 'none' },
        '.Input:focus': { border: `1px solid ${C.red}`, boxShadow: `0 0 0 1px ${C.red}` },
      },
    },
  } : null, [paymentData]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}
         onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', background: C.pureWhite, borderRadius: 12, padding: 'clamp(20px, 5vw, 32px) clamp(18px, 4vw, 28px)',
        width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box',
      }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          fontSize: 20, cursor: 'pointer', color: C.gray,
        }}>×</button>

        <div style={RED_LABEL}>{deal.category}</div>
        <h2 style={{ fontSize: 20, fontWeight: 400, margin: '4px 0 20px' }}>{deal.title}</h2>

        {/* ── Step 1: Points selection ── */}
        {step === 'points' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <div style={LABEL}>{t('updates.deal.fullPrice')}</div>
              <div style={LABEL}>{t('updates.deal.yourBalance')}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 300 }}>CHF {parseFloat(deal.price_chf).toLocaleString('de-CH', { minimumFractionDigits: 0 })}</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{t('updates.deal.pts', { count: balance })}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={LABEL}>{t('updates.deal.pointsToApply')}</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{t('updates.deal.pts', { count: points })}</div>
            </div>
            <input type="range" min={0} max={max} step={50} value={points}
                   onChange={e => setPoints(parseInt(e.target.value))}
                   style={{ width: '100%', accentColor: C.red, marginBottom: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 20 }}>
              <span>{t('updates.deal.pts', { count: 0 })}</span>
              <span>{t('updates.deal.ptsMax', { count: max })}</span>
            </div>

            <div style={{
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: C.gray }}>
                <span>{t('updates.deal.summary.fullPrice')}</span>
                <span>CHF {parseFloat(deal.price_chf).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
              </div>
              {points > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: C.red }}>
                  <span>{t('updates.deal.summary.pointsDiscount', { count: points })}</span>
                  <span>– CHF {discount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>{t('updates.deal.summary.youPay')}</span>
                <span style={{ fontSize: 18, fontWeight: 600 }}>CHF {finalPrice.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button onClick={handleConfirm} disabled={loading} style={{
              width: '100%', padding: '16px', background: C.red, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              borderRadius: 6, cursor: loading ? 'default' : 'pointer', fontFamily: C.font,
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? t('updates.common.processing') : t('updates.deal.continueToPayment')}
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, color: C.gray, marginTop: 10 }}>
              {t('updates.deal.pointsNote')}
            </div>
          </>
        )}

        {/* ── Step 2: Payment form ── */}
        {step === 'pay' && paymentData && elementsOptions && (
          <>
            <div style={{
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', marginBottom: 20,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 13, color: C.gray }}>{t('updates.deal.totalToPay')}</span>
              <span style={{ fontSize: 18, fontWeight: 600 }}>CHF {paymentData.amount.toFixed(2)}</span>
            </div>

            <Elements stripe={stripePromise} options={elementsOptions}>
              <InlinePaymentForm
                amount={paymentData.amount}
                redemptionId={paymentData.redemptionId}
                onSuccess={() => { onClose(); onSuccess(); }}
                onBack={() => { setStep('points'); setPaymentData(null); }}
              />
            </Elements>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Collectible Card ───
function CollectibleCard({ card, onClaim }: { card: any; onClaim: (id: string) => void }) {
  const { t } = useTranslation();
  const isLocked = card.locked;
  const isClaimed = card.claimed;
  const isClosed = card.editionClosed;
  const available = !isLocked && !isClaimed && !isClosed;

  const rarityColors: Record<string, string> = {
    common: '#888', rare: C.red, epic: '#7A222E', legendary: '#b8860b',
  };

  return (
    <div style={{
      border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden',
      background: isLocked ? '#e8e5de' : C.pureWhite,
      opacity: isLocked ? 0.7 : 1, position: 'relative', minWidth: 160,
    }}>
      <div style={{
        position: 'absolute', top: 10, right: 10, fontSize: 8, fontWeight: 700,
        letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
        background: rarityColors[card.rarity] || '#888', color: '#fff', borderRadius: 3,
      }}>{card.rarity}</div>

      <div style={{
        position: 'absolute', top: 10, left: 12, fontSize: 10, color: isLocked ? '#999' : C.gray,
      }}>
        {String(card.cardNumber).padStart(2, '0')} / 06
      </div>

      <div style={{
        height: 150, background: isLocked ? '#d5d2cb' : C.black,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {card.imageUrl
          ? <img src={card.imageUrl} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isLocked ? 'grayscale(1) brightness(0.7)' : 'none' }} />
          : <ProductImageFallback size="lg" />
        }
        {isLocked && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 28 }}>🔒</div>
        )}
      </div>

      <div style={{ padding: '14px 14px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{card.name}</div>
        {isLocked && (
          <>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 2 }}>{card.lockReason}</div>
            <div style={{ fontSize: 11, color: C.gray }}>● {t('updates.collectibles.locked')}</div>
          </>
        )}
        {isClosed && !isClaimed && (
          <div style={{ fontSize: 11, color: C.gray }}>● {t('updates.collectibles.editionClosed')}</div>
        )}
        {isClaimed && (
          <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>● {t('updates.collectibles.claimed')} ✓</div>
        )}
        {available && (
          <div style={{ fontSize: 11, color: C.green }}>● {t('updates.collectibles.availableNow')}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{card.pointsReward}</div>
          <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {isClaimed ? t('updates.collectibles.ptsEarned') : t('updates.collectibles.ptsToEarn')}
          </div>
        </div>

        {available && (
          <button onClick={() => onClaim(card.id)} style={{
            width: '100%', marginTop: 10, padding: '10px', background: C.red, color: '#fff',
            border: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', borderRadius: 4, cursor: 'pointer', fontFamily: C.font,
          }}>{t('updates.collectibles.claimNow')}</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function Updates() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'deals' | 'collectibles'>('deals');
  const [deals, setDeals] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = authHeaders();
    Promise.all([
      fetch('/api/store/deals', { headers: h }).then(r => r.json()),
      fetch('/api/store/collectibles/series', { headers: h }).then(r => r.json()),
    ]).then(([dRes, cRes]) => {
      if (dRes.success) setDeals(filterLiveDeals(dRes.data));
      if (cRes.success) setSeries(cRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const featuredDeal = deals.find(d => d.featured) || deals[0];
  // The featured deal is deliberately NOT excluded here — it gets the hero
  // banner treatment above AND still appears as a normal card in the grid
  // below, so members browsing the card list don't have to notice the banner
  // to find it (and it isn't silently missing from "all" the deals).
  const regularDeals = deals;

  const refreshDeals = () => {
    const h = authHeaders();
    fetch('/api/store/deals', { headers: h }).then(r => r.json()).then(d => {
      if (d.success) setDeals(filterLiveDeals(d.data));
    });
  };

  // Handles the rare case where confirmPayment had to redirect (3D Secure /
  // certain local payment methods) — the InlinePaymentForm instance that
  // started the payment is gone after the redirect, so we finish
  // confirmation here using the redemptionId stashed in localStorage before
  // the redirect happened.
  useEffect(() => {
    const p = searchParams.get('payment');
    if (p === 'cancelled') {
      alert(t('updates.alerts.paymentCancelled'));
      localStorage.removeItem('zai_pending_redemption');
      return;
    }
    if (p !== 'success') return;

    const pendingId = searchParams.get('redemptionId') || localStorage.getItem('zai_pending_redemption');
    if (!pendingId) return;

    fetch(`/api/store/deals/redemptions/${pendingId}/confirm`, {
      method: 'POST', headers: authHeaders(),
    })
      .then(r => r.json())
      .then(json => {
        localStorage.removeItem('zai_pending_redemption');
        if (json.success) {
          alert(t('updates.alerts.paymentSuccessful'));
          refreshDeals();
        } else {
          alert(json.error || t('updates.alerts.confirmFailedGeneric'));
        }
      })
      .catch(() => {
        alert(t('updates.alerts.confirmFailedNetwork'));
      });
  }, [searchParams]);

  const handlePaymentSuccess = () => {
    setSelectedDeal(null);
    alert(t('updates.alerts.paymentSuccessful'));
    refreshDeals();
  };

  const handleClaimCollectible = async (cardId: string) => {
    try {
      const r = await fetch(`/api/store/collectibles/${cardId}/claim`, {
        method: 'POST', headers: authHeaders(),
      });
      const json = await r.json();
      if (json.success) {
        alert(t('updates.alerts.claimed', { points: json.data.pointsEarned }));
        const cRes = await fetch('/api/store/collectibles/series', { headers: authHeaders() }).then(r => r.json());
        if (cRes.success) setSeries(cRes.data);
      } else {
        alert(json.error || t('updates.alerts.claimFailed'));
      }
    } catch {
      alert(t('updates.alerts.somethingWrong'));
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.red, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>{t('updates.common.loading')}</span>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: C.font, color: C.black, paddingTop: 'clamp(24px, 5vw, 48px)', paddingBottom: 'clamp(32px, 6vw, 64px)', paddingLeft: 'clamp(16px, 4vw, 48px)', paddingRight: 'clamp(16px, 4vw, 48px)', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 20 }}>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, margin: 0, lineHeight: 1.15 }}>
            {t('updates.header.title')}
          </h1>
          <div style={{ fontSize: 12, color: C.green, whiteSpace: 'nowrap' }}>{t('updates.header.memberAccessOnly')} ●</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 32, overflowX: 'auto' }}>
          {(['deals', 'collectibles'] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)} style={{
              padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === tabKey ? `2px solid ${C.black}` : '2px solid transparent',
              fontSize: 12, fontWeight: tab === tabKey ? 700 : 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: C.font, color: tab === tabKey ? C.black : C.gray, whiteSpace: 'nowrap',
            }}>
              {tabKey === 'deals' ? t('updates.tabs.deals') : t('updates.tabs.collectibles')}
            </button>
          ))}
        </div>

        {/* ═══ DEALS TAB ═══ */}
        {tab === 'deals' && (
          <>
            {featuredDeal && (
              <div style={{
                background: C.black, borderRadius: 10, padding: 'clamp(24px, 5vw, 40px) clamp(20px, 5vw, 36px)',
                color: C.white, marginBottom: 40, position: 'relative', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 32, flexWrap: 'wrap', boxSizing: 'border-box',
              }}>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '100%', opacity: 0.15, background: 'linear-gradient(135deg, transparent 40%, #7A222E 100%)' }} />

                <div style={{ position: 'relative', zIndex: 1, flex: '1 1 320px', minWidth: 0 }}>
                  <div style={{ ...LABEL, color: '#888', marginBottom: 16 }}>{t('updates.featured.label')}</div>
                  <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 400, margin: '0 0 12px' }}>{featuredDeal.title}</h2>
                  <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
                    {featuredDeal.ends_at && <span>{t('updates.featured.availableHoursOnly', { hours: Math.ceil((new Date(featuredDeal.ends_at).getTime() - Date.now()) / 86400000) })}</span>}
                    <span>{t('updates.featured.exclusiveMemberPricing')}</span>
                    {featuredDeal.spots_left > 0 && <span>{t('updates.featured.limitedAvailability')}</span>}
                  </div>
                  <button onClick={() => setSelectedDeal(featuredDeal)} style={{
                    padding: '14px 28px', background: C.red, color: '#fff', border: 'none',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    borderRadius: 4, cursor: 'pointer', fontFamily: C.font,
                  }}>
                    {t('updates.featured.claimOffer', { price: parseFloat(featuredDeal.price_chf).toLocaleString('de-CH') })}
                  </button>
                </div>

                {/* One square box either way. Previously a featured deal with
                    no photo rendered no image area at all and floated the
                    badge over the card corner, which made the banner's layout
                    jump between deals — and the badge is kept scoped inside
                    the box because that corner position used to overlap the
                    text column. */}
                <div style={{
                  position: 'relative', zIndex: 1, flexShrink: 0,
                  width: 220, maxWidth: '100%', height: 'auto', aspectRatio: '1 / 1',
                  borderRadius: 8, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                }}>
                  {featuredDeal.image_url ? (
                    <img
                      src={featuredDeal.image_url}
                      alt={featuredDeal.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <ProductImageFallback size="lg" />
                  )}
                  <div style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 2,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '5px 12px', borderRadius: 4, color: '#fff',
                    background: 'rgba(122,34,46,0.9)', border: '1px solid rgba(122,34,46,0.5)',
                    backdropFilter: 'blur(8px)',
                  }}>{t('updates.featured.newDeal')}</div>
                </div>
              </div>
            )}

            {regularDeals.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <div style={RED_LABEL}>{t('updates.regular.memberDealsLabel')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
                  <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300, margin: '6px 0 0' }}>{t('updates.regular.exclusiveOffers')}</h2>
                  <span style={{ fontSize: 12, color: C.gray, cursor: 'pointer', whiteSpace: 'nowrap' }}>{t('updates.regular.viewAllDeals')}</span>
                </div>
                <div style={{
                  // auto-fit stretches existing cards to fill any leftover
                  // row space (via the 1fr track), which is exactly what
                  // made a single remaining deal blow up to the full grid
                  // width once expired ones got filtered out. auto-fill
                  // keeps the empty tracks in place instead of collapsing
                  // them, so leftover space goes to invisible phantom
                  // columns rather than stretching real cards — and the
                  // maxWidth on each card below (this section's own 1100px
                  // container, minus two 24px gaps, split three ways) is a
                  // second, exact guarantee of the same fixed size a card
                  // would have in a full 3-per-row layout, regardless of
                  // how many deals are actually listed.
                  display: 'grid', gridTemplateColumns: PRODUCT_GRID_COLUMNS,
                  gap: 24, justifyContent: 'start',
                }}>
                  {regularDeals.map(deal => (
                    <div
                      key={deal.id}
                      onClick={() => setSelectedDeal(deal)}
                      style={{
                        border: `1px solid ${C.border}`,
                        background: C.pureWhite, position: 'relative',
                        display: 'flex', flexDirection: 'column', cursor: 'pointer',
                        transition: 'background 0.2s',
                        width: '100%', maxWidth: PRODUCT_CARD_MAX_WIDTH,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = C.pureWhite)}
                    >
                      {/* Image — full card width in a portrait box, the same
                          card the points section uses so the two read as one
                          design. It replaced a 140px column down the left
                          side: that was both the smaller image and the more
                          cropped one, since squeezing portrait photos into a
                          narrow strip cut roughly a fifth off their sides.
                          Badge sits on the image rather than over the text,
                          where it used to collide with the category tag. */}
                      <div style={{
                        width: '100%', flexShrink: 0,
                        aspectRatio: PRODUCT_IMAGE_RATIO, maxHeight: PRODUCT_IMAGE_MAX_HEIGHT,
                        position: 'relative', background: C.black, overflow: 'hidden',
                      }}>
                        {deal.members_only && (
                          <div style={{
                            position: 'absolute', top: 8, left: 8, fontSize: 7,
                            letterSpacing: '0.2em', textTransform: 'uppercase', padding: '3px 7px',
                            background: C.black, color: C.white, zIndex: 1,
                          }}>{t('updates.regular.membersOnly')}</div>
                        )}
                        {deal.image_url ? (
                          <img src={deal.image_url} alt={deal.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <ProductImageFallback />
                        )}
                      </div>

                      {/* Content — below the image. Padding and type sizes
                          match the points card's body so the two sections are
                          the same card, not two cards that merely resemble
                          each other. */}
                      <div style={{
                        flex: 1, minWidth: 0, boxSizing: 'border-box',
                        padding: 'clamp(16px, 3vw, 22px)', display: 'flex', flexDirection: 'column',
                      }}>
                        <div style={{
                          fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
                          color: C.red, marginBottom: 9,
                        }}>{deal.category}</div>
                        {/* Was clipped to a single line with an ellipsis, which
                            suited the old narrow side column. Full-width now,
                            so let a long product name use a second line. */}
                        <div style={{
                          fontSize: 14.5, fontWeight: 500, color: C.black, marginBottom: 6, lineHeight: 1.35,
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{deal.title}</div>
                        <div style={{
                          fontSize: 11.5, color: C.gray, lineHeight: 1.6, marginBottom: 14, flex: 1,
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>{deal.description}</div>
                        <div style={{
                          fontSize: 20, fontWeight: 200, letterSpacing: '-0.02em', marginBottom: 10,
                        }}>
                          CHF {parseFloat(deal.price_chf).toLocaleString('de-CH')}
                        </div>

                        {deal.max_points_discount > 0 && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                            padding: '6px 8px', marginBottom: 14, overflow: 'hidden',
                            background: 'rgba(122,34,46,0.05)', border: '1px solid rgba(122,34,46,0.12)',
                          }}>
                            <span style={{
                              fontSize: 9.5, color: C.gray, whiteSpace: 'nowrap',
                              overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0,
                            }}>{t('updates.regular.upToPtsMax', { count: deal.max_points_discount })}</span>
                            <span style={{ fontSize: 9.5, color: C.red, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {t('updates.regular.saveChf', { amount: (deal.max_points_discount / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 }) })}
                            </span>
                          </div>
                        )}

                        <div style={{
                          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12,
                          paddingTop: 16, borderTop: `1px solid ${C.border}`,
                        }}>
                          {deal.ends_at && (
                            <span style={{ fontSize: 10, color: C.gray, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                              {t('updates.regular.endsOn')} <strong>{fmtDate(deal.ends_at)}</strong>
                            </span>
                          )}
                          {/* marginLeft:auto keeps the CTA right-aligned even when
                              there is no end date to sit opposite it. */}
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedDeal(deal); }}
                            style={{
                              marginLeft: 'auto', flexShrink: 0,
                              background: C.red, color: '#fff', border: 'none',
                              padding: '9px 16px', fontSize: 10, letterSpacing: '0.15em',
                              textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.font,
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                            onMouseLeave={e => (e.currentTarget.style.background = C.red)}
                          >{t('updates.regular.applyPoints')}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deals.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>
                {t('updates.emptyStates.noDeals')}
              </div>
            )}

            {/* Points-only rewards. Same page, separate catalogue: this owns
                its own fetch, balance and redeem flow (it is the very same
                component the /redeem route renders), and only ever lists
                `points_only` items — the money grid above excludes them. */}
            <PointsStore embedded />
          </>
        )}

        {/* ═══ COLLECTIBLE DROPS TAB ═══ */}
        {tab === 'collectibles' && (
          <>
            {series.map(s => (
              <div key={s.id} style={{ marginBottom: 48 }}>
                <div style={RED_LABEL}>{t('updates.collectibles.dropsLabel')}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                  <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300, margin: '6px 0 0' }}>{s.name}</h2>
                  <span style={{ fontSize: 12, color: C.gray, whiteSpace: 'nowrap' }}>{t('updates.collectibles.piecesSet', { count: s.totalCards, season: s.season })}</span>
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gray, marginBottom: 8 }}>
                  {t('updates.collectibles.collectDesc')}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: C.gray }}>{t('updates.collectibles.yourCollection')}</span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{s.claimedCount}</span>
                  <span style={{ color: C.red }}>●</span>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 14,
                }}>
                  {s.cards.map((card: any) => (
                    <CollectibleCard key={card.id} card={card} onClaim={handleClaimCollectible} />
                  ))}
                </div>
              </div>
            ))}

            {series.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>
                {t('updates.emptyStates.noCollectibles')}
              </div>
            )}
          </>
        )}
      </div>

      {selectedDeal && (
        <DealModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      <style>{`@keyframes zai-spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
