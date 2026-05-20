import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import { apiService } from '../../services/api';
import Button from '../Common/Button';
import Modal from '../Common/Modal';

type SettingsPanel = 'notifications' | 'card' | 'privacy' | 'region' | 'security';

interface NotificationSettings {
  eventInvitations: boolean;
  membershipUpdates: boolean;
  productLaunches: boolean;
  partnerOffers: boolean;
  productUpdates: boolean;
  eventReminders: boolean;
}

interface PrivacySettings {
  partnerDataSharing: boolean;
  analytics: boolean;
  profileVisibility: boolean;
  communityVisibility: boolean;
}

interface CardSettings {
  nfcActive: boolean;
  autoLoginOnTap: boolean;
}

interface RegionSettings {
  country: string;
  currency: string;
  language: string;
}

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
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

const Settings: React.FC = () => {
  const { user } = useAppContext();
  const { logout } = useWalletAuth();
  const [activePanel, setActivePanel] = useState<SettingsPanel>('notifications');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationSettings>({
    eventInvitations: true,
    membershipUpdates: true,
    productLaunches: false,
    partnerOffers: false,
    productUpdates: true,
    eventReminders: true,
  });

  const [privacy, setPrivacy] = useState<PrivacySettings>({
    partnerDataSharing: true,
    analytics: false,
    profileVisibility: true,
    communityVisibility: false,
  });

  const [card, setCard] = useState<CardSettings>({
    nfcActive: true,
    autoLoginOnTap: true,
  });

  const [region, setRegion] = useState<RegionSettings>({
    country: 'Switzerland',
    currency: 'CHF',
    language: 'English',
  });

  // Security state
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    twoFactorMethod: 'none',
    lastPasswordChange: null,
    sessions: [],
  });

  // Password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // 2FA modal
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<'choose' | 'verify' | 'success' | 'disable'>('choose');
  const [twoFAMethod, setTwoFAMethod] = useState<'authenticator' | 'email'>('authenticator');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [twoFASaving, setTwoFASaving] = useState(false);
  const [twoFAQrUrl, setTwoFAQrUrl] = useState<string | null>(null);
  const [twoFASecret, setTwoFASecret] = useState<string | null>(null);

  // Sessions modal
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Logout confirm
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
      fetchSecurityInfo();
    } else {
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.get('/users/me/settings');
      if (response.data?.success) {
        const settings = response.data.data;
        if (settings.notifications) setNotifications(prev => ({ ...prev, ...settings.notifications }));
        if (settings.privacy) setPrivacy(prev => ({ ...prev, ...settings.privacy }));
        if (settings.card) setCard(prev => ({ ...prev, ...settings.card }));
        if (settings.region) setRegion(prev => ({ ...prev, ...settings.region }));
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        setError(err.response?.data?.error || 'Failed to load settings');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSecurityInfo = async () => {
    try {
      const response = await apiService.get('/users/me/security');
      if (response.data?.success) {
        setSecurity(prev => ({ ...prev, ...response.data.data }));
      }
    } catch {
      // Non-fatal: use defaults — endpoint may not exist yet
      buildLocalSession();
    }
  };

  const buildLocalSession = () => {
    // Build a session entry from browser info when the API isn't available
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    setSecurity(prev => ({
      ...prev,
      sessions: [{
        id: 'current',
        device: os,
        browser,
        ip: '—',
        location: '—',
        lastActive: new Date().toISOString(),
        isCurrent: true,
      }],
    }));
  };

  const saveSettings = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await apiService.put('/users/me/settings', {
        notifications, privacy, card, region,
      });
      if (response.data?.success) {
        if (response.data.jwtToken) {
          localStorage.setItem('zai_token', response.data.jwtToken);
        }
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Password change ──

  const handlePasswordChange = async () => {
    setPasswordError(null);
    if (!passwordForm.newPass || !passwordForm.confirm) {
      setPasswordError('Please fill in all fields');
      return;
    }
    if (passwordForm.newPass.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      const response = await apiService.post('/users/me/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.newPass,
      });
      if (response.data?.success) {
        setSecurity(prev => ({ ...prev, lastPasswordChange: new Date().toISOString() }));
        setShowPasswordModal(false);
        setPasswordForm({ current: '', newPass: '', confirm: '' });
        setSuccessMessage('Password changed successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── 2FA ──

  const handleEnable2FA = async () => {
    setTwoFAError(null);
    setTwoFASaving(true);
    try {
      const response = await apiService.post('/users/me/2fa/setup', { method: twoFAMethod });
      if (response.data?.success) {
        if (twoFAMethod === 'authenticator') {
          setTwoFAQrUrl(response.data.data?.qrCode || null);
          setTwoFASecret(response.data.data?.secret || null);
        }
        setTwoFAStep('verify');
      }
    } catch (err: any) {
      setTwoFAError(err.response?.data?.error || 'Failed to setup 2FA');
    } finally {
      setTwoFASaving(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFACode || twoFACode.length < 6) {
      setTwoFAError('Please enter a valid 6-digit code');
      return;
    }
    setTwoFAError(null);
    setTwoFASaving(true);
    try {
      const response = await apiService.post('/users/me/2fa/verify', { code: twoFACode, method: twoFAMethod });
      if (response.data?.success) {
        setSecurity(prev => ({ ...prev, twoFactorEnabled: true, twoFactorMethod: twoFAMethod }));
        setTwoFAStep('success');
      }
    } catch (err: any) {
      setTwoFAError(err.response?.data?.error || 'Invalid verification code');
    } finally {
      setTwoFASaving(false);
    }
  };

  const handleDisable2FA = async () => {
    setTwoFAError(null);
    if (!twoFACode || twoFACode.length < 6) {
      setTwoFAError('Please enter your current 2FA code to disable');
      return;
    }
    setTwoFASaving(true);
    try {
      const response = await apiService.post('/users/me/2fa/disable', { code: twoFACode });
      if (response.data?.success) {
        setSecurity(prev => ({ ...prev, twoFactorEnabled: false, twoFactorMethod: 'none' }));
        setShow2FAModal(false);
        setSuccessMessage('Two-factor authentication disabled');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      setTwoFAError(err.response?.data?.error || 'Failed to disable 2FA');
    } finally {
      setTwoFASaving(false);
    }
  };

  const open2FAModal = () => {
    setTwoFACode('');
    setTwoFAError(null);
    setTwoFAQrUrl(null);
    setTwoFASecret(null);
    setTwoFAStep(security.twoFactorEnabled ? 'disable' : 'choose');
    setTwoFAMethod('authenticator');
    setShow2FAModal(true);
  };

  // ── Sessions ──

  const openSessionsModal = async () => {
    setShowSessionsModal(true);
    setSessionsLoading(true);
    try {
      const response = await apiService.get('/users/me/sessions');
      if (response.data?.success) {
        setSecurity(prev => ({ ...prev, sessions: response.data.data || prev.sessions }));
      }
    } catch {
      // Keep existing session data
    } finally {
      setSessionsLoading(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await apiService.post('/users/me/sessions/revoke', { sessionId });
      setSecurity(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.id !== sessionId),
      }));
      setSuccessMessage('Session revoked');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke session');
    }
  };

  const revokeAllOtherSessions = async () => {
    try {
      await apiService.post('/users/me/sessions/revoke-all');
      setSecurity(prev => ({
        ...prev,
        sessions: prev.sessions.filter(s => s.isCurrent),
      }));
      setSuccessMessage('All other sessions revoked');
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowSessionsModal(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke sessions');
    }
  };

  // ── Logout ──

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
  };

  // ── Helpers ──

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const handlePrivacyToggle = (key: keyof PrivacySettings) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const handleCardToggle = (key: keyof CardSettings) => {
    setCard(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReplaceCard = async () => {
    if (window.confirm('Request a new NFC card? A new card will be sent to your address.')) {
      setIsSaving(true);
      try {
        await apiService.post('/users/me/request-card-replacement');
        setSuccessMessage('Card replacement request submitted');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to request card replacement');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e0ddd6', fontSize: '13px',
    boxSizing: 'border-box', fontFamily: "'Inter', sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
    color: '#6a6a6a', marginBottom: '6px', display: 'block',
  };

  // Toggle component
  const Toggle = ({ active, onClick }: { active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        width: '34px', height: '18px',
        background: active ? '#c8102e' : '#e0ddd6',
        borderRadius: '9px', position: 'relative', cursor: 'pointer',
        border: 'none', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute', width: '14px', height: '14px',
        background: 'white', borderRadius: '50%', top: '2px',
        right: active ? '2px' : 'auto', left: active ? 'auto' : '2px',
        transition: 'all 0.2s',
      }} />
    </button>
  );

  if (!user || isLoading) {
    return (
      <div style={{ padding: '3rem 4rem 5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6a6a6a' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
      <div style={{
        marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
      }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c8102e', marginBottom: '0.4rem' }}>
            account
          </div>
          <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem' }}>
            Settings
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Manage notifications, privacy, and account preferences.
          </p>
        </div>
        {activePanel !== 'security' && (
          <Button variant="primary" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', marginBottom: '1rem', fontSize: '12px' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '12px', background: '#f0faf4', border: '1px solid #b6e8cc', color: '#2a7a50', marginBottom: '1rem', fontSize: '12px' }}>
          {successMessage}
        </div>
      )}

      {/* Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6' }}>
        {/* Nav */}
        <div style={{ background: '#f0ede6', padding: '1.5rem 0' }}>
          {(['notifications', 'card', 'privacy', 'region', 'security'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              style={{
                width: '100%', padding: '0.75rem 1.5rem', fontSize: '11px',
                letterSpacing: '0.08em', cursor: 'pointer',
                color: activePanel === panel ? '#1a1a1a' : '#6a6a6a',
                background: activePanel === panel ? '#e8e5de' : 'transparent',
                border: 'none',
                borderLeft: activePanel === panel ? '2px solid #c8102e' : '2px solid transparent',
                textAlign: 'left', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s',
              }}
            >
              {panel === 'notifications' && 'Notifications'}
              {panel === 'card' && 'Experience Card'}
              {panel === 'privacy' && 'Privacy'}
              {panel === 'region' && 'Region & Currency'}
              {panel === 'security' && 'Security'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: '#ffffff', padding: '2rem' }}>

          {/* ── Notifications ── */}
          {activePanel === 'notifications' && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                Email Notifications
              </div>
              {([
                { key: 'eventInvitations', label: 'Event invitations', desc: 'Upcoming events and exclusive invitations' },
                { key: 'membershipUpdates', label: 'Membership updates', desc: 'When your membership status changes' },
                { key: 'productLaunches', label: 'Product launches', desc: 'New zai products before public release' },
                { key: 'partnerOffers', label: 'Partner offers', desc: 'Exclusive offers from our ecosystem partners' },
              ] as const).map(s => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{s.desc}</div>
                  </div>
                  <Toggle active={notifications[s.key]} onClick={() => handleNotificationToggle(s.key)} />
                </div>
              ))}
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', margin: '2rem 0 1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                Push Notifications
              </div>
              {([
                { key: 'productUpdates', label: 'Product updates', desc: 'Notifications about your registered products' },
                { key: 'eventReminders', label: 'Event reminders', desc: '48 hours before registered events' },
              ] as const).map(s => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{s.desc}</div>
                  </div>
                  <Toggle active={notifications[s.key]} onClick={() => handleNotificationToggle(s.key)} />
                </div>
              ))}
            </div>
          )}

          {/* ── Experience Card ── */}
          {activePanel === 'card' && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                NFC Experience Card
              </div>
              <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ width: '36px', height: '26px', background: 'linear-gradient(135deg,#b8a06a,#8a7045)', borderRadius: '4px', flexShrink: 0 }} />
                <div style={{ color: '#ffffff' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Card ID</div>
                  <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#ffffff', fontFamily: 'monospace' }}>
                    {(user as any)?.nfcCardId || 'ZAI-2024 ···· XXXX'}
                  </div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4caf7d', marginTop: '3px' }}>
                    {card.nfcActive ? '● Active' : '○ Inactive'}
                  </div>
                </div>
              </div>
              {[
                { label: 'NFC card active', desc: 'Enables contactless product claim and access', value: card.nfcActive ? 'Active' : 'Inactive' },
                { label: 'Auto-login on tap', desc: 'Tap card to log in without password', toggle: true, key: 'autoLoginOnTap' as const },
                { label: 'Replace card', desc: 'Request a new card if yours is lost or damaged', button: true },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  {item.value && <div style={{ fontSize: '11px', color: '#2a8a5a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.value}</div>}
                  {item.toggle && item.key && <Toggle active={card[item.key]} onClick={() => handleCardToggle(item.key!)} />}
                  {item.button && <Button variant="primary" size="sm" onClick={handleReplaceCard} disabled={isSaving}>Request</Button>}
                </div>
              ))}
            </div>
          )}

          {/* ── Privacy ── */}
          {activePanel === 'privacy' && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                Data & Privacy
              </div>
              {([
                { key: 'partnerDataSharing', label: 'Partner data sharing', desc: 'Allow partners to verify your membership' },
                { key: 'analytics', label: 'Analytics', desc: 'Help improve zai experience club with anonymous usage data' },
                { key: 'profileVisibility', label: 'Profile visibility', desc: 'Show your membership to zai staff at events' },
                { key: 'communityVisibility', label: 'Be visible to other members', desc: 'Let other zai members find you in Community' },
              ] as const).map(item => (
                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <Toggle active={privacy[item.key]} onClick={() => handlePrivacyToggle(item.key)} />
                </div>
              ))}
            </div>
          )}

          {/* ── Region & Currency ── */}
          {activePanel === 'region' && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                Region & Currency
              </div>
              {[
                { label: 'Account region', desc: 'Switzerland', value: region.country },
                { label: 'Currency', desc: 'Used for pricing and reward values', value: region.currency },
                { label: 'Language', desc: 'Portal display language', value: region.language },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{item.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{item.desc}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#1a1a1a' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Security ── */}
          {activePanel === 'security' && (
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
                Account Security
              </div>

              {/* Change Password */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>Change password</div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                    Last changed: {formatTimeAgo(security.lastPasswordChange)}
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={() => { setPasswordForm({ current: '', newPass: '', confirm: '' }); setPasswordError(null); setShowPasswordModal(true); }}>
                  Update
                </Button>
              </div>

              {/* 2FA */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>Two-factor authentication</span>
                    {security.twoFactorEnabled && (
                      <span style={{ fontSize: '9px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4caf7d', background: '#f0faf4', border: '1px solid #b6e8cc', padding: '2px 8px' }}>
                        Enabled
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                    {security.twoFactorEnabled
                      ? `Active via ${security.twoFactorMethod === 'authenticator' ? 'Authenticator app' : 'Email'}`
                      : 'Add an extra layer of security to your account'}
                  </div>
                </div>
                <Button variant={security.twoFactorEnabled ? 'secondary' : 'primary'} size="sm" onClick={open2FAModal}>
                  {security.twoFactorEnabled ? 'Manage' : 'Enable'}
                </Button>
              </div>

              {/* Active Sessions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>Active sessions</div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                    {security.sessions.length} device{security.sessions.length !== 1 ? 's' : ''} logged in
                  </div>
                </div>
                <Button variant="primary" size="sm" onClick={openSessionsModal}>
                  View sessions
                </Button>
              </div>

              {/* Wallet info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid #e0ddd6' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>Connected wallet</div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px', fontFamily: 'monospace' }}>
                    {(user as any)?.walletAddress
                      ? `${(user as any).walletAddress.slice(0, 8)}...${(user as any).walletAddress.slice(-6)}`
                      : 'No wallet connected'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 6, height: 6, background: '#4caf7d', borderRadius: '50%', boxShadow: '0 0 5px #4caf7d' }} />
                  <span style={{ fontSize: '11px', color: '#4caf7d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Connected</span>
                </div>
              </div>

              {/* Logout */}
              <div style={{ marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid #e0ddd6' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c8102e', marginBottom: '1rem' }}>
                  Danger Zone
                </div>
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => setShowLogoutConfirm(true)}
                  style={{ background: '#c8102e' }}
                >
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PASSWORD MODAL ── */}
      <Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} title="Change Password" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Current Password</label>
            <input
              type="password" value={passwordForm.current}
              onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
              style={inputStyle} placeholder="Enter current password"
            />
          </div>
          <div>
            <label style={labelStyle}>New Password *</label>
            <input
              type="password" value={passwordForm.newPass}
              onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
              style={inputStyle} placeholder="Minimum 8 characters"
            />
          </div>
          <div>
            <label style={labelStyle}>Confirm New Password *</label>
            <input
              type="password" value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
              style={inputStyle} placeholder="Re-enter new password"
            />
          </div>
          {passwordError && (
            <div style={{ padding: '10px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', fontSize: '12px' }}>
              {passwordError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <Button variant="primary" fullWidth onClick={handlePasswordChange} disabled={passwordSaving}>
              {passwordSaving ? 'Changing...' : 'Change Password'}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setShowPasswordModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* ── 2FA MODAL ── */}
      <Modal isOpen={show2FAModal} onClose={() => setShow2FAModal(false)} title="Two-Factor Authentication" size="md">
        {/* Choose method */}
        {twoFAStep === 'choose' && (
          <div>
            <p style={{ color: '#6a6a6a', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Add an extra layer of security by requiring a verification code when signing in.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
              {[
                { id: 'authenticator' as const, label: 'Authenticator App', desc: 'Use Google Authenticator, Authy, or similar', icon: '🔐' },
                { id: 'email' as const, label: 'Email Verification', desc: `Code sent to ${user?.email || 'your email'}`, icon: '✉' },
              ].map(m => (
                <div
                  key={m.id}
                  onClick={() => setTwoFAMethod(m.id)}
                  style={{
                    padding: '1rem', border: twoFAMethod === m.id ? '2px solid #7D1E2C' : '1px solid #e0ddd6',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px',
                    background: twoFAMethod === m.id ? '#fdf5f6' : '#fff', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '24px', flexShrink: 0 }}>{m.icon}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{m.label}</div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>{m.desc}</div>
                  </div>
                  {twoFAMethod === m.id && (
                    <div style={{ marginLeft: 'auto', width: 8, height: 8, background: '#7D1E2C', borderRadius: '50%' }} />
                  )}
                </div>
              ))}
            </div>
            {twoFAError && (
              <div style={{ padding: '10px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', fontSize: '12px', marginBottom: '1rem' }}>
                {twoFAError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" fullWidth onClick={handleEnable2FA} disabled={twoFASaving}>
                {twoFASaving ? 'Setting up...' : 'Continue'}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShow2FAModal(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Verify code */}
        {twoFAStep === 'verify' && (
          <div>
            {twoFAMethod === 'authenticator' && twoFAQrUrl && (
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: '#6a6a6a', fontSize: '13px', marginBottom: '1rem' }}>
                  Scan this QR code with your authenticator app:
                </p>
                <img src={twoFAQrUrl} alt="2FA QR Code" style={{ width: 180, height: 180, margin: '0 auto', display: 'block', border: '1px solid #e0ddd6', padding: 8, background: '#fff' }} />
                {twoFASecret && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '10px', color: '#6a6a6a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Or enter this code manually:
                    </div>
                    <code style={{ fontSize: '14px', background: '#f0ede6', padding: '6px 12px', fontFamily: 'monospace', letterSpacing: '0.15em', userSelect: 'all' }}>
                      {twoFASecret}
                    </code>
                  </div>
                )}
              </div>
            )}
            {twoFAMethod === 'email' && (
              <p style={{ color: '#6a6a6a', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                A 6-digit verification code has been sent to <strong>{user?.email}</strong>. Enter it below.
              </p>
            )}
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Verification Code *</label>
              <input
                type="text" value={twoFACode} maxLength={6} placeholder="000000"
                onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                style={{ ...inputStyle, fontSize: '20px', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '0.5em' }}
              />
            </div>
            {twoFAError && (
              <div style={{ padding: '10px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', fontSize: '12px', marginBottom: '1rem' }}>
                {twoFAError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" fullWidth onClick={handleVerify2FA} disabled={twoFASaving || twoFACode.length < 6}>
                {twoFASaving ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setTwoFAStep('choose')}>Back</Button>
            </div>
          </div>
        )}

        {/* Success */}
        {twoFAStep === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ width: 56, height: 56, background: '#f0faf4', border: '2px solid #4caf7d', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 1rem' }}>
              ✓
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#4caf7d', marginBottom: 8 }}>2FA Enabled</div>
            <p style={{ color: '#6a6a6a', fontSize: '13px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Two-factor authentication is now active via {twoFAMethod === 'authenticator' ? 'Authenticator app' : 'Email'}.
              You'll be asked for a code each time you sign in.
            </p>
            <Button variant="primary" fullWidth onClick={() => setShow2FAModal(false)}>Done</Button>
          </div>
        )}

        {/* Disable */}
        {twoFAStep === 'disable' && (
          <div>
            <div style={{ background: '#fef9e7', border: '1px solid #f0d6b6', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '12px', color: '#8a6a1a', fontWeight: 500, marginBottom: 4 }}>Warning</div>
              <div style={{ fontSize: '12px', color: '#8a6a1a', lineHeight: 1.5 }}>
                Disabling two-factor authentication will make your account less secure.
              </div>
            </div>
            <p style={{ color: '#6a6a6a', fontSize: '13px', marginBottom: '1rem', lineHeight: 1.6 }}>
              Enter your current 2FA code to confirm disabling:
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Current 2FA Code *</label>
              <input
                type="text" value={twoFACode} maxLength={6} placeholder="000000"
                onChange={e => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                style={{ ...inputStyle, fontSize: '20px', fontFamily: 'monospace', textAlign: 'center', letterSpacing: '0.5em' }}
              />
            </div>
            {twoFAError && (
              <div style={{ padding: '10px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', fontSize: '12px', marginBottom: '1rem' }}>
                {twoFAError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary" fullWidth onClick={handleDisable2FA} disabled={twoFASaving || twoFACode.length < 6} style={{ background: '#c8102e' }}>
                {twoFASaving ? 'Disabling...' : 'Disable 2FA'}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShow2FAModal(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── SESSIONS MODAL ── */}
      <Modal isOpen={showSessionsModal} onClose={() => setShowSessionsModal(false)} title="Active Sessions" size="md">
        {sessionsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#6a6a6a' }}>Loading sessions...</div>
        ) : (
          <div>
            <p style={{ color: '#6a6a6a', fontSize: '13px', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              These devices are currently signed in to your account. Revoke any session you don't recognize.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e0ddd6', marginBottom: '1.5rem' }}>
              {security.sessions.map((session, i) => (
                <div
                  key={session.id}
                  style={{
                    padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: i < security.sessions.length - 1 ? '1px solid #e0ddd6' : 'none',
                    background: session.isCurrent ? '#fafaf7' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: 36, height: 36, background: session.isCurrent ? '#f0ede6' : '#fff',
                      border: '1px solid #e0ddd6', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 16, flexShrink: 0,
                    }}>
                      {session.device.includes('Windows') || session.device.includes('Mac') || session.device.includes('Linux') ? '💻' : '📱'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {session.browser} on {session.device}
                        {session.isCurrent && (
                          <span style={{ fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4caf7d', background: '#f0faf4', border: '1px solid #b6e8cc', padding: '1px 6px' }}>
                            This device
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                        {session.ip !== '—' ? `${session.ip} · ` : ''}{session.location !== '—' ? `${session.location} · ` : ''}Last active: {formatTimeAgo(session.lastActive)}
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button variant="primary" size="sm" onClick={() => revokeSession(session.id)} style={{ background: '#c8102e' }}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {security.sessions.filter(s => !s.isCurrent).length > 0 && (
              <Button variant="primary" fullWidth onClick={revokeAllOtherSessions} style={{ background: '#c8102e' }}>
                Sign out all other devices
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* ── LOGOUT CONFIRM MODAL ── */}
      <Modal isOpen={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} title="Confirm Logout" size="sm">
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{
            width: 56, height: 56, background: '#fff5f5', border: '2px solid #c8102e', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 1rem',
          }}>
            ⏻
          </div>
          <p style={{ color: '#6a6a6a', fontSize: '13px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Are you sure you want to log out? You will need to sign in again to access your account.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="primary" fullWidth onClick={handleLogout} style={{ background: '#c8102e' }}>
              Logout
            </Button>
            <Button variant="secondary" fullWidth onClick={() => setShowLogoutConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Settings;
