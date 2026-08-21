import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import UserAvatar from '../Common/UserAvatar';
import ProductImageFallback from '../Common/ProductImageFallback';

/* ── Design tokens ── */
const C = {
  black: '#0a0a0a',
  white: '#f5f4f0',
  red: '#7A222E',
  burgundy: '#7D1E2C',
  gray: '#6a6a6a',
  mid: '#999',
  border: '#e0ddd6',
  borderDark: '#d0cdc6',
  surface: '#f0ede6',
  surface2: '#e8e5de',
  green: '#2a9d4e',
  font: "'Inter', sans-serif",
};

const label: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  color: C.gray,
  fontFamily: C.font,
};

interface UserStats {
  productsClaimed: number;
  eventsAttended: number;
}

interface CardInfo {
  cardId: string;
  isActive: boolean;
  nfcEnabled: boolean;
  name: string;
  image: string;
  tokenAddress: string;
}

/* ── Helper: sanitize Engage values — replace literal "true" with dash ── */
function clean(val: any): string {
  if (val === true || val === 'true') return '';
  if (val === false || val === 'false') return '';
  if (val === null || val === undefined) return '';
  return String(val);
}

/* ── Tier definitions (matching the design) ── */
const TIERS = [
  {
    name: 'Blue',
    color: '#3B6B9E',
    min: 0,
    max: 14999,
    benefits: [
      'Product registration',
      'Event newsletter',
      'Digital warranty',
    ],
  },
  {
    name: 'Red',
    color: '#7D1E2C',
    min: 15000,
    max: 29999,
    benefits: [
      'Priority event access',
      'Maintenance discount',
      'Partner benefits',
      'Dedicated support',
    ],
  },
  {
    name: 'Black',
    color: '#1a1a1a',
    min: 30000,
    max: 49999,
    benefits: [
      'VIP event invitations',
      'Early product launches',
      'Custom fitting service',
      'Partner elite access',
      'Referral bonuses',
    ],
  },
  {
    name: 'Diamond',
    color: '#8B7D6B',
    min: 50000,
    max: Infinity,
    benefits: [
      'Factory visits, Pontresina',
      'Bespoke commission',
      'Personal zai ambassador',
      'All partner elite benefits',
      'Annual zai retreat',
    ],
  },
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

/* ── Country list ── */
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Argentina','Armenia','Australia',
  'Austria','Azerbaijan','Bahrain','Bangladesh','Belgium','Bolivia','Bosnia and Herzegovina',
  'Brazil','Bulgaria','Cambodia','Cameroon','Canada','Chile','China','Colombia','Costa Rica',
  'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt',
  'Estonia','Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Guatemala',
  'Hong Kong','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Latvia','Lebanon','Libya',
  'Liechtenstein','Lithuania','Luxembourg','Malaysia','Malta','Mexico','Moldova','Monaco',
  'Mongolia','Montenegro','Morocco','Mozambique','Netherlands','New Zealand','Nigeria',
  'North Macedonia','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines',
  'Poland','Portugal','Qatar','Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore',
  'Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland',
  'Taiwan','Thailand','Tunisia','Turkey','UAE','Uganda','Ukraine','United Kingdom',
  'United States','Uruguay','Uzbekistan','Venezuela','Vietnam',
];

/* ── Phone country codes ── */
const PHONE_CODES = [
  { code: '+41',  label: '+41 (CH)' },
  { code: '+33',  label: '+33 (FR)' },
  { code: '+49',  label: '+49 (DE)' },
  { code: '+39',  label: '+39 (IT)' },
  { code: '+43',  label: '+43 (AT)' },
  { code: '+44',  label: '+44 (UK)' },
  { code: '+1',   label: '+1 (US/CA)' },
  { code: '+34',  label: '+34 (ES)' },
  { code: '+351', label: '+351 (PT)' },
  { code: '+32',  label: '+32 (BE)' },
  { code: '+31',  label: '+31 (NL)' },
  { code: '+352', label: '+352 (LU)' },
  { code: '+423', label: '+423 (LI)' },
  { code: '+377', label: '+377 (MC)' },
  { code: '+46',  label: '+46 (SE)' },
  { code: '+47',  label: '+47 (NO)' },
  { code: '+45',  label: '+45 (DK)' },
  { code: '+358', label: '+358 (FI)' },
  { code: '+354', label: '+354 (IS)' },
  { code: '+48',  label: '+48 (PL)' },
  { code: '+420', label: '+420 (CZ)' },
  { code: '+36',  label: '+36 (HU)' },
  { code: '+30',  label: '+30 (GR)' },
  { code: '+353', label: '+353 (IE)' },
  { code: '+81',  label: '+81 (JP)' },
  { code: '+86',  label: '+86 (CN)' },
  { code: '+82',  label: '+82 (KR)' },
  { code: '+91',  label: '+91 (IN)' },
  { code: '+971', label: '+971 (AE)' },
  { code: '+966', label: '+966 (SA)' },
  { code: '+974', label: '+974 (QA)' },
  { code: '+65',  label: '+65 (SG)' },
  { code: '+852', label: '+852 (HK)' },
  { code: '+61',  label: '+61 (AU)' },
  { code: '+64',  label: '+64 (NZ)' },
  { code: '+55',  label: '+55 (BR)' },
  { code: '+52',  label: '+52 (MX)' },
  { code: '+27',  label: '+27 (ZA)' },
  { code: '+7',   label: '+7 (RU)' },
  { code: '+90',  label: '+90 (TR)' },
  { code: '+380', label: '+380 (UA)' },
];

/* ── Helper: extract phone code ── */
function parsePhone(phoneNumber: string): { phoneCode: string; phoneLocal: string } {
  if (!phoneNumber) return { phoneCode: '+41', phoneLocal: '' };
  const trimmed = phoneNumber.trim();
  for (const pc of PHONE_CODES) {
    if (trimmed.startsWith(pc.code + ' ') || trimmed.startsWith(pc.code + '-')) {
      return { phoneCode: pc.code, phoneLocal: trimmed.slice(pc.code.length).trim() };
    }
    if (trimmed === pc.code) {
      return { phoneCode: pc.code, phoneLocal: '' };
    }
  }
  if (trimmed.startsWith('+')) {
    const sorted = [...PHONE_CODES].sort((a, b) => b.code.length - a.code.length);
    for (const pc of sorted) {
      if (trimmed.startsWith(pc.code)) {
        return { phoneCode: pc.code, phoneLocal: trimmed.slice(pc.code.length).trim() };
      }
    }
    return { phoneCode: '', phoneLocal: trimmed };
  }
  return { phoneCode: '+41', phoneLocal: trimmed };
}

/* ── Helper to build formData ── */
const toFormData = (src: any) => {
  const { phoneCode, phoneLocal } = parsePhone(clean(src?.phoneNumber));
  return {
    givenName: clean(src?.givenName),
    familyName: clean(src?.familyName),
    email: clean(src?.email),
    phoneCode,
    phoneLocal,
    address: clean(src?.address),
    city: clean(src?.city),
    country: clean(src?.country),
    postalCode: clean(src?.postalCode),
    birthdate: clean(src?.birthdate),
    isPublic: src?.isPublic === true,
  };
};

/* ═══════════════════════════════════════════════════════════
   TIER DISPLAY — white progress card, matches the design reference
   ═══════════════════════════════════════════════════════════ */
const TierDisplay: React.FC<{ points: number }> = ({ points }) => {
  const { t } = useTranslation();
  const tierName = (name: string) => t(`profile.tiers.${name.toLowerCase()}`, name);
  const tier = getTier(points);
  const next = getNextTier(points);
  const progress = next
    ? Math.min(100, Math.max(0, ((points - tier.min) / (next.min - tier.min)) * 100))
    : 100;
  const barColor = tier.color === '#1a1a1a' ? C.red : tier.color;

  return (
    <div>
      <div
        style={{
          border: `1px solid ${C.border}`,
          padding: 'clamp(16px, 4vw, 28px)',
          borderRadius: 4,
          background: '#fff',
        }}
      >
        {/* Bar and button stay visible at max tier (100% filled) rather than
            being replaced by a plain "Maximum Tier Reached" message — the
            layout shouldn't collapse and members can still claim products
            for points even after unlocking every tier. */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 32,
            alignItems: 'flex-end',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: C.gray,
                marginBottom: 10,
                fontFamily: C.font,
              }}
            >
              {next ? t('profile.tierDisplay.progressTo', { tier: tierName(next.name) }) : t('profile.tierDisplay.maxTierReached')}
            </div>
            {/* Fixed 22px, not a responsive clamp up to 32px — the larger
                size wrapped "35,500 / 50,000 points" onto a second line
                well before the column ran out of room. */}
            <div style={{ marginBottom: 8, whiteSpace: 'nowrap' }}>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 300,
                  color: C.black,
                }}
              >
                {points.toLocaleString()}
              </span>
              {next && (
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 300,
                    color: C.gray,
                  }}
                >
                  {' '}{t('profile.tierDisplay.ofPoints', { max: next.min.toLocaleString() })}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: C.mid, lineHeight: 1.6 }}>
              {next
                ? t('profile.tierDisplay.hintNext')
                : t('profile.tierDisplay.hintMax')}
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: C.gray,
                marginBottom: 6,
                fontFamily: C.font,
              }}
            >
              <span>{t('profile.tierDisplay.current')}</span>
              <span>{next ? tierName(next.name) : t('profile.tierDisplay.max')}</span>
            </div>

            <div
              style={{
                height: 6,
                background: C.border,
                overflow: 'hidden',
                marginBottom: 4,
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '100%',
                  width: `${progress}%`,
                  background: barColor,
                  transition: 'width 0.6s ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 10,
                color: C.mid,
                marginBottom: 20,
              }}
            >
              <span>{t('profile.tierDisplay.ptsValue', { value: points.toLocaleString() })}</span>
              {next && <span>{t('profile.tierDisplay.ptsValue', { value: next.min.toLocaleString() })}</span>}
            </div>

            <button
              onClick={() => {
                window.location.href = '/products';
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                border: 'none',
                background: C.red,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: C.font,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = '#9a2535')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = C.red)
              }
            >
              {t('profile.tierDisplay.claimProductButton')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   REFERRAL PROGRAM — standalone component
   ═══════════════════════════════════════════════════════════ */
const ReferralProgram: React.FC<{ userId: string }> = ({ userId }) => {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiService.get('/store/referrals/code');
        const r = await apiService.get('/store/referrals/stats');
        if (!cancelled && r.data?.success) setData(r.data.data);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const stored = localStorage.getItem('zai_referral_code');
    if (stored && !data?.appliedCode) {
      setReferralInput(stored);
    }
  }, [data]);

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied('code');
    setTimeout(() => setCopied(null), 2000);
  };

  const shareLink = () => {
    if (!data?.code) return;
    const url = `${window.location.origin}/?ref=${data.code}`;
    navigator.clipboard.writeText(url);
    setCopied('link');
    setTimeout(() => setCopied(null), 2000);
  };

  const applyReferral = async () => {
    if (!referralInput.trim()) return;
    setApplying(true);
    setApplyMsg('');
    setApplySuccess(false);
    try {
      const r = await apiService.post('/store/referrals/apply', { code: referralInput.trim() });
      if (r.data?.success) {
        setApplyMsg(t('profile.referral.appliedMessage'));
        setApplySuccess(true);
        localStorage.removeItem('zai_referral_code');
        const s = await apiService.get('/store/referrals/stats');
        if (s.data?.success) setData(s.data.data);
      } else {
        setApplyMsg(r.data?.error || t('profile.referral.invalidCode'));
      }
    } catch (e: any) {
      setApplyMsg(e?.response?.data?.error || t('profile.referral.couldNotApply'));
    } finally { setApplying(false); }
  };

  if (loading) return null;
  if (!data) return null;

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase',
        fontWeight: 600, marginBottom: 8,
      }}>
        {t('profile.referral.heading')}
      </div>
      <p style={{ fontSize: 13, color: C.gray, margin: '0 0 20px', lineHeight: 1.6 }}>
        {t('profile.referral.description')}
      </p>

      <div style={{
        background: C.black, borderRadius: 10,
        padding: 'clamp(18px, 5vw, 32px) clamp(16px, 5vw, 28px)', color: C.white,
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#777', marginBottom: 16,
        }}>
          {t('profile.referral.yourCode')}
        </div>

        <div style={{
          fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 300,
          letterSpacing: '0.25em', textAlign: 'center', marginBottom: 24,
          fontFamily: "'Courier New', monospace",
        }}>
          {data.code}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 0,
          border: '1px solid #333', borderRadius: 6, marginBottom: 20,
        }}>
          {[
            { value: data.referralsSent, label: t('profile.referral.stats.referralsSent') },
            { value: (data.bonusPoints || 0).toLocaleString('de-CH'), label: t('profile.referral.stats.bonusPoints') },
            { value: `CHF ${data.valueUnlockedCHF || 0}`, label: t('profile.referral.stats.valueUnlocked') },
          ].map((s, i) => (
            <div key={i} style={{
              padding: '16px 12px', textAlign: 'center',
              borderRight: i < 2 ? '1px solid #333' : 'none',
            }}>
              <div style={{ fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 300, marginBottom: 4 }}>
                {s.value}
              </div>
              <div style={{
                fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                color: '#777',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={copyCode} style={{
            padding: '10px 20px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            border: '1px solid #555', borderRadius: 4, background: 'transparent',
            color: '#ccc', cursor: 'pointer', fontFamily: C.font,
            transition: 'all 0.2s',
          }}>
            {copied === 'code' ? `✓ ${t('profile.referral.copied')}` : t('profile.referral.copyCode')}
          </button>
          <button onClick={shareLink} style={{
            padding: '10px 20px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            border: '1px solid #555', borderRadius: 4, background: 'transparent',
            color: '#ccc', cursor: 'pointer', fontFamily: C.font,
            transition: 'all 0.2s',
          }}>
            {copied === 'link' ? `✓ ${t('profile.referral.copied')}` : t('profile.referral.shareLink')}
          </button>
        </div>
      </div>

      {!data.appliedCode && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: C.gray, marginBottom: 8, fontFamily: C.font,
          }}>
            {t('profile.referral.haveCode')}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={referralInput}
              onChange={e => setReferralInput(e.target.value.toUpperCase())}
              placeholder={t('profile.referral.placeholder')}
              maxLength={20}
              style={{
                flex: '1 1 180px', minWidth: 0, padding: '10px 12px', border: `1px solid ${C.border}`,
                fontSize: 13, fontFamily: C.font, borderRadius: 4,
                boxSizing: 'border-box' as const, background: '#fff',
              }}
            />
            <button
              onClick={applyReferral}
              disabled={applying || !referralInput.trim()}
              style={{
                padding: '10px 18px', fontSize: 10, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                border: 'none', borderRadius: 4,
                background: C.red, color: '#fff',
                cursor: applying ? 'wait' : 'pointer',
                fontFamily: C.font, whiteSpace: 'nowrap',
                opacity: applying || !referralInput.trim() ? 0.5 : 1,
              }}
            >
              {applying ? t('profile.referral.applying') : t('profile.referral.apply')}
            </button>
          </div>
          {applyMsg && (
            <div style={{
              marginTop: 8, fontSize: 12,
              color: applySuccess ? C.green : C.red,
            }}>
              {applyMsg}
            </div>
          )}
        </div>
      )}

      {data.appliedCode && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 13, color: C.green }}>✓</span>
          <span style={{ fontSize: 12, color: C.gray }}>
            {t('profile.referral.referredByPrefix')} <strong style={{ fontFamily: 'monospace' }}>{data.appliedCode}</strong>
          </span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   PROFILE COMPONENT
   ═══════════════════════════════════════════════════════════ */
const Profile: React.FC = () => {
  const { t } = useTranslation();
  const tierName = (name: string) => t(`profile.tiers.${name.toLowerCase()}`, name);
  const countryLabel = (name: string) => t(`profile.countries.${name}`, name);
  const { user, setUser } = useAppContext();

  /* ── Mobile width tracking (mirrors MainLayout's own breakpoint hook) ── */
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchases'>('overview');
  const [stats, setStats] = useState<UserStats>({ productsClaimed: 0, eventsAttended: 0 });
  const [formData, setFormData] = useState(toFormData(user));

  /* ── Experience Card state ── */
  const [card, setCard] = useState<CardInfo>({
    cardId: '', isActive: false, nfcEnabled: true,
    name: '', image: '', tokenAddress: '',
  });

  /* ── Card number editing ── */
  const [editingCardNum, setEditingCardNum] = useState(false);
  const [cardNumInput, setCardNumInput] = useState('');
  const [savingCardNum, setSavingCardNum] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);
  const [cardNumberStored, setCardNumberStored] = useState('');

  /* ── Rewards state ── */
  const [points, setPoints] = useState(0);
  const [loadingPoints, setLoadingPoints] = useState(true);

  /* ── Avatar upload state ── */
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  /* ── Exclusive check ── */
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'owner';
  const exclusive = card.isActive || isAdmin;

  /* ── NFC support check ── */
  useEffect(() => {
    setNfcSupported('NDEFReader' in window);
  }, []);

  /* ── Load Experience Card data ── */
  useEffect(() => {
    const loadCardFromStorage = () => {
      try {
        const stored = localStorage.getItem('zai_experience_card');
        if (stored && stored !== 'null' && stored !== 'undefined' && stored !== 'true') {
          const ec = JSON.parse(stored);
          setCard({
            cardId: ec.serialNumber || ec.tokenId || '',
            isActive: true,
            nfcEnabled: true,
            name: ec.name || '',
            image: ec.image || '',
            tokenAddress: ec.tokenAddress || '',
          });
        } else if (stored === 'true') {
          setCard(prev => ({ ...prev, isActive: true }));
        }
      } catch { /* silent */ }
    };

    loadCardFromStorage();

    const fetchCard = async () => {
      if (!user?.id) return;
      try {
        const res = await apiService.get(`/products/user/${user.id}`);
        const d = res.data as any;
        const ec = d?.experienceCard;
        if (ec) {
          setCard({
            cardId: ec.serialNumber || ec.tokenId || '',
            isActive: true,
            nfcEnabled: true,
            name: ec.name || '',
            image: ec.image || '',
            tokenAddress: ec.tokenAddress || '',
          });
        }
        if (d?.profile?.card_number) {
          setCardNumberStored(d.profile.card_number);
        }
      } catch { /* silent */ }
    };
    fetchCard();

    const handler = () => loadCardFromStorage();
    window.addEventListener('zai:experience-card-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('zai:experience-card-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [user?.id]);

  /* ── Load rewards balance ── */
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiService.get('/store/rewards/balance');
        if (!cancelled && r.data?.success) {
          // The endpoint returns `balance`; reading `points` silently yielded 0
          // and pinned the widget to the lowest tier.
          setPoints(r.data.data?.balance ?? 0);
        }
      } catch {} finally { if (!cancelled) setLoadingPoints(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Sync user into form + fetch fresh profile ── */
  useEffect(() => {
    let cancelled = false;
    if (user) {
      setFormData(toFormData(user));
    }
    const fetchProfile = async () => {
      try {
        const res = await apiService.get('/users/me');
        const d = (res.data as any)?.data;
        if (d && !cancelled) {
          const { phoneCode, phoneLocal } = parsePhone(clean(d.phoneNumber));
          setFormData(prev => ({
            givenName: clean(d.givenName) || prev.givenName,
            familyName: clean(d.familyName) || prev.familyName,
            email: clean(d.email) || prev.email,
            phoneCode: phoneCode || prev.phoneCode,
            phoneLocal: phoneLocal || prev.phoneLocal,
            address: clean(d.address) || prev.address,
            city: clean(d.city) || prev.city,
            country: clean(d.country) || prev.country,
            postalCode: clean(d.postalCode) || prev.postalCode,
            birthdate: clean(d.birthdate) || prev.birthdate,
            isPublic: d.isPublic === true ? true : prev.isPublic,
          }));
        }
      } catch { /* fall back to context user */ }
    };
    fetchProfile();
    return () => { cancelled = true; };
  }, [user]);

  /* ── Fetch stats ── */
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const [prodRes, evtRes] = await Promise.all([
          apiService.get(`/products/user/${user.id}`).catch(() => ({ data: { success: true, data: [] } })),
          apiService.get('/events').catch(() => ({ data: { success: true, data: [] } })),
        ]);
        if (cancelled) return;
        const prodData = prodRes.data as any;
        const products = prodData?.data || prodData?.products || [];
        const productCount = Array.isArray(products) ? products.length : 0;
        const evtData = evtRes.data as any;
        const events = evtData?.data || evtData?.events || [];
        const eventCount = Array.isArray(events) ? events.filter((e: any) => e.status === 'upcoming').length : 0;
        setStats({ productsClaimed: productCount, eventsAttended: eventCount });
      } catch { /* silent */ }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Handlers ── */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const fullPhone = formData.phoneLocal
        ? `${formData.phoneCode} ${formData.phoneLocal}`.trim()
        : '';

      const res = await apiService.put('/users/me', {
        name: `${formData.givenName} ${formData.familyName}`.trim(),
        givenName: formData.givenName,
        familyName: formData.familyName,
        email: formData.email,
        phoneNumber: fullPhone,
        address: formData.address,
        city: formData.city,
        country: formData.country,
        postalCode: formData.postalCode,
        birthdate: formData.birthdate || null,
        isPublic: formData.isPublic,
        image: user.image || '',
      });
      const data = res.data as any;
      if (data?.success) {
        if (data.jwtToken) {
          localStorage.setItem('token', data.jwtToken);
          localStorage.setItem('zai_token', data.jwtToken);
        }
        const updatedUser: typeof user = {
          ...user,
          givenName: formData.givenName,
          familyName: formData.familyName,
          name: `${formData.givenName} ${formData.familyName}`.trim(),
          email: formData.email,
          phoneNumber: fullPhone,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          postalCode: formData.postalCode,
          birthdate: formData.birthdate,
          isPublic: formData.isPublic,
          ...(data.user || {}),
        };
        setUser(updatedUser);
        localStorage.setItem('zai_user', JSON.stringify(updatedUser));
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert(t('profile.alerts.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (user) {
      setFormData(toFormData(user));
    }
    setIsEditing(false);
  };

  /* ── Avatar upload handler ── */
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/tiff'];

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file || !user?.id) return;

    setAvatarError('');

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError(t('profile.avatar.errors.invalidType'));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError(t('profile.avatar.errors.tooLarge'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setUploadingAvatar(true);
      try {
        const res = await apiService.post('/users/me/avatar', { image: base64 });
        const data = res.data as any;
        if (data?.success) {
          const newImage = data.data?.image || null;
          const updatedUser: typeof user = { ...user, image: newImage };
          setUser(updatedUser);
          localStorage.setItem('zai_user', JSON.stringify(updatedUser));
        } else {
          setAvatarError(data?.error || t('profile.avatar.errors.uploadFailed'));
        }
      } catch (err: any) {
        setAvatarError(err?.response?.data?.error || t('profile.avatar.errors.uploadFailed'));
      } finally {
        setUploadingAvatar(false);
      }
    };
    reader.onerror = () => setAvatarError(t('profile.avatar.errors.readFailed'));
    reader.readAsDataURL(file);
  };

  /* ── Card number handlers ── */
  const saveCardNumber = async () => {
    setSavingCardNum(true);
    try {
      await apiService.put('/products/profile', { card_number: cardNumInput.trim() });
      setCardNumberStored(cardNumInput.trim());
      setEditingCardNum(false);
    } catch (e: any) {
      alert(e?.response?.data?.error || t('profile.alerts.saveCardNumberFailed'));
    } finally { setSavingCardNum(false); }
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
          setCardNumInput(formatted);
          setEditingCardNum(true);
        }
        setNfcReading(false);
      });
      ndef.addEventListener('readingerror', () => {
        setNfcReading(false);
        alert(t('profile.alerts.nfcReadError'));
      });
      setTimeout(() => setNfcReading(false), 30000);
    } catch (err: any) {
      setNfcReading(false);
      if (err.name === 'NotAllowedError') {
        alert(t('profile.alerts.nfcPermissionDenied'));
      } else {
        alert(t('profile.alerts.nfcFailed'));
      }
    }
  };

  /* ── Format helpers ── */
  const formatBirthdate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const memberSince = () => {
    if (!user?.createdAt) return '—';
    const dt = new Date(user.createdAt);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const locationStr = () => {
    const parts: string[] = [];
    if (formData.city) parts.push(formData.city);
    if (formData.country) parts.push(formData.country);
    return parts.join(', ') || null;
  };

  const homeAddress = () => {
    const parts: string[] = [];
    if (formData.address) parts.push(formData.address);
    const cityZip = [formData.postalCode, formData.city].filter(Boolean).join(' ');
    if (cityZip) parts.push(cityZip);
    if (formData.country) parts.push(formData.country);
    return parts.join(', ') || '—';
  };

  const displayPhone = () => {
    if (!formData.phoneLocal && !formData.phoneCode) return '—';
    if (!formData.phoneLocal) return '—';
    return `${formData.phoneCode} ${formData.phoneLocal}`.trim();
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(24px, 6vw, 48px) clamp(16px, 6vw, 48px) clamp(40px, 8vw, 80px)', color: C.gray, fontSize: '14px', fontFamily: C.font }}>
        {t('profile.loading')}
      </div>
    );
  }

  const firstName = clean(formData.givenName) || clean(user.givenName) || t('profile.fallbackName');
  const lastName = clean(formData.familyName) || clean(user.familyName) || '';
  const initials = (firstName[0] || '').toUpperCase();

  const bulletItems: string[] = [];
  const ms = memberSince();
  if (ms !== '—') bulletItems.push(t('profile.bullets.memberSince', { date: ms }));
  const loc = locationStr();
  if (loc) bulletItems.push(loc);
  const nfcCardId = clean((user as any).nfcCardId);
  if (cardNumberStored) bulletItems.push(t('profile.bullets.card', { number: cardNumberStored }));
  else if (nfcCardId) bulletItems.push(t('profile.bullets.nfcCard', { id: nfcCardId }));
  bulletItems.push(t('profile.bullets.regionTag'));

  const selectStyle: React.CSSProperties = {
    width: '100%',
    background: '#fff',
    border: 'none',
    borderBottom: `1px solid ${C.border}`,
    color: C.black,
    fontFamily: C.font,
    fontSize: '13px',
    fontWeight: 400,
    padding: '4px 0',
    outline: 'none',
    cursor: 'pointer',
    boxSizing: 'border-box',
    appearance: 'auto',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 'clamp(24px, 6vw, 48px) clamp(16px, 6vw, 48px) clamp(40px, 8vw, 80px)', fontFamily: C.font }}>

      {/* ═══ HEADER ═══ */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div>
          <div style={{ ...label, color: C.red, marginBottom: '0.4rem', fontSize: '11px' }}>
            {t('profile.header.eyebrow')}
          </div>
          <h1
            style={{
              fontSize: 'clamp(32px, 4vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 0.3rem',
              color: C.black,
            }}
          >
            {t('profile.header.title')}
          </h1>
          <p style={{ color: C.gray, fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            {t('profile.header.subtitle')}
          </p>
        </div>

        <button
          onClick={() => {
            if (isEditing) { handleSave(); } else { setIsEditing(true); }
          }}
          disabled={isLoading}
          style={{
            background: C.black, color: '#fff', border: 'none',
            padding: '14px 28px', fontSize: '10px', letterSpacing: '0.2em',
            textTransform: 'uppercase', cursor: isLoading ? 'wait' : 'pointer',
            fontFamily: C.font, fontWeight: 500, transition: 'background 0.2s',
            whiteSpace: 'nowrap', marginTop: '0.5rem', opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#1a1a1a'; }}
          onMouseLeave={e => (e.currentTarget.style.background = C.black)}
        >
          {isLoading ? t('profile.header.saving') : isEditing ? t('profile.header.saveChanges') : t('profile.header.edit')}
        </button>
      </div>

      {/* ═══ TABS ═══ */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: '2rem' }}>
        {(['overview', 'purchases'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setActiveTab(tabKey)} style={{
            padding: '12px 20px', background: 'none', border: 'none',
            borderBottom: activeTab === tabKey ? `2px solid ${C.black}` : '2px solid transparent',
            fontSize: 12, fontWeight: activeTab === tabKey ? 700 : 500, letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: C.font, color: activeTab === tabKey ? C.black : C.gray,
          }}>
            {tabKey === 'overview' ? t('profile.tabs.overview') : t('profile.tabs.purchaseHistory')}
          </button>
        ))}
      </div>

      {activeTab === 'purchases' && <PurchaseHistorySection />}

      {activeTab === 'overview' && (
      <>
      {/* ═══ MAIN CARD — 2 columns ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '280px 1fr',
          gap: '0px',
          background: C.border,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* ── LEFT SIDEBAR ── */}
        <div
          style={{
            background: C.surface,
            padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 5vw, 2rem)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              position: 'relative', width: '80px', height: '80px',
              marginBottom: '1rem', cursor: uploadingAvatar ? 'wait' : 'pointer',
            }}
            onClick={() => { if (!uploadingAvatar) avatarInputRef.current?.click(); }}
            title={t('profile.avatar.changePhoto')}
          >
            {user?.image ? (
              <UserAvatar firstName={firstName} lastName={lastName} size="lg" imageUrl={user.image} />
            ) : (
              <div
                style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: C.surface2, border: `2px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: 300, color: C.black,
                  letterSpacing: '0.05em',
                }}
              >
                {initials}
              </div>
            )}

            {/* Camera / edit overlay */}
            <div
              style={{
                position: 'absolute', bottom: 0, right: 0,
                width: '26px', height: '26px', borderRadius: '50%',
                background: C.black, border: `2px solid ${C.surface}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {uploadingAvatar ? (
                <div
                  style={{
                    width: '10px', height: '10px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                    animation: 'zai-avatar-spin 0.8s linear infinite',
                  }}
                />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
              style={{ display: 'none' }}
            />
          </div>
          <style>{`@keyframes zai-avatar-spin { to { transform: rotate(360deg); } }`}</style>

          <div style={{ fontSize: '16px', fontWeight: 400, color: C.black, marginBottom: '2px' }}>
            {firstName}
          </div>
          <div style={{ fontSize: '11px', color: C.gray, marginBottom: avatarError ? '0.5rem' : '1.5rem' }}>
            @{firstName.toLowerCase().replace(/\s+/g, '')}
          </div>
          {avatarError && (
            <div style={{ fontSize: '11px', color: C.red, marginBottom: '1.5rem', textAlign: 'center' }}>
              {avatarError}
            </div>
          )}

          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%',
              borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ textAlign: 'center', padding: '1rem 0', borderRight: `1px solid ${C.border}` }}>
              <div style={{ fontSize: '20px', fontWeight: 300, color: C.black }}>{stats.productsClaimed}</div>
              <div style={{ ...label, fontSize: '9px', marginTop: '2px', color: C.gray }}>{t('profile.stats.products')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '20px', fontWeight: 300, color: C.black }}>{exclusive ? stats.eventsAttended : 0}</div>
              <div style={{ ...label, fontSize: '9px', marginTop: '2px', color: C.gray }}>{t('profile.stats.events')}</div>
            </div>
          </div>

          {/* ── Tier badge in sidebar ── */}
          {!loadingPoints && (
            <div style={{
              width: '100%', padding: '12px 0',
              borderBottom: `1px solid ${C.border}`, marginBottom: '1rem',
              textAlign: 'center',
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: getTier(points).color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: getTier(points).name === 'Black' ? '1px solid #555' : 'none',
                }}>
                  <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
                    {String(getTier(points).index + 1).padStart(2, '0')}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>
                  {t('profile.tier.label', { name: tierName(getTier(points).name) })}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                {t('profile.tierDisplay.ptsValue', { value: points.toLocaleString() })}
              </div>
              {getNextTier(points) && (
                <div style={{ marginTop: 8, padding: '0 8px' }}>
                  <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(((points - getTier(points).min) / (getNextTier(points)!.min - getTier(points).min)) * 100, 100)}%`,
                      background: getTier(points).color === '#1a1a1a' ? C.red : getTier(points).color,
                      borderRadius: 2, transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.mid, marginTop: 4 }}>
                    {t('profile.tier.ptsToNext', { count: (getNextTier(points)!.min - points).toLocaleString(), tier: tierName(getNextTier(points)!.name) })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ width: '100%' }}>
            {bulletItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0', fontSize: '12px', color: C.black, fontWeight: 300,
              }}>
                <div style={{ width: '5px', height: '5px', background: C.red, borderRadius: '50%', flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT — PERSONAL INFORMATION + SECTIONS ── */}
        <div style={{ background: '#fff', padding: 'clamp(1.5rem, 5vw, 2.5rem) clamp(1rem, 5vw, 2rem)' }}>

          {/* ── Personal Information ── */}
          <div style={{ ...label, color: C.black, fontSize: '11px', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${C.border}` }}>
            {t('profile.sections.personalInformation')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: C.border, border: `1px solid ${C.border}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: C.border }}>
              <FieldCell label={t('profile.fields.firstName')} name="givenName" value={formData.givenName} editing={isEditing} onChange={handleChange} />
              <FieldCell label={t('profile.fields.familyName')} name="familyName" value={formData.familyName} editing={isEditing} onChange={handleChange} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: C.border }}>
              <FieldCell
                label={t('profile.fields.dateOfBirth')} name="birthdate"
                value={isEditing ? formData.birthdate : formatBirthdate(formData.birthdate)}
                editing={isEditing} type={isEditing ? 'date' : 'text'} onChange={handleChange}
              />
              {isEditing ? (
                <div style={{ background: '#fff', padding: '1rem 1.25rem', minWidth: 0 }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gray, marginBottom: '6px', fontFamily: C.font }}>
                    {t('profile.fields.phoneNumber')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'flex-end' }}>
                    <select name="phoneCode" value={formData.phoneCode} onChange={handleSelectChange}
                      style={{ ...selectStyle, width: 'auto', minWidth: '90px', maxWidth: '100%', flex: '1 1 100px' }}>
                      {PHONE_CODES.map(pc => (<option key={pc.code} value={pc.code}>{pc.label}</option>))}
                    </select>
                    <input type="tel" name="phoneLocal" value={formData.phoneLocal} onChange={handleChange}
                      placeholder={t('profile.fields.phonePlaceholder')}
                      style={{ flex: '2 1 140px', minWidth: 0, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: C.black, fontFamily: C.font, fontSize: '13px', fontWeight: 400, padding: '4px 0', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              ) : (
                <FieldCell label={t('profile.fields.phoneNumber')} name="phoneNumber" value={displayPhone()} editing={false} onChange={() => {}} />
              )}
            </div>

            <FieldCell label={t('profile.fields.emailAddress')} name="email" value={formData.email} editing={isEditing} type="email" onChange={handleChange} />

            {isEditing ? (
              <>
                <FieldCell label={t('profile.fields.streetAddress')} name="address" value={formData.address} editing={true} onChange={handleChange} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1px', background: C.border }}>
                  <FieldCell label={t('profile.fields.postalCode')} name="postalCode" value={formData.postalCode} editing={true} onChange={handleChange} />
                  <FieldCell label={t('profile.fields.city')} name="city" value={formData.city} editing={true} onChange={handleChange} />
                  <div style={{ background: '#fff', padding: '1rem 1.25rem', minWidth: 0 }}>
                    <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gray, marginBottom: '6px', fontFamily: C.font }}>{t('profile.fields.country')}</div>
                    <select name="country" value={formData.country} onChange={handleSelectChange} style={selectStyle}>
                      <option value="">{t('profile.fields.selectCountry')}</option>
                      {COUNTRIES.map(c => (<option key={c} value={c}>{countryLabel(c)}</option>))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <FieldCell label={t('profile.fields.homeAddress')} name="address" value={homeAddress()} editing={false} onChange={() => {}} />
            )}
          </div>

          {isEditing && (
            <div style={{ marginTop: '1.5rem' }}>
              <button onClick={handleCancel} style={{
                background: 'transparent', border: `1px solid ${C.border}`, color: C.black,
                padding: '12px 24px', fontSize: '10px', letterSpacing: '0.2em',
                textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.font, transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >{t('profile.actions.cancel')}</button>
            </div>
          )}

          {/* ═══ REWARDS & TIER SECTION ═══ */}
          {exclusive && (
            <>
              <div style={{ ...label, color: C.black, fontSize: '11px', marginTop: '3rem', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${C.border}` }}>
                {t('profile.sections.rewardsTier')}
              </div>
              {loadingPoints ? (
                <div style={{ padding: '20px 0', fontSize: 13, color: C.gray }}>{t('profile.tierDisplay.loading')}</div>
              ) : (
                <TierDisplay points={points} />
              )}
            </>
          )}

          {/* ═══ EXPERIENCE CARD SECTION ═══ */}
          {exclusive && (
            <>
              <div style={{
                ...label, color: C.black, fontSize: '11px', marginTop: '3rem', marginBottom: '1.5rem',
                paddingBottom: '0.75rem', borderBottom: `1px solid ${C.border}`,
                display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{t('profile.sections.experienceCard')}</span>
                {!editingCardNum && (
                  <button
                    onClick={() => { setCardNumInput(cardNumberStored); setEditingCardNum(true); }}
                    style={{
                      background: 'transparent', border: `1px solid ${C.border}`,
                      color: C.black, padding: '6px 14px', fontSize: '9px',
                      letterSpacing: '0.15em', textTransform: 'uppercase',
                      cursor: 'pointer', fontFamily: C.font, borderRadius: 3,
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                  >
                    {cardNumberStored ? t('profile.experienceCard.editCardNumber') : t('profile.experienceCard.addCardNumber')}
                  </button>
                )}
              </div>

              {/* Card image */}
              <img
                src="/images/experience-card.png"
                alt={t('profile.experienceCard.imageAlt')}
                style={{ width: '100%', maxWidth: 420, height: 'auto', borderRadius: 12, display: 'block', marginBottom: '1.5rem' }}
              />

              {/* Card number editing */}
              {editingCardNum && (
                <div style={{
                  background: C.surface, borderRadius: 8,
                  padding: '16px 18px', border: `1px solid ${C.border}`, marginBottom: '1.5rem',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gray, marginBottom: 8, fontFamily: C.font }}>
                    {t('profile.experienceCard.cardNumberLabel')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <input
                      value={cardNumInput}
                      onChange={e => setCardNumInput(e.target.value.toUpperCase())}
                      placeholder={t('profile.experienceCard.cardNumberPlaceholder')}
                      maxLength={32}
                      style={{
                        flex: '1 1 180px', minWidth: 0, padding: '10px 12px', border: `1px solid ${C.border}`,
                        fontSize: 13, fontFamily: C.font, borderRadius: 4,
                        boxSizing: 'border-box' as const, background: '#fff',
                      }}
                    />
                    {nfcSupported && (
                      <button onClick={startNfcRead} disabled={nfcReading} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 14px', fontSize: 10, fontWeight: 600,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        border: `1px solid ${C.border}`, borderRadius: 4,
                        background: 'transparent', color: C.black,
                        cursor: nfcReading ? 'wait' : 'pointer',
                        fontFamily: C.font, whiteSpace: 'nowrap',
                        opacity: nfcReading ? 0.6 : 1,
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
                          <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                          <path d="M12.91 4.1a16.1 16.1 0 0 1 0 15.8" />
                          <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
                        </svg>
                        {nfcReading ? t('profile.experienceCard.scanning') : t('profile.experienceCard.scanNfc')}
                      </button>
                    )}
                  </div>
                  {nfcReading && (
                    <div style={{ fontSize: 12, color: C.red, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: C.red, animation: 'pulse 1.5s infinite' }} />
                      {t('profile.experienceCard.holdCardHint')}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => { setEditingCardNum(false); setNfcReading(false); }} style={{
                      background: 'transparent', border: `1px solid ${C.border}`, color: C.black,
                      padding: '8px 16px', fontSize: '10px', letterSpacing: '0.15em',
                      textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.font, borderRadius: 3,
                    }}>{t('profile.experienceCard.cancel')}</button>
                    <button onClick={saveCardNumber} disabled={savingCardNum || !cardNumInput.trim()} style={{
                      background: C.red, border: 'none', color: '#fff',
                      padding: '8px 16px', fontSize: '10px', letterSpacing: '0.15em',
                      textTransform: 'uppercase', cursor: savingCardNum ? 'wait' : 'pointer',
                      fontFamily: C.font, borderRadius: 3,
                      opacity: savingCardNum || !cardNumInput.trim() ? 0.5 : 1,
                    }}>{savingCardNum ? t('profile.experienceCard.saving') : t('profile.experienceCard.save')}</button>
                  </div>
                </div>
              )}

              {/* Card number display */}
              {!editingCardNum && cardNumberStored && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: '1.5rem',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: C.gray, textTransform: 'uppercase' }}>{t('profile.experienceCard.cardNumberDisplayLabel')}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, fontFamily: "'Courier New', monospace", letterSpacing: '0.08em', color: C.black }}>
                    {cardNumberStored}
                  </div>
                </div>
              )}

              {/* Card detail rows */}
              <div style={{ display: 'flex', flexDirection: 'column', border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', borderBottom: `1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400 }}>{t('profile.experienceCard.status.title')}</div>
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '3px' }}>{t('profile.experienceCard.status.desc')}</div>
                  </div>
                  <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: card.isActive ? C.green : C.gray, fontWeight: 500 }}>
                    {card.isActive ? t('profile.experienceCard.status.active') : t('profile.experienceCard.status.inactive')}
                  </span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem',
                  borderBottom: card.isActive && card.tokenAddress ? `1px solid ${C.border}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400 }}>{t('profile.experienceCard.nfc.title')}</div>
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '3px' }}>{t('profile.experienceCard.nfc.desc')}</div>
                  </div>
                  <span style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: card.nfcEnabled && card.isActive ? C.green : C.gray, fontWeight: 500 }}>
                    {card.nfcEnabled && card.isActive ? t('profile.experienceCard.nfc.enabled') : t('profile.experienceCard.nfc.disabled')}
                  </span>
                </div>
                {card.isActive && card.tokenAddress && (
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400, marginBottom: '3px' }}>{t('profile.experienceCard.contract')}</div>
                    <div style={{ fontSize: '11px', color: C.gray, fontFamily: 'monospace', wordBreak: 'break-all' }}>{card.tokenAddress}</div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══ REFERRAL PROGRAM ═══ */}
          {exclusive && user?.id && (
            <ReferralProgram userId={user.id} />
          )}

        </div>
      </div>
      </>
      )}

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

/* ═══ Purchase History sub-component ═══ */
interface PurchaseRow {
  id: string;
  source: 'deal' | 'collectible';
  item_id: string;
  item_title: string;
  item_image: string;
  category: string;
  amount_chf: string | number;
  points_used: number;
  points_earned: number;
  created_at: string;
}

const PurchaseHistorySection: React.FC = () => {
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiService.get('/store/purchases')
      .then(res => { if (res.data?.success) setPurchases(res.data.data || []); })
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: C.gray, fontSize: 13, fontFamily: C.font }}>
        {t('profile.purchaseHistory.loading')}
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: C.font }}>
        <div style={{ fontSize: '15px', fontWeight: 300, color: C.black, marginBottom: 4 }}>{t('profile.purchaseHistory.emptyTitle')}</div>
        <p style={{ color: C.gray, fontSize: '12px', margin: 0 }}>{t('profile.purchaseHistory.emptyDesc')}</p>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', marginBottom: '2rem' }}>
      {purchases.map((p, idx) => (
        <div key={p.id} style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: '14px 20px',
          borderBottom: idx < purchases.length - 1 ? `1px solid ${C.border}` : 'none',
          background: '#fff', fontFamily: C.font,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
            background: C.black, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {p.item_image
              ? <img src={p.item_image} alt={p.item_title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <ProductImageFallback size="sm" />}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.red, marginBottom: 3, fontWeight: 600,
            }}>
              {p.source === 'deal' ? t('profile.purchaseHistory.deal') : t('profile.purchaseHistory.collectible')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.black, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {p.item_title || t('profile.purchaseHistory.item')}
            </div>
            <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{fmtDate(p.created_at)}</div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.black }}>
              {parseFloat(p.amount_chf as any) > 0 ? `CHF ${parseFloat(p.amount_chf as any).toFixed(2)}` : t('profile.purchaseHistory.free')}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {p.points_used > 0 && (
                <span style={{ fontSize: 9, color: C.red, background: 'rgba(122,34,46,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                  {t('profile.purchaseHistory.pointsUsed', { count: p.points_used })}
                </span>
              )}
              {p.points_earned > 0 && (
                <span style={{ fontSize: 9, color: C.green, background: 'rgba(42,157,78,0.08)', padding: '2px 6px', borderRadius: 3 }}>
                  {t('profile.purchaseHistory.pointsEarned', { count: p.points_earned })}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ═══ Field Cell sub-component ═══ */
interface FieldCellProps {
  label: string;
  name: string;
  value: string;
  editing: boolean;
  type?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const FieldCell: React.FC<FieldCellProps> = ({ label: lbl, name, value, editing, type = 'text', onChange }) => (
  <div style={{ background: '#fff', padding: '1rem 1.25rem', minWidth: 0, boxSizing: 'border-box' }}>
    <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: C.gray, marginBottom: '6px', fontFamily: C.font }}>
      {lbl}
    </div>
    {editing ? (
      <input type={type} name={name} value={value} onChange={onChange} placeholder="—"
        style={{ width: '100%', maxWidth: '100%', background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, color: C.black, fontFamily: C.font, fontSize: '13px', fontWeight: 400, padding: '4px 0', outline: 'none', boxSizing: 'border-box' }}
      />
    ) : (
      <div style={{ fontSize: '13px', fontWeight: 400, color: C.black, padding: '4px 0', minHeight: '20px', wordBreak: 'break-word' }}>
        {value || '—'}
      </div>
    )}
  </div>
);

export default Profile;
