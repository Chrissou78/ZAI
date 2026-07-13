import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../lib/stripe';

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

// ─── Inline Payment Form ───
function InlinePaymentForm({ onSuccess, onBack, amount }: {
  onSuccess: () => void;
  onBack: () => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || loading) return;

    setLoading(true);
    setError('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Please check your payment details');
        setLoading(false);
        return;
      }

      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/updates?payment=success',
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        setLoading(false);
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess();
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
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
          <div>Loading…</div>
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
        }}>Back</button>
        <button type="submit" disabled={!stripe || !ready || loading} style={{
          flex: 1, padding: '14px', border: 'none',
          background: (!stripe || !ready || loading) ? '#999' : C.red,
          color: '#fff', cursor: (!stripe || !ready || loading) ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          borderRadius: 6, fontFamily: C.font,
        }}>
          {loading ? 'Processing…' : `Pay CHF ${amount.toFixed(2)}`}
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: C.gray, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe
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
  const [balance, setBalance] = useState(0);
  const [points, setPoints] = useState(0);
  const [step, setStep] = useState<'points' | 'pay'>('points');
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<{ clientSecret: string; amount: number } | null>(null);

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
      if (json.success && json.data.clientSecret) {
        setPaymentData({ clientSecret: json.data.clientSecret, amount: json.data.amount });
        setStep('pay');
      } else {
        alert(json.error || 'Failed to create payment');
      }
    } catch {
      alert('Something went wrong');
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
         onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', background: C.pureWhite, borderRadius: 12, padding: '32px 28px',
        width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto',
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
              <div style={LABEL}>FULL PRICE</div>
              <div style={LABEL}>YOUR BALANCE</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24 }}>
              <div style={{ fontSize: 28, fontWeight: 300 }}>CHF {parseFloat(deal.price_chf).toLocaleString('de-CH', { minimumFractionDigits: 0 })}</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{balance.toLocaleString('de-CH')} pts</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={LABEL}>POINTS TO APPLY</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{points.toLocaleString('de-CH')} pts</div>
            </div>
            <input type="range" min={0} max={max} step={50} value={points}
                   onChange={e => setPoints(parseInt(e.target.value))}
                   style={{ width: '100%', accentColor: C.red, marginBottom: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.gray, marginBottom: 20 }}>
              <span>0 pts</span>
              <span>{max.toLocaleString('de-CH')} pts max</span>
            </div>

            <div style={{
              border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 20px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: C.gray }}>
                <span>Full price</span>
                <span>CHF {parseFloat(deal.price_chf).toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
              </div>
              {points > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8, color: C.red }}>
                  <span>Points discount ({points.toLocaleString('de-CH')} pts)</span>
                  <span>– CHF {discount.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>You pay</span>
                <span style={{ fontSize: 18, fontWeight: 600 }}>CHF {finalPrice.toLocaleString('de-CH', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <button onClick={handleConfirm} disabled={loading} style={{
              width: '100%', padding: '16px', background: C.red, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              borderRadius: 6, cursor: loading ? 'default' : 'pointer', fontFamily: C.font,
              opacity: loading ? 0.6 : 1,
            }}>
              {loading ? 'Processing…' : `CONTINUE TO PAYMENT`}
            </button>

            <div style={{ textAlign: 'center', fontSize: 11, color: C.gray, marginTop: 10 }}>
              1 pt = CHF 0.01 · Points deducted from your balance on confirmation
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
              <span style={{ fontSize: 13, color: C.gray }}>Total to pay</span>
              <span style={{ fontSize: 18, fontWeight: 600 }}>CHF {paymentData.amount.toFixed(2)}</span>
            </div>

            <Elements stripe={stripePromise} options={elementsOptions}>
              <InlinePaymentForm
                amount={paymentData.amount}
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
          : <div style={{ color: '#555', fontSize: 40 }}>⬡</div>
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
            <div style={{ fontSize: 11, color: C.gray }}>● Locked</div>
          </>
        )}
        {isClosed && !isClaimed && (
          <div style={{ fontSize: 11, color: C.gray }}>● Edition closed</div>
        )}
        {isClaimed && (
          <div style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>● Claimed ✓</div>
        )}
        {available && (
          <div style={{ fontSize: 11, color: C.green }}>● Available now</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{card.pointsReward}</div>
          <div style={{ fontSize: 10, color: C.gray, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {isClaimed ? 'PTS EARNED' : 'PTS TO EARN'}
          </div>
        </div>

        {available && (
          <button onClick={() => onClaim(card.id)} style={{
            width: '100%', marginTop: 10, padding: '10px', background: C.red, color: '#fff',
            border: 'none', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', borderRadius: 4, cursor: 'pointer', fontFamily: C.font,
          }}>CLAIM NOW</button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function Updates() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<'deals' | 'media'>('deals');
  const [deals, setDeals] = useState<any[]>([]);
  const [series, setSeries] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = authHeaders();
    Promise.all([
      fetch('/api/store/deals', { headers: h }).then(r => r.json()),
      fetch('/api/store/collectibles/series', { headers: h }).then(r => r.json()),
      fetch('/api/store/media', { headers: h }).then(r => r.json()),
    ]).then(([dRes, cRes, mRes]) => {
      if (dRes.success) setDeals(dRes.data);
      if (cRes.success) setSeries(cRes.data);
      if (mRes.success) setStories(mRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const featuredDeal = deals.find(d => d.featured) || deals[0];
  const regularDeals = deals.filter(d => d !== featuredDeal);
  const featuredStory = stories.find(s => s.featured) || stories[0];
  const regularStories = stories.filter(s => s !== featuredStory);

  useEffect(() => {
    const p = searchParams.get('payment');
    if (p === 'success') alert('Payment successful! Points have been updated.');
    if (p === 'cancelled') alert('Payment was cancelled.');
  }, [searchParams]);

  const handlePaymentSuccess = () => {
    setSelectedDeal(null);
    alert('Payment successful! Points have been updated.');
    const h = authHeaders();
    fetch('/api/store/deals', { headers: h }).then(r => r.json()).then(d => {
      if (d.success) setDeals(d.data);
    });
  };

  const handleClaimCollectible = async (cardId: string) => {
    try {
      const r = await fetch(`/api/store/collectibles/${cardId}/claim`, {
        method: 'POST', headers: authHeaders(),
      });
      const json = await r.json();
      if (json.success) {
        alert(`Claimed! +${json.data.pointsEarned} pts`);
        const cRes = await fetch('/api/store/collectibles/series', { headers: authHeaders() }).then(r => r.json());
        if (cRes.success) setSeries(cRes.data);
      } else {
        alert(json.error || 'Claim failed');
      }
    } catch {
      alert('Something went wrong');
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div style={{ padding: 48, fontFamily: C.font, textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.red, borderRadius: '50%', animation: 'zai-spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <span style={{ fontSize: 13, color: C.gray }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: C.font, color: C.black, padding: '48px 48px 64px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 20 }}>
          <h1 style={{ fontSize: 'clamp(28px, 3vw, 36px)', fontWeight: 300, margin: 0, lineHeight: 1.15 }}>
            Updates & Deals
          </h1>
          <div style={{ fontSize: 12, color: C.green }}>Member access only ●</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 32 }}>
          {(['deals', 'media'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '12px 20px', background: 'none', border: 'none', borderBottom: tab === t ? `2px solid ${C.black}` : '2px solid transparent',
              fontSize: 12, fontWeight: tab === t ? 700 : 500, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', fontFamily: C.font, color: tab === t ? C.black : C.gray,
            }}>
              {t === 'deals' ? 'Deals & Drops' : 'Media & Stories'}
            </button>
          ))}
        </div>

        {/* ═══ DEALS & DROPS TAB ═══ */}
        {tab === 'deals' && (
          <>
            {featuredDeal && (
              <div style={{
                background: C.black, borderRadius: 10, padding: '40px 36px',
                color: C.white, marginBottom: 40, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50%', height: '100%', opacity: 0.15, background: 'linear-gradient(135deg, transparent 40%, #7A222E 100%)' }} />
                <div style={{ ...LABEL, color: '#888', marginBottom: 16 }}>— FEATURED DEAL</div>
                <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 12px', border: '1px solid rgba(255,255,255,0.3)', color: '#ccc' }}>NEW DEAL</div>
                <h2 style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: 400, margin: '0 0 12px' }}>{featuredDeal.title}</h2>
                <div style={{ fontSize: 12, color: '#999', display: 'flex', gap: 20, marginBottom: 20 }}>
                  {featuredDeal.ends_at && <span>⊙ Available {Math.ceil((new Date(featuredDeal.ends_at).getTime() - Date.now()) / 86400000)}h only</span>}
                  <span>Exclusive Member Pricing</span>
                  {featuredDeal.spots_left > 0 && <span>Limited availability</span>}
                </div>
                <button onClick={() => setSelectedDeal(featuredDeal)} style={{
                  padding: '14px 28px', background: C.red, color: '#fff', border: 'none',
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                  borderRadius: 4, cursor: 'pointer', fontFamily: C.font,
                }}>
                  CLAIM OFFER, CHF {parseFloat(featuredDeal.price_chf).toLocaleString('de-CH')}
                </button>
              </div>
            )}

            {regularDeals.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <div style={RED_LABEL}>MEMBER DEALS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
                  <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300, margin: '6px 0 0' }}>Exclusive Offers</h2>
                  <span style={{ fontSize: 12, color: C.gray, cursor: 'pointer' }}>View all deals →</span>
                </div>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                  gap: 20,
                }}>
                  {regularDeals.map(deal => (
                    <div key={deal.id} style={{
                      border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px',
                      background: C.pureWhite, position: 'relative',
                    }}>
                      {deal.members_only && (
                        <div style={{
                          position: 'absolute', top: 12, right: 12, fontSize: 8, fontWeight: 700,
                          letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px',
                          background: C.black, color: '#fff', borderRadius: 2,
                        }}>MEMBERS ONLY</div>
                      )}
                      <div style={{ ...LABEL, marginBottom: 6 }}>{deal.category}</div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{deal.title}</div>
                      <div style={{ fontSize: 12, color: C.gray, marginBottom: 12, lineHeight: 1.5 }}>{deal.description}</div>
                      <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 12 }}>
                        CHF {parseFloat(deal.price_chf).toLocaleString('de-CH')}
                      </div>

                      {deal.max_points_discount > 0 && (
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', fontSize: 11,
                          padding: '8px 10px', background: C.surface, borderRadius: 4, marginBottom: 10,
                        }}>
                          <span style={{ color: C.gray }}>Up to {deal.max_points_discount.toLocaleString('de-CH')} pts max</span>
                          <span style={{ color: C.red, fontWeight: 600 }}>
                            save CHF {(deal.max_points_discount / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                        {deal.ends_at && <span style={{ color: C.gray }}>Ends <strong>{fmtDate(deal.ends_at)}</strong></span>}
                        <button onClick={() => setSelectedDeal(deal)} style={{
                          background: 'none', border: 'none', fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer',
                          color: C.black, fontFamily: C.font,
                        }}>APPLY POINTS →</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {series.map(s => (
              <div key={s.id} style={{ marginBottom: 48 }}>
                <div style={RED_LABEL}>COLLECTIBLE DROPS</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <h2 style={{ fontSize: 'clamp(22px, 2.5vw, 30px)', fontWeight: 300, margin: '6px 0 0' }}>{s.name}</h2>
                  <span style={{ fontSize: 12, color: C.gray }}>{s.totalCards}-piece set · Season {s.season}</span>
                </div>
                <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gray, marginBottom: 8 }}>
                  COLLECT EXCLUSIVE COLLECTIBLE DROPS TO EARN POINTS AND UNLOCK EXCLUSIVE MEMBER REWARDS
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <span style={{ fontSize: 12, color: C.gray }}>YOUR COLLECTION</span>
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

            {deals.length === 0 && series.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>
                No deals or drops available yet. Check back soon.
              </div>
            )}
          </>
        )}

        {/* ═══ MEDIA & STORIES TAB ═══ */}
        {tab === 'media' && (
          <>
            {featuredStory && (
              <>
                <div style={RED_LABEL}>TOP STORY</div>
                <div style={{
                  background: C.black, borderRadius: 10, overflow: 'hidden',
                  marginTop: 12, marginBottom: 32, position: 'relative', color: C.white,
                }}>
                  {featuredStory.thumbnail_url && (
                    <img src={featuredStory.thumbnail_url} alt="" style={{ width: '100%', height: 280, objectFit: 'cover', opacity: 0.5 }} />
                  )}
                  {!featuredStory.thumbnail_url && <div style={{ height: 280, background: 'linear-gradient(135deg, #1a1a1a, #333)' }} />}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '28px 32px' }}>
                    {featuredStory.media_type === 'video' && (
                      <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 10, fontWeight: 600, background: C.red, padding: '4px 10px', borderRadius: 3 }}>
                        ▶ VIDEO{featuredStory.duration ? ` · ${featuredStory.duration}` : ''}
                      </div>
                    )}
                    {featuredStory.media_type === 'video' && (
                      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: 56, height: 56, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <span style={{ fontSize: 20, marginLeft: 3 }}>▶</span>
                      </div>
                    )}
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>
                      {featuredStory.category} · EXCLUSIVE
                    </div>
                    <h2 style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 400, margin: '0 0 6px' }}>{featuredStory.title}</h2>
                    <div style={{ fontSize: 13, color: '#aaa' }}>{featuredStory.description}</div>
                  </div>
                </div>
              </>
            )}

            <div style={RED_LABEL}>ALL STORIES</div>
            <div style={{ marginTop: 16 }}>
              {regularStories.map(story => (
                <div key={story.id} style={{
                  display: 'flex', gap: 16, padding: '16px 0',
                  borderBottom: `1px solid ${C.border}`, alignItems: 'center',
                }}>
                  <div style={{
                    width: 72, height: 56, borderRadius: 6, overflow: 'hidden',
                    background: C.surface, flexShrink: 0, position: 'relative',
                  }}>
                    {story.thumbnail_url
                      ? <img src={story.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray, textTransform: 'uppercase' }}>{story.media_type}</div>
                    }
                    {story.media_type === 'video' && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 2 }}>▶</span>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.red, fontWeight: 500, marginBottom: 3 }}>
                      {story.media_type === 'video' ? '▶ ' : ''}{story.media_type} · {story.category}
                      {story.media_type === 'product_launch' && ' ●'}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{story.title}</div>
                    <div style={{ fontSize: 12, color: C.gray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{story.description}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: C.gray }}>{fmtDate(story.published_at)}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4, cursor: 'pointer' }}>
                      {story.media_type === 'video' ? 'WATCH →' : story.media_type === 'photo' ? 'VIEW →' : 'READ →'}
                    </div>
                  </div>
                </div>
              ))}

              {stories.length === 0 && (
                <div style={{ textAlign: 'center', padding: 48, color: C.gray, fontSize: 14 }}>
                  No stories yet. Check back soon.
                </div>
              )}
            </div>
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
