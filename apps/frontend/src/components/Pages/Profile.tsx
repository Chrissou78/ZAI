import React, { useState, useEffect } from 'react';
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

/* ── Helper to build formData from any user-shaped object ── */
const toFormData = (src: any) => ({
  givenName: src?.givenName || '',
  familyName: src?.familyName || '',
  email: src?.email || '',
  phoneNumber: src?.phoneNumber || '',
  address: src?.address || '',
  city: src?.city || '',
  country: src?.country || '',
  postalCode: src?.postalCode || '',
  birthdate: src?.birthdate || '',
  isPublic: src?.isPublic || false,
});

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

  /* ── Exclusive check ── */
  const isAdmin = (user as any)?.role === 'admin' || (user as any)?.role === 'owner';
  const exclusive = card.isActive || isAdmin;

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
        const ec = (res.data as any)?.experienceCard;
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
          setFormData(prev => ({
            givenName: d.givenName || prev.givenName,
            familyName: d.familyName || prev.familyName,
            email: d.email || prev.email,
            phoneNumber: d.phoneNumber || prev.phoneNumber,
            address: d.address || prev.address,
            city: d.city || prev.city,
            country: d.country || prev.country,
            postalCode: d.postalCode || prev.postalCode,
            birthdate: d.birthdate || prev.birthdate,
            isPublic: d.isPublic ?? prev.isPublic,
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

  const handleSave = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const res = await apiService.put('/users/me', {
        name: `${formData.givenName} ${formData.familyName}`.trim(),
        givenName: formData.givenName,
        familyName: formData.familyName,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
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
          phoneNumber: formData.phoneNumber,
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
    return parts.join(', ') || '—';
  };

  if (!user) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', color: C.gray, fontSize: '14px', fontFamily: C.font }}>
        Loading profile...
      </div>
    );
  }

  const firstName = formData.givenName || user.givenName || 'User';
  const lastName = formData.familyName || user.familyName || '';
  const initials = (firstName[0] || '').toUpperCase();
  /* ── Sidebar bullet items ── */
  const bulletItems: string[] = [];
  const ms = memberSince();
  if (ms !== '—') bulletItems.push(`Member since ${ms}`);
  const loc = locationStr();
  if (loc) bulletItems.push(loc);
  if ((user as any).nfcCardId) bulletItems.push(`NFC Card: ${(user as any).nfcCardId}`);
  bulletItems.push('CHF · Alpine region');

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
                {stats.eventsAttended}
              </div>
              <div style={{ ...label, fontSize: '9px', marginTop: '2px', color: C.gray }}>
                Events
              </div>
            </div>
          </div>

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
              <FieldCell
                label="Phone Number"
                name="phoneNumber"
                value={formData.phoneNumber}
                editing={isEditing}
                type="tel"
                onChange={handleChange}
              />
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
                  <FieldCell
                    label="Country"
                    name="country"
                    value={formData.country}
                    editing={true}
                    onChange={handleChange}
                  />
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
                }}
              >
                Experience Card
              </div>

              {/* Card visual */}
              <div
                style={{
                  background: C.black,
                  borderRadius: '12px',
                  padding: '2rem 2rem 1.75rem',
                  marginBottom: '1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative gradient */}
                <div style={{
                  position: 'absolute', top: 0, right: 0, width: '50%', height: '100%',
                  background: 'linear-gradient(135deg, transparent 30%, rgba(201,168,76,0.06) 100%)',
                  pointerEvents: 'none',
                }} />
                {/* Chip icon */}
                <div
                  style={{
                    width: '36px',
                    height: '28px',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    marginBottom: '1.25rem',
                  }}
                />
                <div style={{
                  fontSize: '16px',
                  fontWeight: 400,
                  color: '#fff',
                  letterSpacing: '0.2em',
                  fontFamily: "'Courier New', monospace",
                }}>
                  {card.cardId
                    ? `ZAI-${card.cardId.slice(0, 4)} ···· ${card.cardId.slice(-4)}`
                    : 'ZAI-2024 ···· 0000'
                  }
                </div>
                <div style={{
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: card.isActive ? '#2a9d4e' : C.gray,
                  marginTop: '6px',
                }}>
                  {card.isActive ? '● Active' : '● Not claimed'}
                </div>
                {card.isActive && card.name && (
                  <div style={{
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    color: 'rgba(255,255,255,0.5)',
                    marginTop: '12px',
                    textTransform: 'uppercase',
                  }}>
                    {card.name}
                  </div>
                )}
              </div>

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
                    color: card.isActive ? '#2a9d4e' : C.gray, fontWeight: 500,
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
                    color: card.nfcEnabled && card.isActive ? '#2a9d4e' : C.gray, fontWeight: 500,
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

        </div>
      </div>
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
