import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

/* ── Design tokens ── */
const C = {
  black: '#0a0a0a',
  white: '#f5f4f0',
  red: '#c8102e',
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

const Profile: React.FC = () => {
  const { user, setUser } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<UserStats>({ productsClaimed: 0, eventsAttended: 0 });
  const [formData, setFormData] = useState({
    givenName: '',
    familyName: '',
    email: '',
    phoneNumber: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    birthdate: '',
    isPublic: false,
  });

  /* ── Sync user into form ── */
  useEffect(() => {
    if (user) {
      setFormData({
        givenName: user.givenName || '',
        familyName: user.familyName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        city: user.city || '',
        country: user.country || '',
        postalCode: user.postalCode || '',
        birthdate: user.birthdate || '',
        isPublic: user.isPublic || false,
      });
    }
  }, [user]);

  /* ── Fetch fresh profile from DB on mount ── */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiService.get('/users/me');
        const d = (res.data as any)?.data;
        if (d) {
          setFormData({
            givenName: d.givenName || '',
            familyName: d.familyName || '',
            email: d.email || '',
            phoneNumber: d.phoneNumber || '',
            address: d.address || '',
            city: d.city || '',
            country: d.country || '',
            postalCode: d.postalCode || '',
            birthdate: d.birthdate || '',
            isPublic: d.isPublic || false,
          });
        }
      } catch {
        /* fall back to context user */
      }
    };
    fetchProfile();
  }, []);

   /* ── Fetch stats from dedicated endpoint ── */
  useEffect(() => {
    if (!user?.id) return;
    const fetchStats = async () => {
      try {
        // Prefer the dedicated stats endpoint that queries DB tables directly
        const res = await apiService.get('/users/me/stats');
        const s = (res.data as any)?.stats;
        if (s) {
          setStats({
            productsClaimed: s.productsClaimed || 0,
            eventsAttended: s.eventsAttended || 0,
          });
          return;
        }
      } catch {
        /* silent — fall through to fallback */
      }

      // Fallback: try the old approach
      try {
        const [prodRes, evtRes] = await Promise.all([
          apiService.get(`/products/user/${user.id}`).catch(() => ({ data: { products: [] } })),
          apiService.get('/events').catch(() => ({ data: [] })),
        ]);

        const prodData = (prodRes.data as any);
        let productCount = 0;
        if (Array.isArray(prodData?.products)) productCount = prodData.products.length;
        else if (Array.isArray(prodData)) productCount = prodData.length;

        const events = (evtRes.data as any)?.events || evtRes.data || [];
        let eventCount = 0;
        if (Array.isArray(events)) {
          eventCount = events.filter((e: any) => {
            const regs = e.registrations || [];
            return regs.some((r: any) =>
              r.userId === user.id || r.user_id === user.id ||
              r.walletAddress === user.walletAddress || r.wallet === user.walletAddress
            );
          }).length;
        }

        setStats({ productsClaimed: productCount, eventsAttended: eventCount });
      } catch { /* silent */ }
    };
    fetchStats();
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
        // Store the fresh JWT so phone number etc. survive page reload
        if (data.jwtToken) {
          localStorage.setItem('token', data.jwtToken);
          localStorage.setItem('zai_token', data.jwtToken);
        }

        // Build the updated User object and set it directly (not as a callback)
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
      setFormData({
        givenName: user.givenName || '',
        familyName: user.familyName || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        address: user.address || '',
        city: user.city || '',
        country: user.country || '',
        postalCode: user.postalCode || '',
        birthdate: user.birthdate || '',
        isPublic: user.isPublic || false,
      });
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
      <div style={{ padding: '3rem 4rem', color: C.gray, fontSize: '14px', fontFamily: C.font }}>
        Loading profile...
      </div>
    );
  }

  const firstName = formData.givenName || user.givenName || 'User';
  const lastName = formData.familyName || user.familyName || '';
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();

  /* ── Sidebar bullet items ── */
  const bulletItems: string[] = [];
  const ms = memberSince();
  if (ms !== '—') bulletItems.push(`Member since ${ms}`);
  const loc = locationStr();
  if (loc) bulletItems.push(loc);
  if ((user as any).nfcCardId) bulletItems.push(`NFC Card: ${(user as any).nfcCardId}`);
  bulletItems.push('CHF · Alpine region');

  return (
    <div style={{ padding: '3rem 4rem 5rem', fontFamily: C.font }}>

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
              fontSize: 'clamp(24px, 3.5vw, 40px)',
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

        {/* ── Button: "Edit" when not editing, "Save Changes" when editing ── */}
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
          {/* Avatar */}
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

          {/* Name */}
          <div style={{ fontSize: '16px', fontWeight: 400, color: C.black, marginBottom: '2px' }}>
            {firstName} {lastName}
          </div>
          <div style={{ fontSize: '11px', color: C.gray, marginBottom: '1.5rem' }}>
            @{(firstName + '.' + lastName).toLowerCase().replace(/\s+/g, '')}
          </div>

          {/* Stats row */}
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

          {/* Bullet list */}
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

        {/* ── RIGHT — PERSONAL INFORMATION ── */}
        <div style={{ background: '#fff', padding: '2.5rem 2rem' }}>
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

          {/* Form grid with 1px gap borders */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              background: C.border,
              border: `1px solid ${C.border}`,
            }}
          >
            {/* Row 1: First Name | Family Name */}
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

            {/* Row 2: Date of Birth | Phone Number */}
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

            {/* Row 3: Email Address (full width) */}
            <FieldCell
              label="Email Address"
              name="email"
              value={formData.email}
              editing={isEditing}
              type="email"
              onChange={handleChange}
            />

            {/* Row 4: Home Address */}
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

          {/* Cancel button when editing */}
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
