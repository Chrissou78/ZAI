import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

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

/* ── Helper: sanitize Engage values — replace literal "true" with dash ── */
function clean(val: any): string {
  if (val === true || val === 'true') return '';
  if (val === false || val === 'false') return '';
  if (val === null || val === undefined) return '';
  return String(val);
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

/* ── Helper: extract phone code from a stored phone number like "+41 79 123 4567" ── */
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

/* ── Helper to build formData from any user-shaped object ── */
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
   REFERRAL PROGRAM — standalone component
   ═══════════════════════════════════════════════════════════ */
const ReferralProgram: React.FC<{ userId: string }> = ({ userId }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');

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

  /* Pre-fill from localStorage if arrived via ?ref= */
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
    try {
      const r = await apiService.post('/store/referrals/apply', { code: referralInput.trim() });
      if (r.data?.success) {
        setApplyMsg('Referral applied! You'll earn bonus points on your first product claim.');
        localStorage.removeItem('zai_referral_code');
        // Reload stats
        const s = await apiService.get('/store/referrals/stats');
        if (s.data?.success) setData(s.data.data);
      } else {
        setApplyMsg(r.data?.error || 'Invalid referral code.');
      }
    } catch (e: any) {
      setApplyMsg(e?.response?.data?.error || 'Could not apply referral code.');
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
        REFERRAL PROGRAM
      </div>
      <p style={{ fontSize: 13, color: C.gray, margin: '0 0 20px', lineHeight: 1.6 }}>
        Share your code. When friends claim their first zai product, you earn 200 pts and they earn 100.
      </p>

      <div style={{
        background: C.black, borderRadius: 10, padding: '32px 28px', color: C.white,
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
          color: '#777', marginBottom: 16,
        }}>
          YOUR REFERRAL CODE
        </div>

        <div style={{
          fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 300,
          letterSpacing: '0.25em', textAlign: 'center', marginBottom: 24,
          fontFamily: "'Courier New', monospace",
        }}>
          {data.code}
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0,
          border: '1px solid #333', borderRadius: 6, marginBottom: 20,
        }}>
          {[
            { value: data.referralsSent, label: 'REFERRALS SENT' },
            { value: (data.bonusPoints || 0).toLocaleString('de-CH'), label: 'BONUS POINTS' },
            { value: `CHF ${data.valueUnlockedCHF || 0}`, label: 'VALUE UNLOCKED' },
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

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={copyCode} style={{
            padding: '10px 20px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            border: '1px solid #555', borderRadius: 4, background: 'transparent',
            color: '#ccc', cursor: 'pointer', fontFamily: C.font,
            transition: 'all 0.2s',
          }}>
            {copied === 'code' ? '✓ COPIED' : 'COPY CODE'}
          </button>
          <button onClick={shareLink} style={{
            padding: '10px 20px', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            border: '1px solid #555', borderRadius: 4, background: 'transparent',
            color: '#ccc', cursor: 'pointer', fontFamily: C.font,
            transition: 'all 0.2s',
          }}>
            {copied === 'link' ? '✓ COPIED' : 'SHARE LINK'}
          </button>
        </div>
      </div>

      {/* ── Apply someone else's referral code ── */}
      {!data.appliedCode && (
        <div style={{ marginTop: 20 }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: C.gray, marginBottom: 8, fontFamily: C.font,
          }}>
            HAVE A REFERRAL CODE?
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={referralInput}
              onChange={e => setReferralInput(e.target.value.toUpperCase())}
              placeholder="Enter code (e.g. ZAI-XXXX)"
              maxLength={20}
              style={{
                flex: 1, padding: '10px 12px', border: `1px solid ${C.border}`,
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
              {applying ? 'Applying…' : 'Apply'}
            </button>
          </div>
          {applyMsg && (
            <div style={{
              marginTop: 8, fontSize: 12,
              color: applyMsg.includes('applied') || applyMsg.includes('Applied') ? C.green : C.red,
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
            Referred by code <strong style={{ fontFamily: 'monospace' }}>{data.appliedCode}</strong>
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
  const { user, setUser } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
        // Load stored card number from profile if available
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
          setPoints(r.data.data?.points || 0);
        }
      } catch {} finally { if (!cancelled) setLoadingPoints(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  /* ── Sync user into form + fetch fresh profile from DB ── */
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
      alert('Failed to update profile');
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

  /* ── Card number handlers ── */
  const saveCardNumber = async () => {
    setSavingCardNum(true);
    try {
      await apiService.put('/products/profile', { card_number: cardNumInput.trim() });
      setCardNumberStored(cardNumInput.trim());
      setEditingCardNum(false);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Failed to save card number');
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
        alert('Could not read NFC tag. Please try again.');
      });
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
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', color: C.gray, fontSize: '14px', fontFamily: C.font }}>
        Loading profile...
      </div>
    );
  }

  const firstName = clean(formData.givenName) || clean(user.givenName) || 'User';
  const lastName = clean(formData.familyName) || clean(user.familyName) || '';
  const initials = (firstName[0] || '').toUpperCase();

  const bulletItems: string[] = [];
  const ms = memberSince();
  if (ms !== '—') bulletItems.push(`Member since ${ms}`);
  const loc = locationStr();
  if (loc) bulletItems.push(loc);
  if (cardNumberStored) bulletItems.push(`Card: ${cardNumberStored}`);
  else if ((user as any).nfcCardId) bulletItems.push(`NFC Card: ${(user as any).nfcCardId}`);
  bulletItems.push('CHF · Alpine region');

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

  const tier = getTier(points);
  const nextTier = getNextTier(points);
  const progress = nextTier
    ? ((points - tier.min) / (nextTier.min - tier.min)) * 100
    : 100;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: C.font }}>

      {/* ═══ HEADER ═══ */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div>
          <div style={{ ...label, color: C.red, marginBottom: '0.4rem', fontSize: '11px' }}>
            account
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
            Profile
          </h1>
          <p style={{ color: C.gray, fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Manage your personal details and account preferences.
          </p>
        </div>

        <button
          onClick={() => {
            if (isEditing) {
              handleSave();
            } else {
              setIsEditing(true);
            }
          }}
          disabled={isLoading}
          style={{
            background: C.black,
            color: '#fff',
            border: 'none',
            padding: '14px 28px',
            fontSize: '10px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            cursor: isLoading ? 'wait' : 'pointer',
            fontFamily: C.font,
            fontWeight: 500,
            transition: 'background 0.2s',
            whiteSpace: 'nowrap',
            marginTop: '0.5rem',
            opacity: isLoading ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#1a1a1a'; }}
          onMouseLeave={e => (e.currentTarget.style.background = C.black)}
        >
          {isLoading ? 'Saving...' : isEditing ? 'Save Changes' : 'Edit'}
        </button>
      </div>

      {/* ═══ MAIN CARD — 2 columns ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '0px',
          background: C.border,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* ── LEFT SIDEBAR ── */}
        <div
          style={{
            background: C.surface,
            padding: '2.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: C.surface2,
              border: `2px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: 300,
              color: C.black,
              letterSpacing: '0.05em',
              marginBottom: '1rem',
            }}
          >
            {initials}
          </div>

          <div style={{ fontSize: '16px', fontWeight: 400, color: C.black, marginBottom: '2px' }}>
            {firstName}
          </div>
          <div style={{ fontSize: '11px', color: C.gray, marginBottom: '1.5rem' }}>
            @{firstName.toLowerCase().replace(/\s+/g, '')}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              width: '100%',
              borderTop: `1px solid ${C.border}`,
              borderBottom: `1px solid ${C.border}`,
              marginBottom: '1.5rem',
            }}
          >
            <div
              style={{
                textAlign: 'center',
                padding: '1rem 0',
                borderRight: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: '20px', fontWeight: 300, color: C.black }}>
                {stats.productsClaimed}
              </div>
              <div style={{ ...label, fontSize: '9px', marginTop: '2px', color: C.gray }}>
                Products
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{ fontSize: '20px', fontWeight: 300, color: C.black }}>
                {exclusive ? stats.eventsAttended : 0}
              </div>
              <div style={{ ...label, fontSize: '9px', marginTop: '2px', color: C.gray }}>
                Events
              </div>
            </div>
          </div>

          {/* ── Tier badge in sidebar ── */}
          {!loadingPoints && (
            <div style={{
              width: '100%',
              padding: '12px 0',
              borderBottom: `1px solid ${C.border}`,
              marginBottom: '1rem',
              textAlign: 'center',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: tier.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
                    {tier.name[0]}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.black }}>
                  {tier.name} Tier
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>
                {points.toLocaleString()} pts
              </div>
              {/* Mini progress bar */}
              {nextTier && (
                <div style={{ marginTop: 8, padding: '0 8px' }}>
                  <div style={{
                    height: 3, background: C.border, borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%', width: `${Math.min(progress, 100)}%`,
                      background: tier.color, borderRadius: 2,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: 9, color: C.mid, marginTop: 4 }}>
                    {(nextTier.min - points).toLocaleString()} pts to {nextTier.name}
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ width: '100%' }}>
            {bulletItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 0',
                  fontSize: '12px',
                  color: C.black,
                  fontWeight: 300,
                }}
              >
                <div
                  style={{
                    width: '5px',
                    height: '5px',
                    background: C.red,
                    borderRadius: '50%',
                    flexShrink: 0,
                  }}
                />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT — PERSONAL INFORMATION + EXPERIENCE CARD ── */}
        <div style={{ background: '#fff', padding: '2.5rem 2rem' }}>

          {/* ── Personal Information ── */}
          <div
            style={{
              ...label,
              color: C.black,
              fontSize: '11px',
              marginBottom: '1.5rem',
              paddingBottom: '0.75rem',
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            Personal Information
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: C.border,
              border: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1px',
                background: C.border,
              }}
            >
              <FieldCell
                label="First Name"
                name="givenName"
                value={formData.givenName}
                editing={isEditing}
                onChange={handleChange}
              />
              <FieldCell
                label="Family Name"
                name="familyName"
                value={formData.familyName}
                editing={isEditing}
                onChange={handleChange}
              />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1px',
                background: C.border,
              }}
            >
              <FieldCell
                label="Date of Birth"
                name="birthdate"
                value={isEditing ? formData.birthdate : formatBirthdate(formData.birthdate)}
                editing={isEditing}
                type={isEditing ? 'date' : 'text'}
                onChange={handleChange}
              />

              {isEditing ? (
                <div style={{ background: '#fff', padding: '1rem 1.25rem' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.25em',
                      textTransform: 'uppercase',
                      color: C.gray,
                      marginBottom: '6px',
                      fontFamily: C.font,
                    }}
                  >
                    Phone Number
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                    <select
                      name="phoneCode"
                      value={formData.phoneCode}
                      onChange={handleSelectChange}
                      style={{
                        ...selectStyle,
                        width: '115px',
                        flexShrink: 0,
                      }}
                    >
                      {PHONE_CODES.map(pc => (
                        <option key={pc.code} value={pc.code}>{pc.label}</option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      name="phoneLocal"
                      value={formData.phoneLocal}
                      onChange={handleChange}
                      placeholder="79 123 4567"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: `1px solid ${C.border}`,
                        color: C.black,
                        fontFamily: C.font,
                        fontSize: '13px',
                        fontWeight: 400,
                        padding: '4px 0',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <FieldCell
                  label="Phone Number"
                  name="phoneNumber"
                  value={displayPhone()}
                  editing={false}
                  onChange={() => {}}
                />
              )}
            </div>

            <FieldCell
              label="Email Address"
              name="email"
              value={formData.email}
              editing={isEditing}
              type="email"
              onChange={handleChange}
            />

            {isEditing ? (
              <>
                <FieldCell
                  label="Street Address"
                  name="address"
                  value={formData.address}
                  editing={true}
                  onChange={handleChange}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '1px',
                    background: C.border,
                  }}
                >
                  <FieldCell
                    label="Postal Code"
                    name="postalCode"
                    value={formData.postalCode}
                    editing={true}
                    onChange={handleChange}
                  />
                  <FieldCell
                    label="City"
                    name="city"
                    value={formData.city}
                    editing={true}
                    onChange={handleChange}
                  />

                  <div style={{ background: '#fff', padding: '1rem 1.25rem' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        color: C.gray,
                        marginBottom: '6px',
                        fontFamily: C.font,
                      }}
                    >
                      Country
                    </div>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleSelectChange}
                      style={selectStyle}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            ) : (
              <FieldCell
                label="Home Address"
                name="address"
                value={homeAddress()}
                editing={false}
                onChange={() => {}}
              />
            )}
          </div>

          {isEditing && (
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={handleCancel}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.black,
                  padding: '12px 24px',
                  fontSize: '10px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: C.font,
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
              >
                Cancel
              </button>
            </div>
          )}

          {/* ═══ REWARDS & TIER SECTION ═══ */}
          {exclusive && (
            <>
              <div
                style={{
                  ...label,
                  color: C.black,
                  fontSize: '11px',
                  marginTop: '3rem',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                Rewards & Tier
              </div>

              {loadingPoints ? (
                <div style={{ padding: '20px 0', fontSize: 13, color: C.gray }}>Loading…</div>
              ) : (
                <div>
                  {/* Tier + points row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      background: tier.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 16, color: '#fff', fontWeight: 700 }}>
                        {tier.name[0]}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 500, color: C.black }}>
                        {tier.name} Tier
                      </div>
                      <div style={{ fontSize: 12, color: C.gray }}>
                        {points.toLocaleString()} points
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {nextTier && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        fontSize: 10, color: C.gray, marginBottom: 5,
                      }}>
                        <span>{tier.name}</span>
                        <span>{(nextTier.min - points).toLocaleString()} pts to {nextTier.name}</span>
                      </div>
                      <div style={{
                        height: 5, background: C.border, borderRadius: 3, overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${Math.min(progress, 100)}%`,
                          background: tier.color, borderRadius: 3,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  )}
                  {!nextTier && (
                    <div style={{
                      padding: '10px 14px', background: C.surface,
                      border: `1px solid ${C.border}`, borderRadius: 6,
                      fontSize: 12, color: C.gray, marginBottom: 16,
                    }}>
                      You've reached the highest tier.
                    </div>
                  )}

                  {/* All 4 tiers mini-grid */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '1px', background: C.border, border: `1px solid ${C.border}`,
                  }}>
                    {TIERS.map(t => {
                      const active = tier.name === t.name;
                      return (
                        <div key={t.name} style={{
                          background: active ? C.surface : '#fff',
                          padding: '14px 12px', textAlign: 'center',
                          position: 'relative',
                        }}>
                          {active && (
                            <div style={{
                              position: 'absolute', top: 0, left: 0, right: 0,
                              height: 3, background: t.color,
                            }} />
                          )}
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            background: t.color, margin: '0 auto 6px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: active ? 1 : 0.35,
                          }}>
                            <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>
                              {t.name[0]}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 11, fontWeight: active ? 700 : 400,
                            color: active ? C.black : C.gray,
                          }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: 9, color: C.mid, marginTop: 2 }}>
                            {t.min === 0 ? 'Start' : `${t.min.toLocaleString()}+`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══ EXPERIENCE CARD SECTION — exclusive members & admins only ═══ */}
          {exclusive && (
            <>
              <div
                style={{
                  ...label,
                  color: C.black,
                  fontSize: '11px',
                  marginTop: '3rem',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: `1px solid ${C.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Experience Card</span>
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
                    {cardNumberStored ? 'Edit Card #' : 'Add Card #'}
                  </button>
                )}
              </div>

              {/* Card image — same as dashboard */}
              <img
                src="/images/experience-card.png"
                alt="zai Experience Card"
                style={{
                  width: '100%',
                  maxWidth: 420,
                  height: 'auto',
                  borderRadius: 12,
                  display: 'block',
                  marginBottom: '1.5rem',
                }}
              />

              {/* ── Card number editing ── */}
              {editingCardNum && (
                <div style={{
                  background: C.surface, borderRadius: 8,
                  padding: '16px 18px', border: `1px solid ${C.border}`,
                  marginBottom: '1.5rem',
                }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase',
                    color: C.gray, marginBottom: 8, fontFamily: C.font,
                  }}>
                    CARD NUMBER
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                    <input
                      value={cardNumInput}
                      onChange={e => setCardNumInput(e.target.value.toUpperCase())}
                      placeholder="Enter card number or scan via NFC"
                      maxLength={32}
                      style={{
                        flex: 1, padding: '10px 12px',
                        border: `1px solid ${C.border}`, fontSize: 13,
                        fontFamily: C.font, borderRadius: 4,
                        boxSizing: 'border-box' as const, background: '#fff',
                      }}
                    />
                    {nfcSupported && (
                      <button
                        onClick={startNfcRead}
                        disabled={nfcReading}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '10px 14px', fontSize: 10, fontWeight: 600,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                          border: `1px solid ${C.border}`, borderRadius: 4,
                          background: 'transparent', color: C.black,
                          cursor: nfcReading ? 'wait' : 'pointer',
                          fontFamily: C.font, whiteSpace: 'nowrap',
                          opacity: nfcReading ? 0.6 : 1,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <div style={{
                      fontSize: 12, color: C.red, marginBottom: 10,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        display: 'inline-block', width: 8, height: 8,
                        borderRadius: '50%', background: C.red,
                        animation: 'pulse 1.5s infinite',
                      }} />
                      Hold your card near the device…
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => { setEditingCardNum(false); setNfcReading(false); }}
                      style={{
                        background: 'transparent', border: `1px solid ${C.border}`,
                        color: C.black, padding: '8px 16px', fontSize: '10px',
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        cursor: 'pointer', fontFamily: C.font, borderRadius: 3,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveCardNumber}
                      disabled={savingCardNum || !cardNumInput.trim()}
                      style={{
                        background: C.red, border: 'none', color: '#fff',
                        padding: '8px 16px', fontSize: '10px',
                        letterSpacing: '0.15em', textTransform: 'uppercase',
                        cursor: savingCardNum ? 'wait' : 'pointer',
                        fontFamily: C.font, borderRadius: 3,
                        opacity: savingCardNum || !cardNumInput.trim() ? 0.5 : 1,
                      }}
                    >
                      {savingCardNum ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Card number display (when not editing) */}
              {!editingCardNum && cardNumberStored && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: C.surface,
                  border: `1px solid ${C.border}`, borderRadius: 6,
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ fontSize: 10, letterSpacing: '0.15em', color: C.gray, textTransform: 'uppercase' }}>
                    Card #
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 500, fontFamily: "'Courier New', monospace",
                    letterSpacing: '0.08em', color: C.black,
                  }}>
                    {cardNumberStored}
                  </div>
                </div>
              )}

              {/* Card detail rows */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                border: `1px solid ${C.border}`,
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1.25rem', borderBottom: `1px solid ${C.border}`,
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400 }}>Status</div>
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '3px' }}>NFC Experience Card</div>
                  </div>
                  <span style={{
                    fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: card.isActive ? C.green : C.gray, fontWeight: 500,
                  }}>
                    {card.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '1.25rem',
                  borderBottom: card.isActive && card.tokenAddress ? `1px solid ${C.border}` : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400 }}>NFC</div>
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '3px' }}>Contactless product claim and access</div>
                  </div>
                  <span style={{
                    fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: card.nfcEnabled && card.isActive ? C.green : C.gray, fontWeight: 500,
                  }}>
                    {card.nfcEnabled && card.isActive ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {card.isActive && card.tokenAddress && (
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ fontSize: '13px', color: C.black, fontWeight: 400, marginBottom: '3px' }}>
                      Contract
                    </div>
                    <div style={{
                      fontSize: '11px', color: C.gray, fontFamily: 'monospace',
                      wordBreak: 'break-all',
                    }}>
                      {card.tokenAddress}
                    </div>
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
  <div style={{ background: '#fff', padding: '1rem 1.25rem' }}>
    <div
      style={{
        fontSize: '10px',
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: C.gray,
        marginBottom: '6px',
        fontFamily: C.font,
      }}
    >
      {lbl}
    </div>
    {editing ? (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder="—"
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${C.border}`,
          color: C.black,
          fontFamily: C.font,
          fontSize: '13px',
          fontWeight: 400,
          padding: '4px 0',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    ) : (
      <div
        style={{
          fontSize: '13px',
          fontWeight: 400,
          color: C.black,
          padding: '4px 0',
          minHeight: '20px',
        }}
      >
        {value || '—'}
      </div>
    )}
  </div>
);

export default Profile;
