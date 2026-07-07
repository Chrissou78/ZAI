import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

/* ── Design tokens ── */
const C = {
  black: '#0a0a0a',
  white: '#f5f4f0',
  red: '#7A222E',
  redHover: '#9a2535',
  gray: '#6a6a6a',
  border: '#e0ddd6',
  surface: '#f0ede6',
  pureWhite: '#ffffff',
  green: '#4caf7d',
  font: "'Inter', sans-serif",
};
const BR = `1px solid ${C.border}`;
const LABEL: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: C.gray,
  fontWeight: 500,
  marginBottom: 6,
};
const RED_LABEL: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  color: C.red,
  fontWeight: 500,
  fontFamily: C.font,
};
const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: BR,
  fontSize: 13,
  fontFamily: C.font,
  borderRadius: 4,
  boxSizing: 'border-box' as const,
  background: C.pureWhite,
};
const BTN: React.CSSProperties = {
  padding: '10px 20px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  border: 'none',
  borderRadius: 4,
  background: C.red,
  color: '#fff',
  cursor: 'pointer',
  fontFamily: C.font,
  transition: 'all 0.2s',
};
const BTN_OUTLINE: React.CSSProperties = {
  ...BTN,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  color: C.black,
};

/* ── Tier definitions ── */
const TIERS = [
  { name: 'Blue', color: '#3B6B9E', min: 0 },
  { name: 'Red', color: '#7D1E2C', min: 5000 },
  { name: 'Black', color: '#1a1a1a', min: 15000 },
  { name: 'Diamond', color: '#8B7D6B', min: 50000 },
];

function getTier(points: number) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (points >= TIERS[i].min) return { ...TIERS[i], index: i };
  }
  return { ...TIERS[0], index: 0 };
}

function getNextTier(points: number) {
  const current = getTier(points);
  if (current.index >= TIERS.length - 1) return null;
  return TIERS[current.index + 1];
}

/* ── Section wrapper ── */
function Section({
  label,
  title,
  children,
  action,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: C.pureWhite,
        border: BR,
        borderRadius: 12,
        padding: '28px',
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <div style={RED_LABEL}>{label}</div>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 300,
              margin: '4px 0 0',
              color: C.black,
            }}
          >
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PROFILE COMPONENT
   ══════════════════════════════════════════════════════════ */
const Profile: React.FC = () => {
  const { user } = useAppContext();

  /* ── Profile state ── */
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  /* ── Experience card state ── */
  const [hasExperienceCard, setHasExperienceCard] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [editingCard, setEditingCard] = useState(false);
  const [cardInput, setCardInput] = useState('');
  const [savingCard, setSavingCard] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);

  /* ── Rewards state ── */
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);

  /* ── Referral state ── */
  const [referralCode, setReferralCode] = useState('');
  const [referralStats, setReferralStats] = useState<any>(null);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [referralInput, setReferralInput] = useState('');
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [referralMessage, setReferralMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  /* ── Load profile ── */
  const loadProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const r = await apiService.get(`/products/user/${user.id}`);
      if (r.data?.success) {
        const d = r.data as any;
        setProfile(d.profile || {});
        setHasExperienceCard(!!d.experienceCard || !!d.stats?.hasExperienceCard);
        setCardNumber(d.profile?.card_number || '');
      }
    } catch {}
  }, [user?.id]);

  /* ── Load rewards ── */
  const loadRewards = useCallback(async () => {
    if (!user?.id) return;
    setLoadingPoints(true);
    try {
      const r = await apiService.get('/store/rewards/balance');
      if (r.data?.success) {
        setPoints(r.data.data?.points || 0);
      }
    } catch {} finally {
      setLoadingPoints(false);
    }
  }, [user?.id]);

  /* ── Load referral ── */
  const loadReferral = useCallback(async () => {
    if (!user?.id) return;
    setLoadingReferral(true);
    try {
      const [codeRes, statsRes] = await Promise.all([
        apiService.get('/store/referrals/code'),
        apiService.get('/store/referrals/stats'),
      ]);
      if (codeRes.data?.success) {
        setReferralCode(codeRes.data.data?.code || '');
      }
      if (statsRes.data?.success) {
        setReferralStats(statsRes.data.data || null);
      }
    } catch {} finally {
      setLoadingReferral(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfile();
    loadRewards();
    loadReferral();
  }, [loadProfile, loadRewards, loadReferral]);

  /* ── NFC support check ── */
  useEffect(() => {
    setNfcSupported('NDEFReader' in window);
  }, []);

  /* ── Pre-fill referral from localStorage ── */
  useEffect(() => {
    const stored = localStorage.getItem('zai_referral_code');
    if (stored && !referralStats?.applied_code) {
      setReferralInput(stored);
    }
  }, [referralStats]);

  if (!user) {
    return (
      <div
        style={{
          padding: 48,
          fontFamily: C.font,
          textAlign: 'center',
          color: C.gray,
        }}
      >
        <p style={{ fontSize: 16 }}>Connect your wallet to view your profile.</p>
      </div>
    );
  }

  /* ── Handlers ── */
  const startEdit = () => {
    setForm({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      location: profile?.location || '',
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await apiService.put('/products/profile', form);
      setEditing(false);
      loadProfile();
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveCardNumber = async () => {
    setSavingCard(true);
    try {
      await apiService.put('/products/profile', { card_number: cardInput });
      setCardNumber(cardInput);
      setEditingCard(false);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Save failed');
    } finally {
      setSavingCard(false);
    }
  };

  const startNfcRead = async () => {
    if (!('NDEFReader' in window)) return;
    setNfcReading(true);
    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.addEventListener('reading', ({ serialNumber }: any) => {
        const formatted = serialNumber
          ? serialNumber.replace(/:/g, '').toUpperCase()
          : '';
        if (formatted) {
          setCardInput(formatted);
          setEditingCard(true);
        }
        setNfcReading(false);
      });
      ndef.addEventListener('readingerror', () => {
        setNfcReading(false);
        alert('Could not read NFC tag. Please try again.');
      });
      // Auto-timeout after 30s
      setTimeout(() => setNfcReading(false), 30000);
    } catch (err: any) {
      setNfcReading(false);
      if (err.name === 'NotAllowedError') {
        alert('NFC permission denied. Please allow NFC access in your browser settings.');
      } else {
        alert('NFC reading failed. Make sure NFC is enabled on your device.');
      }
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const applyReferralCode = async () => {
    if (!referralInput.trim()) return;
    setApplyingReferral(true);
    setReferralMessage('');
    try {
      const r = await apiService.post('/store/referrals/apply', {
        code: referralInput.trim(),
      });
      if (r.data?.success) {
        setReferralMessage("Referral code applied! You'll earn bonus points on your first product claim.");
        localStorage.removeItem('zai_referral_code');
        loadReferral();
      } else {
        setReferralMessage(r.data?.error || 'Invalid referral code.');
      }
    } catch (e: any) {
      setReferralMessage(e?.response?.data?.error || 'Could not apply referral code.');
    } finally {
      setApplyingReferral(false);
    }
  };

  const displayName =
    profile?.display_name ||
    user?.email?.split('@')[0] ||
    `${(user as any)?.address?.slice(0, 6)}…${(user as any)?.address?.slice(-4)}`;

  const tier = getTier(points);
  const nextTier = getNextTier(points);
  const progress = nextTier
    ? ((points - tier.min) / (nextTier.min - tier.min)) * 100
    : 100;

  return (
    <div
      style={{
        padding: '48px 48px 80px',
        fontFamily: C.font,
        color: C.black,
        background: C.white,
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* ── Header ── */}
        <div
          style={{
            marginBottom: '2.5rem',
            paddingBottom: '2rem',
            borderBottom: BR,
          }}
        >
          <div style={RED_LABEL}>profile</div>
          <h1
            style={{
              fontSize: 'clamp(28px, 3vw, 36px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '6px 0 4px',
            }}
          >
            {displayName}
          </h1>
          {profile?.location && (
            <p style={{ color: C.gray, fontSize: 13, margin: 0 }}>
              {profile.location}
            </p>
          )}
        </div>

        {/* ══════════  EXPERIENCE CARD  ══════════ */}
        <Section
          label="membership"
          title="Experience Card"
          action={
            hasExperienceCard && !editingCard ? (
              <button
                style={BTN_OUTLINE}
                onClick={() => {
                  setCardInput(cardNumber);
                  setEditingCard(true);
                }}
              >
                {cardNumber ? 'Edit Card #' : 'Add Card #'}
              </button>
            ) : undefined
          }
        >
          {hasExperienceCard ? (
            <div>
              {/* Card image — same as dashboard/home */}
              <img
                src="/images/experience-card.png"
                alt="zai Experience Card"
                style={{
                  width: '100%',
                  maxWidth: 400,
                  height: 'auto',
                  borderRadius: 14,
                  display: 'block',
                  marginBottom: 20,
                }}
              />

              {/* Card number display / edit */}
              {editingCard ? (
                <div
                  style={{
                    background: C.surface,
                    borderRadius: 8,
                    padding: '16px 20px',
                    border: BR,
                  }}
                >
                  <div style={LABEL}>Card Number</div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <input
                      style={{ ...INPUT, flex: 1 }}
                      value={cardInput}
                      onChange={(e) => setCardInput(e.target.value.toUpperCase())}
                      placeholder="Enter card number or scan via NFC"
                      maxLength={32}
                    />
                    {nfcSupported && (
                      <button
                        style={{
                          ...BTN_OUTLINE,
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          whiteSpace: 'nowrap',
                          opacity: nfcReading ? 0.6 : 1,
                        }}
                        onClick={startNfcRead}
                        disabled={nfcReading}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
                          <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                          <path d="M12.91 4.1a16.1 16.1 0 0 1 0 15.8" />
                          <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
                        </svg>
                        {nfcReading ? 'Scanning…' : 'Scan NFC'}
                      </button>
                    )}
                  </div>
                  {nfcReading && (
                    <div
                      style={{
                        fontSize: 12,
                        color: C.red,
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: C.red,
                          animation: 'pulse 1.5s infinite',
                        }}
                      />
                      Hold your card near the device…
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      style={BTN_OUTLINE}
                      onClick={() => {
                        setEditingCard(false);
                        setNfcReading(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      style={{ ...BTN, opacity: savingCard || !cardInput.trim() ? 0.5 : 1 }}
                      onClick={saveCardNumber}
                      disabled={savingCard || !cardInput.trim()}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = C.redHover)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = C.red)
                      }
                    >
                      {savingCard ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : cardNumber ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: C.surface,
                    borderRadius: 8,
                    border: BR,
                  }}
                >
                  <div style={{ fontSize: 11, color: C.gray, letterSpacing: '0.1em' }}>
                    CARD #
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {cardNumber}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '14px 18px',
                    background: C.surface,
                    borderRadius: 8,
                    border: BR,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 13, color: C.gray }}>
                    No card number linked yet.
                  </div>
                  <button
                    style={{ ...BTN, padding: '8px 14px', fontSize: 10 }}
                    onClick={() => {
                      setCardInput('');
                      setEditingCard(true);
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = C.redHover)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = C.red)
                    }
                  >
                    Add Card Number
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 20px',
                background: C.surface,
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
              <div style={{ fontSize: 14, color: C.gray, lineHeight: 1.7 }}>
                You don't have an Experience Card yet.
                <br />
                Spend over CHF 500 on zai products to become eligible.
              </div>
            </div>
          )}
        </Section>

        {/* ══════════  REWARDS & TIER  ══════════ */}
        <Section label="rewards" title="Tier & Points">
          {loadingPoints ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.gray, fontSize: 13 }}>
              Loading…
            </div>
          ) : (
            <div>
              {/* Tier badge + points */}
              <div
                style={{
                  display: 'flex',
                  gap: 20,
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: tier.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 20, color: '#fff', fontWeight: 700 }}>
                    {tier.name[0]}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      marginBottom: 2,
                    }}
                  >
                    {tier.name} Tier
                  </div>
                  <div style={{ fontSize: 13, color: C.gray }}>
                    {points.toLocaleString()} points
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {nextTier ? (
                <div style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      fontSize: 11,
                      color: C.gray,
                    }}
                  >
                    <span>{tier.name}</span>
                    <span>
                      {(nextTier.min - points).toLocaleString()} pts to{' '}
                      {nextTier.name}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: C.border,
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(progress, 100)}%`,
                        background: tier.color,
                        borderRadius: 3,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px 16px',
                    background: C.surface,
                    borderRadius: 8,
                    border: BR,
                    fontSize: 13,
                    color: C.gray,
                    textAlign: 'center',
                  }}
                >
                  You've reached the highest tier. Welcome to Diamond.
                </div>
              )}

              {/* All tiers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1px',
                  background: C.border,
                  border: BR,
                  borderRadius: 8,
                  overflow: 'hidden',
                  marginTop: 20,
                }}
              >
                {TIERS.map((t) => {
                  const isActive = tier.name === t.name;
                  return (
                    <div
                      key={t.name}
                      style={{
                        background: isActive ? C.surface : C.pureWhite,
                        padding: '16px 14px',
                        textAlign: 'center',
                        position: 'relative',
                      }}
                    >
                      {isActive && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            background: t.color,
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: t.color,
                          margin: '0 auto 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: isActive ? 1 : 0.4,
                        }}
                      >
                        <span
                          style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}
                        >
                          {t.name[0]}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                          marginBottom: 2,
                          color: isActive ? C.black : C.gray,
                        }}
                      >
                        {t.name}
                      </div>
                      <div style={{ fontSize: 10, color: C.gray }}>
                        {t.min === 0 ? 'Start' : `${t.min.toLocaleString()}+`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {/* ══════════  REFERRAL PROGRAM  ══════════ */}
        <Section label="referral" title="Invite Friends">
          {loadingReferral ? (
            <div style={{ textAlign: 'center', padding: 24, color: C.gray, fontSize: 13 }}>
              Loading…
            </div>
          ) : (
            <div>
              {/* Your referral code */}
              <div style={{ marginBottom: 24 }}>
                <div style={LABEL}>Your Referral Link</div>
                {referralCode ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        background: C.surface,
                        border: BR,
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: 'monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {window.location.origin}/?ref={referralCode}
                    </div>
                    <button
                      style={{
                        ...BTN,
                        padding: '10px 16px',
                        whiteSpace: 'nowrap',
                        background: copied ? C.green : C.red,
                      }}
                      onClick={copyReferralLink}
                      onMouseEnter={(e) => {
                        if (!copied)
                          e.currentTarget.style.background = C.redHover;
                      }}
                      onMouseLeave={(e) => {
                        if (!copied)
                          e.currentTarget.style.background = C.red;
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '14px 18px',
                      background: C.surface,
                      borderRadius: 8,
                      border: BR,
                      fontSize: 13,
                      color: C.gray,
                    }}
                  >
                    Your referral code will be generated automatically. Reload the page if it doesn't appear.
                  </div>
                )}
              </div>

              {/* Referral stats */}
              {referralStats && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '1px',
                    background: C.border,
                    border: BR,
                    borderRadius: 8,
                    overflow: 'hidden',
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      background: C.pureWhite,
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 2 }}>
                      {referralStats.total_referrals || 0}
                    </div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gray }}>
                      Invited
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.pureWhite,
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 2 }}>
                      {referralStats.completed_referrals || 0}
                    </div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gray }}>
                      Claimed
                    </div>
                  </div>
                  <div
                    style={{
                      background: C.pureWhite,
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 22, fontWeight: 300, marginBottom: 2 }}>
                      {referralStats.points_earned || 0}
                    </div>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.gray }}>
                      Pts Earned
                    </div>
                  </div>
                </div>
              )}

              {/* How it works */}
              <div
                style={{
                  padding: '14px 18px',
                  background: C.surface,
                  borderRadius: 8,
                  border: BR,
                  marginBottom: 24,
                }}
              >
                <div style={{ fontSize: 12, color: C.gray, lineHeight: 1.7 }}>
                  Share your link with friends. When they join and claim their
                  first product, you earn{' '}
                  <strong style={{ color: C.black }}>200 points</strong> and they
                  receive{' '}
                  <strong style={{ color: C.black }}>100 points</strong>.
                </div>
              </div>

              {/* Apply a referral code */}
              {!referralStats?.applied_code && (
                <div>
                  <div style={LABEL}>Have a Referral Code?</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      style={{ ...INPUT, flex: 1 }}
                      value={referralInput}
                      onChange={(e) =>
                        setReferralInput(e.target.value.toUpperCase())
                      }
                      placeholder="Enter code (e.g. ZAI-XXXX)"
                      maxLength={20}
                    />
                    <button
                      style={{
                        ...BTN,
                        padding: '10px 16px',
                        whiteSpace: 'nowrap',
                        opacity: applyingReferral || !referralInput.trim() ? 0.5 : 1,
                      }}
                      onClick={applyReferralCode}
                      disabled={applyingReferral || !referralInput.trim()}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = C.redHover)
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = C.red)
                      }
                    >
                      {applyingReferral ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                  {referralMessage && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: referralMessage.includes('applied')
                          ? C.green
                          : C.red,
                      }}
                    >
                      {referralMessage}
                    </div>
                  )}
                </div>
              )}

              {referralStats?.applied_code && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: C.surface,
                    border: BR,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 14 }}>✓</span>
                  <span style={{ fontSize: 13, color: C.gray }}>
                    Referred by code{' '}
                    <strong style={{ fontFamily: 'monospace' }}>
                      {referralStats.applied_code}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* ══════════  PERSONAL INFO  ══════════ */}
        <Section
          label="personal"
          title="Profile Details"
          action={
            !editing ? (
              <button style={BTN_OUTLINE} onClick={startEdit}>
                Edit
              </button>
            ) : undefined
          }
        >
          {editing ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>Display Name</div>
                <input
                  style={INPUT}
                  value={form.display_name || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({
                      ...f,
                      display_name: e.target.value,
                    }))
                  }
                  placeholder="Your name"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>Location</div>
                <input
                  style={INPUT}
                  value={form.location || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, location: e.target.value }))
                  }
                  placeholder="Pontresina, Switzerland"
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={LABEL}>Bio</div>
                <textarea
                  style={{ ...INPUT, minHeight: 80, resize: 'vertical' }}
                  value={form.bio || ''}
                  onChange={(e) =>
                    setForm((f: any) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Tell us about yourself…"
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  justifyContent: 'flex-end',
                }}
              >
                <button style={BTN_OUTLINE} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  style={{ ...BTN, opacity: saving ? 0.5 : 1 }}
                  onClick={saveProfile}
                  disabled={saving}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = C.redHover)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = C.red)
                  }
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                }}
              >
                <div>
                  <div style={LABEL}>Display Name</div>
                  <div style={{ fontSize: 14 }}>
                    {profile?.display_name || '—'}
                  </div>
                </div>
                <div>
                  <div style={LABEL}>Location</div>
                  <div style={{ fontSize: 14 }}>
                    {profile?.location || '—'}
                  </div>
                </div>
              </div>
              {profile?.bio && (
                <div style={{ marginTop: 16 }}>
                  <div style={LABEL}>Bio</div>
                  <div
                    style={{
                      fontSize: 13,
                      color: C.gray,
                      lineHeight: 1.7,
                    }}
                  >
                    {profile.bio}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 16 }}>
                <div style={LABEL}>Wallet</div>
                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: C.gray,
                    wordBreak: 'break-all',
                  }}
                >
                  {(user as any)?.address || user?.id || '—'}
                </div>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* NFC pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default Profile;
