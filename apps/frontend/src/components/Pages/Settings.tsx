import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
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

type Panel = 'notifications' | 'card' | 'privacy' | 'region' | 'security';

/* ── Interfaces ── */
interface SecuritySettings {
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'authenticator' | 'email';
  lastPasswordChange: string | null;
  sessions: SessionInfo[];
}
interface SessionInfo {
  id: string;
  device: string;
  browser: string;
  ipAddress: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}
interface NotificationSettings {
  eventInvitations: boolean;
  membershipUpdates: boolean;
  productLaunches: boolean;
  partnerOffers: boolean;
  pushProductUpdates: boolean;
  pushEventReminders: boolean;
}
interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  profileVisibility: boolean;
  communityVisibility: boolean;
}
interface CardSettings {
  cardId: string;
  isActive: boolean;
  nfcEnabled: boolean;
  autoLogin: boolean;
}
interface RegionSettings {
  country: string;
  countryCode: string;
  currency: string;
  language: string;
}

/* ── Country flags ── */
const FLAG_MAP: Record<string, string> = {
  CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷', AT: '🇦🇹', IT: '🇮🇹', US: '🇺🇸', GB: '🇬🇧',
};

const LANG_MAP: Record<string, string> = {
  en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano',
};

const COUNTRY_MAP: Record<string, string> = {
  CH: 'Switzerland', DE: 'Germany', FR: 'France', AT: 'Austria', IT: 'Italy', US: 'United States', GB: 'United Kingdom',
};

const Settings: React.FC = () => {
  const { user } = useAppContext();
  const { logout } = useWalletAuth();

  const [activePanel, setActivePanel] = useState<Panel>('notifications');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /* ── State ── */
  const [notifications, setNotifications] = useState<NotificationSettings>({
    eventInvitations: true,
    membershipUpdates: true,
    productLaunches: false,
    partnerOffers: false,
    pushProductUpdates: true,
    pushEventReminders: true,
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    dataSharing: false, analytics: true,
    profileVisibility: true, communityVisibility: true,
  });
  const [card, setCard] = useState<CardSettings>({
    cardId: '', isActive: false, nfcEnabled: true, autoLogin: true,
  });
  const [region, setRegion] = useState<RegionSettings>({
    country: 'Switzerland', countryCode: 'CH', currency: 'CHF', language: 'en',
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false, twoFactorMethod: 'none',
    lastPasswordChange: null, sessions: [],
  });

  /* ── Modal state ── */
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);

  /* ── Password form ── */
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  /* ── 2FA state ── */
  const [tfaStep, setTfaStep] = useState<'choose' | 'scan' | 'verify' | 'success'>('choose');
  const [tfaMethod, setTfaMethod] = useState<'authenticator' | 'email'>('authenticator');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaQrUrl, setTfaQrUrl] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaError, setTfaError] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  /* ── Disable 2FA ── */
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  /* ── Sessions ── */
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionInfo[]>([]);

  useEffect(() => {
    const loadCardFromStorage = () => {
      try {
        const stored = localStorage.getItem('zai_experience_card');
        if (stored) {
          const ec = JSON.parse(stored);
          setCard(prev => ({
            ...prev,
            cardId: ec.serialNumber || ec.tokenId || '',
            isActive: true,
            nfcEnabled: true,
          }));
        }
      } catch { /* silent */ }
    };

    // Load from localStorage first (instant)
    loadCardFromStorage();

    // Then fetch fresh data from API
    const fetchCard = async () => {
      if (!user?.id) return;
      try {
        const res = await apiService.get(`/products/user/${user.id}`);
        const ec = (res.data as any)?.experienceCard;
        if (ec) {
          setCard(prev => ({
            ...prev,
            cardId: ec.serialNumber || ec.tokenId || '',
            isActive: true,
            nfcEnabled: true,
          }));
          localStorage.setItem('zai_experience_card', JSON.stringify(ec));
        }
      } catch { /* silent */ }
    };
    fetchCard();

    // Listen for updates from Products page
    const handler = () => loadCardFromStorage();
    window.addEventListener('zai:experience-card-updated', handler);
    return () => window.removeEventListener('zai:experience-card-updated', handler);
  }, [user?.id]);
  
  /* ── Fetch settings ── */
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await apiService.get('/users/me/settings');
        const p = res.data as any;
        if (p.settings) {
          if (p.settings.notifications) setNotifications(prev => ({ ...prev, ...p.settings.notifications }));
          if (p.settings.privacy) setPrivacy(prev => ({ ...prev, ...p.settings.privacy }));
          if (p.settings.card) setCard(prev => ({ ...prev, ...p.settings.card }));
          if (p.settings.region) setRegion(prev => ({ ...prev, ...p.settings.region }));
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) setError('Failed to load settings');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activePanel === 'security') fetchSecurityInfo();
  }, [activePanel]);

  const fetchSecurityInfo = async () => {
    try {
      const res = await apiService.get('/users/me/security');
      const p = res.data as any;
      if (p.security) {
        setSecurity({
          twoFactorEnabled: p.security.twoFactorEnabled,
          twoFactorMethod: p.security.twoFactorMethod,
          lastPasswordChange: p.security.lastPasswordChange,
          sessions: p.sessions || [],
        });
      }
    } catch { /* silent */ }
  };

  const saveSettings = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await apiService.put('/users/me/settings', { notifications, privacy, card, region });
      const p = res.data as any;
      if (p.token) localStorage.setItem('token', p.token);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch { setError('Failed to save settings'); }
    setSaving(false);
  };

  /* ── Toggle helpers ── */
  const toggleNotif = (key: keyof NotificationSettings) =>
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  const togglePrivacy = (key: keyof PrivacySettings) =>
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleCard = (key: 'nfcEnabled' | 'autoLogin') =>
    setCard(prev => ({ ...prev, [key]: !prev[key] }));

  /* ── Password change ── */
  const handlePasswordChange = async () => {
    setPasswordError('');
    if (passwordForm.newPass.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    if (passwordForm.newPass !== passwordForm.confirm) { setPasswordError('Passwords do not match'); return; }
    setPasswordSaving(true);
    try {
      await apiService.post('/users/me/change-password', {
        currentPassword: passwordForm.current, newPassword: passwordForm.newPass,
      });
      setShowPasswordModal(false);
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      setSuccess('Password updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      fetchSecurityInfo();
    } catch (err: any) {
      setPasswordError(err?.response?.data?.error || 'Failed to change password');
    }
    setPasswordSaving(false);
  };

  /* ── 2FA ── */
  const handleSetup2FA = async () => {
    setTfaLoading(true); setTfaError('');
    try {
      const res = await apiService.post('/users/me/2fa/setup', { method: tfaMethod });
      const p = res.data as any;
      setTfaSecret(p.secret); setTfaQrUrl(p.qrCodeUrl); setTfaStep('scan');
    } catch (err: any) { setTfaError(err?.response?.data?.error || 'Failed to setup 2FA'); }
    setTfaLoading(false);
  };

  const handleVerify2FA = async () => {
    if (tfaCode.length !== 6) { setTfaError('Please enter the 6-digit code'); return; }
    setTfaLoading(true); setTfaError('');
    try {
      await apiService.post('/users/me/2fa/verify', { code: tfaCode });
      setTfaStep('success'); fetchSecurityInfo();
    } catch (err: any) { setTfaError(err?.response?.data?.error || 'Invalid verification code'); }
    setTfaLoading(false);
  };

  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) { setDisableError('Please enter your current 6-digit code'); return; }
    setDisableLoading(true); setDisableError('');
    try {
      await apiService.post('/users/me/2fa/disable', { code: disableCode });
      setShowDisable2FAModal(false); setDisableCode('');
      setSuccess('Two-factor authentication disabled');
      setTimeout(() => setSuccess(''), 3000); fetchSecurityInfo();
    } catch (err: any) { setDisableError(err?.response?.data?.error || 'Failed to disable 2FA'); }
    setDisableLoading(false);
  };

  /* ── Sessions ── */
  const openSessionsModal = async () => {
    setShowSessionsModal(true); setSessionsLoading(true);
    try {
      const res = await apiService.get('/users/me/sessions');
      setSessionsList((res.data as any)?.sessions || []);
    } catch { setSessionsList([]); }
    setSessionsLoading(false);
  };

  const revokeSession = async (id: string) => {
    try {
      await apiService.post('/users/me/sessions/revoke', { sessionId: id });
      setSessionsList(prev => prev.filter(s => s.id !== id));
    } catch { /* silent */ }
  };

  const revokeAllOther = async () => {
    try {
      await apiService.post('/users/me/sessions/revoke-all', {});
      setSessionsList(prev => prev.filter(s => s.isCurrent));
    } catch { /* silent */ }
  };

  /* ── Logout ── */
  const handleLogout = async () => {
    try { await logout(); } catch { localStorage.removeItem('token'); window.location.href = '/'; }
  };

  /* ── Last password text ── */
  const lastPasswordText = () => {
    if (!security.lastPasswordChange) return 'Never changed';
    const d = new Date(security.lastPasswordChange);
    const now = new Date();
    const months = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return 'Last updated recently';
    return `Last updated ${months} month${months > 1 ? 's' : ''} ago`;
  };

  const sessionCount = security.sessions?.length || 0;

  /* ══════════════════════════════════════════════════════════
     REUSABLE SUB-COMPONENTS
  ══════════════════════════════════════════════════════════ */

  /* ── Toggle switch (red when ON) ── */
  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div
      onClick={onChange}
      style={{
        width: 42, height: 22, borderRadius: 11, cursor: 'pointer',
        background: checked ? C.red : '#ccc',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 9,
        background: '#fff', position: 'absolute', top: 2,
        left: checked ? 22 : 2, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </div>
  );

  /* ── Setting row ── */
  const Row = ({
    title, desc, right, noBorder,
  }: { title: string; desc?: string; right: React.ReactNode; noBorder?: boolean }) => (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 0',
        borderBottom: noBorder ? 'none' : `1px solid ${C.border}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: C.black, fontWeight: 400 }}>{title}</div>
        {desc && <div style={{ fontSize: '11px', color: C.gray, marginTop: '3px' }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: '1.5rem' }}>{right}</div>
    </div>
  );

  /* ── Section heading inside panels ── */
  const SectionHead = ({ text }: { text: string }) => (
    <div
      style={{
        fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase',
        color: C.black, fontWeight: 500, marginBottom: '0.25rem',
        fontFamily: C.font,
      }}
    >
      {text}
    </div>
  );

  /* ── Text link button ── */
  const TextLink = ({ text, onClick }: { text: string; onClick: () => void }) => (
    <span
      onClick={onClick}
      style={{
        fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
        color: C.gray, cursor: 'pointer', fontWeight: 500, fontFamily: C.font,
        transition: 'color 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.color = C.black)}
      onMouseLeave={e => (e.currentTarget.style.color = C.gray)}
    >
      {text}
    </span>
  );

  /* ── Shared modal styles ── */
  const overlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(10,10,10,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  };
  const mBox: React.CSSProperties = {
    background: '#fff', padding: '2.5rem', maxWidth: 480, width: '90%',
    border: `1px solid ${C.border}`,
  };
  const mTitle: React.CSSProperties = {
    fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
    color: C.black, marginBottom: '1.5rem', paddingBottom: '0.75rem',
    borderBottom: `1px solid ${C.border}`, fontFamily: C.font,
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
    fontSize: '13px', marginBottom: '1rem', boxSizing: 'border-box',
    outline: 'none', fontFamily: C.font,
  };
  const btnP: React.CSSProperties = {
    background: C.burgundy, color: '#fff', border: 'none', padding: '13px 28px',
    fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: C.font, transition: 'background 0.2s',
  };
  const btnO: React.CSSProperties = {
    background: 'transparent', color: C.black, border: `1px solid ${C.border}`,
    padding: '13px 28px', fontSize: '11px', letterSpacing: '0.15em',
    textTransform: 'uppercase', cursor: 'pointer', fontFamily: C.font,
    transition: 'all 0.2s',
  };
  const btnD: React.CSSProperties = {
    background: C.red, color: '#fff', border: 'none', padding: '13px 28px',
    fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: C.font,
  };

  /* ── Nav labels (no emoji icons — matches screenshots) ── */
  const panels: { key: Panel; label: string }[] = [
    { key: 'notifications', label: 'Notifications' },
    { key: 'card', label: 'Experience Card' },
    { key: 'privacy', label: 'Privacy' },
    { key: 'region', label: 'Region & Currency' },
    { key: 'security', label: 'Security' },
  ];

  if (loading) {
    return (
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', textAlign: 'center', fontFamily: C.font }}>
        <div style={{ fontSize: '14px', color: C.gray }}>Loading settings...</div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px', fontFamily: C.font }}>

      {/* ═══ PAGE HEADER ═══ */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div
          style={{
            fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
            color: C.red, marginBottom: '0.4rem',
          }}
        >
          account
        </div>
        <h1
          style={{
            fontSize: 'clamp(32px, 4vw, 40px)', fontWeight: 300, lineHeight: 1.15,
            margin: '0 0 0.3rem', color: C.black,
          }}
        >
          Settings
        </h1>
        <p style={{ color: C.gray, fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>
          Manage notifications, privacy, and account preferences.
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div style={{
          padding: '12px 16px', background: 'rgba(200,16,46,0.06)',
          border: '1px solid rgba(200,16,46,0.15)', marginBottom: '1.5rem',
          fontSize: '13px', color: C.red,
        }}>{error}</div>
      )}
      {success && (
        <div style={{
          padding: '12px 16px', background: 'rgba(42,157,78,0.06)',
          border: '1px solid rgba(42,157,78,0.15)', marginBottom: '1.5rem',
          fontSize: '13px', color: '#2a9d4e',
        }}>{success}</div>
      )}

      {/* ═══ MAIN CARD — 2 columns ═══ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '1px',
          background: C.border,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* ── LEFT NAV ── */}
        <div style={{ background: C.surface, padding: '1.5rem 0' }}>
          {panels.map(p => (
            <div
              key={p.key}
              onClick={() => setActivePanel(p.key)}
              style={{
                padding: '12px 1.5rem',
                cursor: 'pointer',
                fontSize: '13px',
                color: activePanel === p.key ? C.red : C.black,
                fontWeight: activePanel === p.key ? 500 : 400,
                borderLeft: activePanel === p.key
                  ? `3px solid ${C.red}`
                  : '3px solid transparent',
                background: activePanel === p.key
                  ? 'rgba(200,16,46,0.04)'
                  : 'transparent',
                transition: 'all 0.15s',
                fontFamily: C.font,
              }}
              onMouseEnter={e => {
                if (activePanel !== p.key) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
              }}
              onMouseLeave={e => {
                if (activePanel !== p.key) e.currentTarget.style.background = 'transparent';
              }}
            >
              {p.label}
            </div>
          ))}
        </div>

        {/* ── RIGHT CONTENT ── */}
        <div style={{ background: '#fff', padding: '2rem 2.5rem' }}>

          {/* ══════ NOTIFICATIONS ══════ */}
          {activePanel === 'notifications' && (
            <div>
              <SectionHead text="Email Notifications" />
              <Row
                title="Event invitations"
                desc="Upcoming events and exclusive invitations"
                right={<Toggle checked={notifications.eventInvitations} onChange={() => toggleNotif('eventInvitations')} />}
              />
              <Row
                title="Membership updates"
                desc="When your membership status changes"
                right={<Toggle checked={notifications.membershipUpdates} onChange={() => toggleNotif('membershipUpdates')} />}
              />
              <Row
                title="Product launches"
                desc="New zai products before public release"
                right={<Toggle checked={notifications.productLaunches} onChange={() => toggleNotif('productLaunches')} />}
              />
              <Row
                title="Partner offers"
                desc="Exclusive offers from our ecosystem partners"
                right={<Toggle checked={notifications.partnerOffers} onChange={() => toggleNotif('partnerOffers')} />}
                noBorder
              />

              <div style={{ marginTop: '2rem', marginBottom: '0.25rem' }}>
                <SectionHead text="Push Notifications" />
              </div>
              <Row
                title="Product updates"
                desc="Notifications about your registered products"
                right={<Toggle checked={notifications.pushProductUpdates} onChange={() => toggleNotif('pushProductUpdates')} />}
              />
              <Row
                title="Event reminders"
                desc="48 hours before registered events"
                right={<Toggle checked={notifications.pushEventReminders} onChange={() => toggleNotif('pushEventReminders')} />}
                noBorder
              />
            </div>
          )}

          {/* ══════ EXPERIENCE CARD ══════ */}
          {activePanel === 'card' && (
            <div>
              <SectionHead text="NFC Experience Card" />

              {/* Card preview */}
              <div
                style={{
                  background: C.black, borderRadius: '12px', padding: '2rem 2rem 1.75rem',
                  marginTop: '1rem', marginBottom: '2rem', position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Chip icon */}
                <div
                  style={{
                    width: '36px', height: '28px', borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                    marginBottom: '1.25rem',
                  }}
                />
                <div style={{
                  fontSize: '16px', fontWeight: 400, color: '#fff',
                  letterSpacing: '0.2em', fontFamily: "'Courier New', monospace',",
                }}>
                  {card.cardId
                    ? `ZAI-${card.cardId.slice(0, 4)} ···· ${card.cardId.slice(-4)}`
                    : 'ZAI-2024 ···· 0000'
                  }
                </div>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: card.isActive ? '#2a9d4e' : C.gray, marginTop: '6px',
                }}>
                  {card.isActive ? '● Active' : '● Inactive'}
                </div>
              </div>

              <Row
                title="NFC card active"
                desc="Enables contactless product claim and access"
                right={
                  <span style={{
                    fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: card.nfcEnabled ? '#2a9d4e' : C.gray, fontWeight: 500,
                  }}>
                    {card.nfcEnabled ? 'Active' : 'Inactive'}
                  </span>
                }
              />
              <Row
                title="Auto-login on tap"
                desc="Tap card to log in without password"
                right={<Toggle checked={card.autoLogin} onChange={() => toggleCard('autoLogin')} />}
              />
              <Row
                title="Replace card"
                desc="Request a new card if yours is lost or damaged"
                right={<TextLink text="Request" onClick={() => alert('Card replacement requested')} />}
                noBorder
              />
            </div>
          )}

          {/* ══════ PRIVACY ══════ */}
          {activePanel === 'privacy' && (
            <div>
              <SectionHead text="Privacy Settings" />
              <Row
                title="Data sharing"
                desc="Share usage data to improve ZAI"
                right={<Toggle checked={privacy.dataSharing} onChange={() => togglePrivacy('dataSharing')} />}
              />
              <Row
                title="Analytics"
                desc="Allow analytics tracking"
                right={<Toggle checked={privacy.analytics} onChange={() => togglePrivacy('analytics')} />}
              />
              <Row
                title="Profile visibility"
                desc="Make your profile visible to other members"
                right={<Toggle checked={privacy.profileVisibility} onChange={() => togglePrivacy('profileVisibility')} />}
              />
              <Row
                title="Community visibility"
                desc="Appear in community member lists"
                right={<Toggle checked={privacy.communityVisibility} onChange={() => togglePrivacy('communityVisibility')} />}
                noBorder
              />
            </div>
          )}

          {/* ══════ REGION & CURRENCY ══════ */}
          {activePanel === 'region' && (
            <div>
              <SectionHead text="Region & Currency" />
              <Row
                title="Account region"
                desc={COUNTRY_MAP[region.countryCode] || region.country}
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>
                      {FLAG_MAP[region.countryCode] || '🏳️'}
                    </span>
                    <span style={{ fontSize: '13px', color: C.black, fontWeight: 500 }}>
                      {region.countryCode}
                    </span>
                  </div>
                }
              />
              <Row
                title="Currency"
                desc="Used for pricing and reward values"
                right={
                  <span style={{ fontSize: '13px', color: C.black, fontWeight: 500 }}>
                    {region.currency}
                  </span>
                }
              />
              <Row
                title="Language"
                desc="Portal display language"
                right={
                  <span style={{ fontSize: '13px', color: C.black, fontWeight: 500 }}>
                    {LANG_MAP[region.language] || region.language}
                  </span>
                }
                noBorder
              />
            </div>
          )}

          {/* ══════ SECURITY ══════ */}
          {activePanel === 'security' && (
            <div>
              <SectionHead text="Account Security" />
              <Row
                title="Change password"
                desc={lastPasswordText()}
                right={
                  <TextLink
                    text="Update"
                    onClick={() => {
                      setShowPasswordModal(true);
                      setPasswordError('');
                      setPasswordForm({ current: '', newPass: '', confirm: '' });
                    }}
                  />
                }
              />
              <Row
                title="Two-factor authentication"
                desc={
                  security.twoFactorEnabled
                    ? `Enabled via ${security.twoFactorMethod}`
                    : 'Add an extra layer of security'
                }
                right={
                  <Toggle
                    checked={security.twoFactorEnabled}
                    onChange={() => {
                      if (security.twoFactorEnabled) {
                        setShowDisable2FAModal(true);
                        setDisableCode(''); setDisableError('');
                      } else {
                        setShowTwoFactorModal(true);
                        setTfaStep('choose'); setTfaCode(''); setTfaError('');
                        setTfaSecret(''); setTfaQrUrl('');
                      }
                    }}
                  />
                }
              />
              <Row
                title="Active sessions"
                desc={`${sessionCount} device${sessionCount !== 1 ? 's' : ''} logged in`}
                right={<TextLink text="Sign out others" onClick={openSessionsModal} />}
                noBorder
              />
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODALS
      ═══════════════════════════════════════════════════════ */}

      {/* ── Password Modal ── */}
      {showPasswordModal && (
        <div style={overlay} onClick={() => setShowPasswordModal(false)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={mTitle}>Change Password</div>
            {passwordError && (
              <div style={{
                background: 'rgba(200,16,46,0.06)', color: C.red,
                padding: '10px 14px', marginBottom: '1rem', fontSize: '12px',
                border: '1px solid rgba(200,16,46,0.15)',
              }}>{passwordError}</div>
            )}
            <label style={{
              fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.gray, display: 'block', marginBottom: '6px',
            }}>Current Password</label>
            <input type="password" style={inp}
              value={passwordForm.current}
              onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
            />
            <label style={{
              fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.gray, display: 'block', marginBottom: '6px',
            }}>New Password</label>
            <input type="password" style={inp}
              value={passwordForm.newPass}
              onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
            />
            <label style={{
              fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: C.gray, display: 'block', marginBottom: '6px',
            }}>Confirm New Password</label>
            <input type="password" style={inp}
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button onClick={handlePasswordChange} disabled={passwordSaving} style={btnP}
                onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}>
                {passwordSaving ? 'Saving...' : 'Update Password'}
              </button>
              <button onClick={() => setShowPasswordModal(false)} style={btnO}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2FA Enable Modal ── */}
      {showTwoFactorModal && (
        <div style={overlay} onClick={() => setShowTwoFactorModal(false)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={mTitle}>
              {tfaStep === 'choose' && 'Enable Two-Factor Authentication'}
              {tfaStep === 'scan' && 'Scan QR Code'}
              {tfaStep === 'verify' && 'Verify Code'}
              {tfaStep === 'success' && '2FA Enabled'}
            </div>
            {tfaError && (
              <div style={{
                background: 'rgba(200,16,46,0.06)', color: C.red,
                padding: '10px 14px', marginBottom: '1rem', fontSize: '12px',
                border: '1px solid rgba(200,16,46,0.15)',
              }}>{tfaError}</div>
            )}

            {tfaStep === 'choose' && (
              <div>
                <div style={{ marginBottom: '1.5rem', fontSize: '13px', color: C.gray }}>
                  Choose your preferred verification method.
                </div>
                {(['authenticator', 'email'] as const).map(m => (
                  <div key={m} onClick={() => setTfaMethod(m)} style={{
                    padding: '1.25rem',
                    border: `1px solid ${tfaMethod === m ? C.red : C.border}`,
                    marginBottom: '0.75rem', cursor: 'pointer',
                    background: tfaMethod === m ? 'rgba(200,16,46,0.03)' : '#fff',
                    transition: 'border 0.2s',
                  }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: C.black }}>
                      {m === 'authenticator' ? 'Authenticator App' : 'Email Verification'}
                    </div>
                    <div style={{ fontSize: '11px', color: C.gray, marginTop: '4px' }}>
                      {m === 'authenticator'
                        ? 'Use Google Authenticator, Authy, or any TOTP app'
                        : 'Receive a code via email each time you log in'}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button onClick={handleSetup2FA} disabled={tfaLoading} style={btnP}
                    onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}>
                    {tfaLoading ? 'Setting up...' : 'Continue'}
                  </button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnO}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tfaStep === 'scan' && (
              <div>
                {tfaMethod === 'authenticator' ? (
                  <>
                    <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
                      Scan this QR code with your authenticator app.
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <img src={tfaQrUrl} alt="2FA QR" style={{ width: 200, height: 200 }} />
                    </div>
                    <div style={{
                      background: C.surface, padding: '1rem', marginBottom: '1.5rem',
                      textAlign: 'center', border: `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        fontSize: '10px', color: C.gray, marginBottom: '4px',
                        textTransform: 'uppercase', letterSpacing: '0.15em',
                      }}>Or enter this code manually</div>
                      <div style={{
                        fontFamily: 'monospace', fontSize: '16px', fontWeight: 600,
                        letterSpacing: '0.2em', wordBreak: 'break-all', color: C.black,
                      }}>{tfaSecret}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
                    A verification code has been sent to your email.
                    <div style={{
                      background: C.surface, padding: '1rem', marginTop: '1rem',
                      textAlign: 'center', fontFamily: 'monospace', fontSize: '16px',
                      fontWeight: 600, border: `1px solid ${C.border}`,
                    }}>{tfaSecret}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setTfaStep('verify')} style={btnP}
                    onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}>
                    I've scanned it
                  </button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnO}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tfaStep === 'verify' && (
              <div>
                <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
                  Enter the 6-digit code from your authenticator app.
                </div>
                <input type="text" maxLength={6} placeholder="000000"
                  value={tfaCode}
                  onChange={e => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    ...inp, textAlign: 'center', fontSize: '24px',
                    fontFamily: 'monospace', letterSpacing: '0.5em', fontWeight: 600,
                  }}
                />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleVerify2FA} disabled={tfaLoading} style={btnP}
                    onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}>
                    {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button onClick={() => setTfaStep('scan')} style={btnO}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {tfaStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{
                  width: 48, height: 48, margin: '0 auto 1rem',
                  border: '2px solid #2a9d4e', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', color: '#2a9d4e',
                }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '0.5rem', color: C.black }}>
                  Two-Factor Authentication Enabled
                </div>
                <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
                  Your account is now protected with an additional layer of security.
                </div>
                <button onClick={() => setShowTwoFactorModal(false)} style={btnP}
                  onMouseEnter={e => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={e => (e.currentTarget.style.background = C.burgundy)}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2FA Disable Modal ── */}
      {showDisable2FAModal && (
        <div style={overlay} onClick={() => setShowDisable2FAModal(false)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={mTitle}>Disable Two-Factor Authentication</div>
            {disableError && (
              <div style={{
                background: 'rgba(200,16,46,0.06)', color: C.red,
                padding: '10px 14px', marginBottom: '1rem', fontSize: '12px',
                border: '1px solid rgba(200,16,46,0.15)',
              }}>{disableError}</div>
            )}
            <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
              Enter your current 6-digit code to disable 2FA.
            </div>
            <input type="text" maxLength={6} placeholder="000000"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                ...inp, textAlign: 'center', fontSize: '24px',
                fontFamily: 'monospace', letterSpacing: '0.5em', fontWeight: 600,
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleDisable2FA} disabled={disableLoading} style={btnD}>
                {disableLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
              <button onClick={() => setShowDisable2FAModal(false)} style={btnO}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions Modal ── */}
      {showSessionsModal && (
        <div style={overlay} onClick={() => setShowSessionsModal(false)}>
          <div style={{ ...mBox, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              ...mTitle,
            }}>
              <span>Active Sessions</span>
              <button onClick={() => setShowSessionsModal(false)} style={{
                background: 'none', border: 'none', fontSize: '18px',
                cursor: 'pointer', color: C.gray,
              }}>✕</button>
            </div>
            {sessionsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: C.gray, fontSize: '13px' }}>
                Loading sessions...
              </div>
            ) : sessionsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: C.gray, fontSize: '13px' }}>
                No active sessions found
              </div>
            ) : (
              <>
                {sessionsList.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 0', borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: s.isCurrent ? 500 : 400, color: C.black }}>
                        {s.device} — {s.browser}
                        {s.isCurrent && (
                          <span style={{
                            background: 'rgba(42,157,78,0.06)', color: '#2a9d4e', fontSize: '9px',
                            padding: '2px 8px', marginLeft: '8px', textTransform: 'uppercase',
                            letterSpacing: '0.15em', border: '1px solid rgba(42,157,78,0.2)',
                          }}>Current</span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: C.gray, marginTop: '4px' }}>
                        {s.ipAddress} · Last active {new Date(s.lastActive).toLocaleString()}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button onClick={() => revokeSession(s.id)} style={{
                        ...btnO, padding: '6px 14px', fontSize: '10px',
                      }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.black; }}>
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
                {sessionsList.filter(s => !s.isCurrent).length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <button onClick={revokeAllOther} style={btnD}>Revoke All Other Sessions</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Logout Modal ── */}
      {showLogoutModal && (
        <div style={overlay} onClick={() => setShowLogoutModal(false)}>
          <div style={{ ...mBox, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '0.75rem', color: C.black }}>
              Sign Out
            </div>
            <div style={{ fontSize: '13px', color: C.gray, marginBottom: '1.5rem' }}>
              Are you sure you want to log out of your account?
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={handleLogout} style={btnD}>Logout</button>
              <button onClick={() => setShowLogoutModal(false)} style={btnO}
                onMouseEnter={e => (e.currentTarget.style.borderColor = C.black)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
