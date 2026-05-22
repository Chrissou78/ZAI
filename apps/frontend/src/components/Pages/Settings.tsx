import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import { apiService } from '../../services/api';

type Panel = 'notifications' | 'card' | 'privacy' | 'region' | 'security';

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
  emailNotifications: boolean;
  pushNotifications: boolean;
  productUpdates: boolean;
  communityAlerts: boolean;
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
  currency: string;
  language: string;
}

const Settings: React.FC = () => {
  const { user } = useAppContext();
  const { logout } = useWalletAuth();

  const [activePanel, setActivePanel] = useState<Panel>('security');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Settings state ──
  const [notifications, setNotifications] = useState<NotificationSettings>({
    emailNotifications: true, pushNotifications: false,
    productUpdates: true, communityAlerts: true,
  });
  const [privacy, setPrivacy] = useState<PrivacySettings>({
    dataSharing: false, analytics: true,
    profileVisibility: true, communityVisibility: true,
  });
  const [card, setCard] = useState<CardSettings>({
    cardId: '', isActive: false, nfcEnabled: true, autoLogin: false,
  });
  const [region, setRegion] = useState<RegionSettings>({
    country: 'CH', currency: 'CHF', language: 'en',
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    twoFactorEnabled: false, twoFactorMethod: 'none',
    lastPasswordChange: null, sessions: [],
  });

  // ── Modal state ──
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDisable2FAModal, setShowDisable2FAModal] = useState(false);

  // ── Password form ──
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // ── 2FA state ──
  const [tfaStep, setTfaStep] = useState<'choose' | 'scan' | 'verify' | 'success'>('choose');
  const [tfaMethod, setTfaMethod] = useState<'authenticator' | 'email'>('authenticator');
  const [tfaSecret, setTfaSecret] = useState('');
  const [tfaQrUrl, setTfaQrUrl] = useState('');
  const [tfaCode, setTfaCode] = useState('');
  const [tfaError, setTfaError] = useState('');
  const [tfaLoading, setTfaLoading] = useState(false);

  // ── Disable 2FA ──
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);

  // ── Sessions state ──
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsList, setSessionsList] = useState<SessionInfo[]>([]);

  // ── Fetch general settings on mount ──
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await apiService.get('/users/me/settings');
        const payload = res.data as any;
        if (payload.settings) {
          if (payload.settings.notifications) setNotifications(prev => ({ ...prev, ...payload.settings.notifications }));
          if (payload.settings.privacy) setPrivacy(prev => ({ ...prev, ...payload.settings.privacy }));
          if (payload.settings.card) setCard(prev => ({ ...prev, ...payload.settings.card }));
          if (payload.settings.region) setRegion(prev => ({ ...prev, ...payload.settings.region }));
        }
      } catch (err: any) {
        if (err?.response?.status !== 404) setError('Failed to load settings');
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  // ── Fetch security info ──
  useEffect(() => {
    if (activePanel === 'security') fetchSecurityInfo();
  }, [activePanel]);

  const fetchSecurityInfo = async () => {
    try {
      const res = await apiService.get('/users/me/security');
      const payload = res.data as any;
      if (payload.security) {
        setSecurity({
          twoFactorEnabled: payload.security.twoFactorEnabled,
          twoFactorMethod: payload.security.twoFactorMethod,
          lastPasswordChange: payload.security.lastPasswordChange,
          sessions: payload.sessions || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch security info:', err);
    }
  };

  // ── Save general settings ──
  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await apiService.put('/users/me/settings', {
        notifications, privacy, card, region,
      });
      const payload = res.data as any;
      if (payload.token) localStorage.setItem('token', payload.token);
      setSuccess('Settings saved');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to save settings');
    }
    setSaving(false);
  };

  // ── Toggle helpers ──
  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const togglePrivacy = (key: keyof PrivacySettings) => {
    setPrivacy(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleCard = (key: keyof CardSettings) => {
    if (key === 'nfcEnabled' || key === 'autoLogin') {
      setCard(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };

  // ── Password change ──
  const handlePasswordChange = async () => {
    setPasswordError('');
    if (passwordForm.newPass.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }
    if (passwordForm.newPass !== passwordForm.confirm) {
      setPasswordError('Passwords do not match');
      return;
    }
    setPasswordSaving(true);
    try {
      await apiService.post('/users/me/change-password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.newPass,
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

  // ── 2FA Setup ──
  const handleSetup2FA = async () => {
    setTfaLoading(true);
    setTfaError('');
    try {
      const res = await apiService.post('/users/me/2fa/setup', { method: tfaMethod });
      const payload = res.data as any;
      setTfaSecret(payload.secret);
      setTfaQrUrl(payload.qrCodeUrl);
      setTfaStep('scan');
    } catch (err: any) {
      setTfaError(err?.response?.data?.error || 'Failed to setup 2FA');
    }
    setTfaLoading(false);
  };

  const handleVerify2FA = async () => {
    if (tfaCode.length !== 6) {
      setTfaError('Please enter the 6-digit code');
      return;
    }
    setTfaLoading(true);
    setTfaError('');
    try {
      await apiService.post('/users/me/2fa/verify', { code: tfaCode });
      setTfaStep('success');
      fetchSecurityInfo();
    } catch (err: any) {
      setTfaError(err?.response?.data?.error || 'Invalid verification code');
    }
    setTfaLoading(false);
  };

  const handleDisable2FA = async () => {
    if (disableCode.length !== 6) {
      setDisableError('Please enter your current 6-digit code');
      return;
    }
    setDisableLoading(true);
    setDisableError('');
    try {
      await apiService.post('/users/me/2fa/disable', { code: disableCode });
      setShowDisable2FAModal(false);
      setDisableCode('');
      setSuccess('Two-factor authentication disabled');
      setTimeout(() => setSuccess(''), 3000);
      fetchSecurityInfo();
    } catch (err: any) {
      setDisableError(err?.response?.data?.error || 'Failed to disable 2FA');
    }
    setDisableLoading(false);
  };

  // ── Sessions ──
  const openSessionsModal = async () => {
    setShowSessionsModal(true);
    setSessionsLoading(true);
    try {
      const res = await apiService.get('/users/me/sessions');
      const payload = res.data as any;
      setSessionsList(payload.sessions || []);
    } catch {
      setSessionsList([]);
    }
    setSessionsLoading(false);
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await apiService.post('/users/me/sessions/revoke', { sessionId });
      setSessionsList(prev => prev.filter(s => s.id !== sessionId));
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  };

  const revokeAllOtherSessions = async () => {
    try {
      await apiService.post('/users/me/sessions/revoke-all', {});
      setSessionsList(prev => prev.filter(s => s.isCurrent));
    } catch (err) {
      console.error('Failed to revoke sessions:', err);
    }
  };

  // ── Logout ──
  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
  };

  // ── Toggle switch component ──
  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <div
      onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
        background: checked ? '#7D1E2C' : '#ccc',
        position: 'relative', transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 10,
        background: '#fff', position: 'absolute', top: 2,
        left: checked ? 22 : 2, transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );

  // ── Shared styles (aligned with HTML design) ──
  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1.25rem 0', borderBottom: '1px solid #e0ddd6',
  };
  const labelStyle: React.CSSProperties = { fontSize: '13px', color: '#1a1a1a', fontWeight: 400 };
  const subLabel: React.CSSProperties = { fontSize: '11px', color: '#6a6a6a', marginTop: '3px' };
  const btnPrimary: React.CSSProperties = {
    background: '#7D1E2C', color: '#fff', border: 'none', padding: '13px 28px',
    fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'background 0.2s', fontFamily: "'Inter', sans-serif",
  };
  const btnOutline: React.CSSProperties = {
    background: 'transparent', color: '#1a1a1a', border: '1px solid #e0ddd6',
    padding: '13px 28px', fontSize: '11px', letterSpacing: '0.15em',
    textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
    fontFamily: "'Inter', sans-serif",
  };
  const btnDanger: React.CSSProperties = {
    background: '#c8102e', color: '#fff', border: 'none', padding: '13px 28px',
    fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', fontFamily: "'Inter', sans-serif",
  };
  const modalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(10,10,10,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  };
  const modalBox: React.CSSProperties = {
    background: '#fff', padding: '2.5rem', maxWidth: 480, width: '90%',
    border: '1px solid #e0ddd6',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e0ddd6',
    fontSize: '13px', marginBottom: '1rem', boxSizing: 'border-box',
    outline: 'none', fontFamily: "'Inter', sans-serif",
  };

  const panelLabels: Record<Panel, { icon: string; label: string }> = {
    notifications: { icon: '🔔', label: 'Notifications' },
    card: { icon: '💳', label: 'Experience Card' },
    privacy: { icon: '🔒', label: 'Privacy' },
    region: { icon: '🌍', label: 'Region' },
    security: { icon: '🛡️', label: 'Security' },
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 4rem', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', color: '#6a6a6a' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Page Header — matches all other pages */}
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#c8102e',
            marginBottom: '0.4rem',
          }}
        >
          account
        </div>
        <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem', color: '#1a1a1a' }}>
          Settings
        </h1>
        <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>
          Manage your notifications, card, privacy, and security preferences.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(200,16,46,0.06)', border: '1px solid rgba(200,16,46,0.15)', marginBottom: '1.5rem', fontSize: '13px', color: '#c8102e' }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: 'rgba(42,157,78,0.06)', border: '1px solid rgba(42,157,78,0.15)', marginBottom: '1.5rem', fontSize: '13px', color: '#2a9d4e' }}>
          {success}
        </div>
      )}

      {/* Layout — grid matching the HTML design with 1px gap borders */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
        }}
      >
        {/* Side navigation */}
        <div style={{ background: '#f0ede6', padding: '1.5rem 0' }}>
          {(Object.keys(panelLabels) as Panel[]).map((p) => (
            <div
              key={p}
              onClick={() => setActivePanel(p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 1.5rem',
                cursor: 'pointer',
                fontSize: '12px',
                letterSpacing: '0.05em',
                color: activePanel === p ? '#c8102e' : '#1a1a1a',
                fontWeight: activePanel === p ? 500 : 400,
                borderLeft: activePanel === p ? '3px solid #c8102e' : '3px solid transparent',
                background: activePanel === p ? 'rgba(200,16,46,0.04)' : 'transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (activePanel !== p) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
              }}
              onMouseLeave={(e) => {
                if (activePanel !== p) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ fontSize: '14px' }}>{panelLabels[p].icon}</span>
              {panelLabels[p].label}
            </div>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ background: '#fff', padding: '2rem' }}>
          {/* Panel title */}
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#1a1a1a',
              marginBottom: '1.5rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}
          >
            {panelLabels[activePanel].label}
          </div>

          {/* ═══ NOTIFICATIONS ═══ */}
          {activePanel === 'notifications' && (
            <div>
              {([
                ['emailNotifications', 'Email Notifications', 'Receive updates via email'],
                ['pushNotifications', 'Push Notifications', 'Browser push notifications'],
                ['productUpdates', 'Product Updates', 'Updates about your products'],
                ['communityAlerts', 'Community Alerts', 'Community activity alerts'],
              ] as const).map(([key, label, desc]) => (
                <div key={key} style={rowStyle}>
                  <div>
                    <div style={labelStyle}>{label}</div>
                    <div style={subLabel}>{desc}</div>
                  </div>
                  <ToggleSwitch checked={notifications[key]} onChange={() => toggleNotification(key)} />
                </div>
              ))}
              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ CARD ═══ */}
          {activePanel === 'card' && (
            <div>
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>Card ID</div>
                  <div style={subLabel}>{card.cardId || 'Not assigned'}</div>
                </div>
                <div style={{
                  fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase',
                  padding: '4px 12px',
                  background: card.isActive ? 'rgba(42,157,78,0.06)' : '#f0ede6',
                  border: card.isActive ? '1px solid rgba(42,157,78,0.2)' : '1px solid #e0ddd6',
                  color: card.isActive ? '#2a9d4e' : '#6a6a6a',
                }}>
                  {card.isActive ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>NFC</div>
                  <div style={subLabel}>Enable near-field communication</div>
                </div>
                <ToggleSwitch checked={card.nfcEnabled} onChange={() => toggleCard('nfcEnabled')} />
              </div>
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>Auto Login</div>
                  <div style={subLabel}>Log in automatically with your card</div>
                </div>
                <ToggleSwitch checked={card.autoLogin} onChange={() => toggleCard('autoLogin')} />
              </div>
              <div style={{ marginTop: '2rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  style={btnOutline}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}
                >
                  Request Replacement
                </button>
              </div>
            </div>
          )}

          {/* ═══ PRIVACY ═══ */}
          {activePanel === 'privacy' && (
            <div>
              {([
                ['dataSharing', 'Data Sharing', 'Share usage data to improve ZAI'],
                ['analytics', 'Analytics', 'Allow analytics tracking'],
                ['profileVisibility', 'Profile Visibility', 'Make your profile visible to others'],
                ['communityVisibility', 'Community Visibility', 'Appear in community lists'],
              ] as const).map(([key, label, desc]) => (
                <div key={key} style={rowStyle}>
                  <div>
                    <div style={labelStyle}>{label}</div>
                    <div style={subLabel}>{desc}</div>
                  </div>
                  <ToggleSwitch checked={privacy[key]} onChange={() => togglePrivacy(key)} />
                </div>
              ))}
              <div style={{ marginTop: '2rem' }}>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ═══ REGION ═══ */}
          {activePanel === 'region' && (
            <div>
              {[
                { label: 'Country', value: region.country },
                { label: 'Currency', value: region.currency },
                { label: 'Language', value: region.language },
              ].map((item, i) => (
                <div key={i} style={rowStyle}>
                  <div style={labelStyle}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: '#1a1a1a' }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ SECURITY ═══ */}
          {activePanel === 'security' && (
            <div>
              {/* Password */}
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>Password</div>
                  <div style={subLabel}>
                    {security.lastPasswordChange
                      ? `Last changed ${new Date(security.lastPasswordChange).toLocaleDateString()}`
                      : 'Never changed'}
                  </div>
                </div>
                <button
                  onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordForm({ current: '', newPass: '', confirm: '' }); }}
                  style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  Change
                </button>
              </div>

              {/* Two-Factor Authentication */}
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>Two-Factor Authentication</div>
                  <div style={subLabel}>
                    {security.twoFactorEnabled
                      ? `Enabled via ${security.twoFactorMethod}`
                      : 'Add an extra layer of security'}
                  </div>
                </div>
                {security.twoFactorEnabled ? (
                  <button
                    onClick={() => { setShowDisable2FAModal(true); setDisableCode(''); setDisableError(''); }}
                    style={btnOutline}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c8102e'; e.currentTarget.style.color = '#c8102e'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0ddd6'; e.currentTarget.style.color = '#1a1a1a'; }}
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowTwoFactorModal(true);
                      setTfaStep('choose');
                      setTfaCode('');
                      setTfaError('');
                      setTfaSecret('');
                      setTfaQrUrl('');
                    }}
                    style={btnPrimary}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                  >
                    Enable
                  </button>
                )}
              </div>

              {/* Active Sessions */}
              <div style={rowStyle}>
                <div>
                  <div style={labelStyle}>Active Sessions</div>
                  <div style={subLabel}>Manage your logged-in devices</div>
                </div>
                <button
                  onClick={openSessionsModal}
                  style={btnOutline}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}
                >
                  View
                </button>
              </div>

              {/* Logout */}
              <div style={{ ...rowStyle, borderBottom: 'none' }}>
                <div>
                  <div style={labelStyle}>Sign Out</div>
                  <div style={subLabel}>Log out of your current session</div>
                </div>
                <button onClick={() => setShowLogoutModal(true)} style={btnDanger}>
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* ── Password Modal ── */}
      {showPasswordModal && (
        <div style={modalOverlay} onClick={() => setShowPasswordModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: '#1a1a1a', marginBottom: '1.5rem', paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}>
              Change Password
            </div>
            {passwordError && (
              <div style={{ background: 'rgba(200,16,46,0.06)', color: '#c8102e', padding: '10px 14px', marginBottom: '1rem', fontSize: '12px', border: '1px solid rgba(200,16,46,0.15)' }}>
                {passwordError}
              </div>
            )}
            <label style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', display: 'block', marginBottom: '6px' }}>Current Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.current}
              onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
            />
            <label style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', display: 'block', marginBottom: '6px' }}>New Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.newPass}
              onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
            />
            <label style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6a6a6a', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                onClick={handlePasswordChange} disabled={passwordSaving}
                style={btnPrimary}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
              >
                {passwordSaving ? 'Saving...' : 'Update Password'}
              </button>
              <button
                onClick={() => setShowPasswordModal(false)}
                style={btnOutline}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2FA Enable Modal ── */}
      {showTwoFactorModal && (
        <div style={modalOverlay} onClick={() => setShowTwoFactorModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: '#1a1a1a', marginBottom: '1.5rem', paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}>
              {tfaStep === 'choose' && 'Enable Two-Factor Authentication'}
              {tfaStep === 'scan' && 'Scan QR Code'}
              {tfaStep === 'verify' && 'Verify Code'}
              {tfaStep === 'success' && '2FA Enabled'}
            </div>

            {tfaError && (
              <div style={{ background: 'rgba(200,16,46,0.06)', color: '#c8102e', padding: '10px 14px', marginBottom: '1rem', fontSize: '12px', border: '1px solid rgba(200,16,46,0.15)' }}>
                {tfaError}
              </div>
            )}

            {/* Step 1: Choose method */}
            {tfaStep === 'choose' && (
              <div>
                <div style={{ marginBottom: '1.5rem', fontSize: '13px', color: '#6a6a6a' }}>
                  Choose your preferred verification method.
                </div>
                <div
                  onClick={() => setTfaMethod('authenticator')}
                  style={{
                    padding: '1.25rem', border: `1px solid ${tfaMethod === 'authenticator' ? '#c8102e' : '#e0ddd6'}`,
                    marginBottom: '0.75rem', cursor: 'pointer', transition: 'border 0.2s',
                    background: tfaMethod === 'authenticator' ? 'rgba(200,16,46,0.03)' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '13px', color: '#1a1a1a' }}>Authenticator App</div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '4px' }}>
                    Use Google Authenticator, Authy, or any TOTP app
                  </div>
                </div>
                <div
                  onClick={() => setTfaMethod('email')}
                  style={{
                    padding: '1.25rem', border: `1px solid ${tfaMethod === 'email' ? '#c8102e' : '#e0ddd6'}`,
                    marginBottom: '1.5rem', cursor: 'pointer', transition: 'border 0.2s',
                    background: tfaMethod === 'email' ? 'rgba(200,16,46,0.03)' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '13px', color: '#1a1a1a' }}>Email Verification</div>
                  <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '4px' }}>
                    Receive a code via email each time you log in
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleSetup2FA} disabled={tfaLoading} style={btnPrimary}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}>
                    {tfaLoading ? 'Setting up...' : 'Continue'}
                  </button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnOutline}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Scan QR / view secret */}
            {tfaStep === 'scan' && (
              <div>
                {tfaMethod === 'authenticator' ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <img src={tfaQrUrl} alt="2FA QR Code" style={{ width: 200, height: 200 }} />
                    </div>
                    <div style={{ background: '#f0ede6', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid #e0ddd6' }}>
                      <div style={{ fontSize: '10px', color: '#6a6a6a', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                        Or enter this code manually
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 600, letterSpacing: '0.2em', wordBreak: 'break-all', color: '#1a1a1a' }}>
                        {tfaSecret}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
                    A verification code has been generated. In a production setup, this would be emailed to you.
                    For now, enter the code from your authenticator app using the secret below:
                    <div style={{ background: '#f0ede6', padding: '1rem', marginTop: '1rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '16px', fontWeight: 600, border: '1px solid #e0ddd6' }}>
                      {tfaSecret}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setTfaStep('verify')} style={btnPrimary}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}>
                    I've scanned it
                  </button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnOutline}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Verify code */}
            {tfaStep === 'verify' && (
              <div>
                <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
                  Enter the 6-digit code from your authenticator app to complete setup.
                </div>
                <input
                  type="text" maxLength={6} placeholder="000000"
                  value={tfaCode}
                  onChange={e => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    ...inputStyle,
                    textAlign: 'center', fontSize: '24px', fontFamily: 'monospace',
                    letterSpacing: '0.5em', fontWeight: 600,
                  }}
                />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={handleVerify2FA} disabled={tfaLoading} style={btnPrimary}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}>
                    {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button onClick={() => setTfaStep('scan')} style={btnOutline}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}>
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {tfaStep === 'success' && (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ width: '48px', height: '48px', margin: '0 auto 1rem', border: '2px solid #2a9d4e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', color: '#2a9d4e' }}>✓</div>
                <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                  Two-Factor Authentication Enabled
                </div>
                <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
                  Your account is now protected with an additional layer of security.
                </div>
                <button onClick={() => setShowTwoFactorModal(false)} style={btnPrimary}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2FA Disable Modal ── */}
      {showDisable2FAModal && (
        <div style={modalOverlay} onClick={() => setShowDisable2FAModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{
              fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase',
              color: '#1a1a1a', marginBottom: '1.5rem', paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0ddd6',
            }}>
              Disable Two-Factor Authentication
            </div>
            {disableError && (
              <div style={{ background: 'rgba(200,16,46,0.06)', color: '#c8102e', padding: '10px 14px', marginBottom: '1rem', fontSize: '12px', border: '1px solid rgba(200,16,46,0.15)' }}>
                {disableError}
              </div>
            )}
            <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
              Enter your current 6-digit verification code to disable 2FA.
            </div>
            <input
              type="text" maxLength={6} placeholder="000000"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                ...inputStyle,
                textAlign: 'center', fontSize: '24px', fontFamily: 'monospace',
                letterSpacing: '0.5em', fontWeight: 600,
              }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handleDisable2FA} disabled={disableLoading} style={btnDanger}>
                {disableLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
              <button onClick={() => setShowDisable2FAModal(false)} style={btnOutline}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions Modal ── */}
      {showSessionsModal && (
        <div style={modalOverlay} onClick={() => setShowSessionsModal(false)}>
          <div style={{ ...modalBox, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>
              <div style={{
                fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a',
              }}>
                Active Sessions
              </div>
              <button
                onClick={() => setShowSessionsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#6a6a6a' }}
              >✕</button>
            </div>
            {sessionsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6a6a6a', fontSize: '13px' }}>
                Loading sessions...
              </div>
            ) : sessionsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6a6a6a', fontSize: '13px' }}>
                No active sessions found
              </div>
            ) : (
              <>
                {sessionsList.map(session => (
                  <div key={session.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 0', borderBottom: '1px solid #e0ddd6',
                  }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: session.isCurrent ? 500 : 400, color: '#1a1a1a' }}>
                        {session.device} — {session.browser}
                        {session.isCurrent && (
                          <span style={{
                            background: 'rgba(42,157,78,0.06)', color: '#2a9d4e', fontSize: '9px',
                            padding: '2px 8px', marginLeft: '8px', textTransform: 'uppercase',
                            letterSpacing: '0.15em', border: '1px solid rgba(42,157,78,0.2)',
                          }}>
                            Current
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '4px' }}>
                        {session.ipAddress} · Last active {new Date(session.lastActive).toLocaleString()}
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession(session.id)}
                        style={{ ...btnOutline, padding: '6px 14px', fontSize: '10px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#c8102e'; e.currentTarget.style.color = '#c8102e'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0ddd6'; e.currentTarget.style.color = '#1a1a1a'; }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
                {sessionsList.filter(s => !s.isCurrent).length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <button onClick={revokeAllOtherSessions} style={btnDanger}>
                      Revoke All Other Sessions
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Logout Modal ── */}
      {showLogoutModal && (
        <div style={modalOverlay} onClick={() => setShowLogoutModal(false)}>
          <div style={{ ...modalBox, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '16px', fontWeight: 300, marginBottom: '0.75rem', color: '#1a1a1a' }}>Sign Out</div>
            <div style={{ fontSize: '13px', color: '#6a6a6a', marginBottom: '1.5rem' }}>
              Are you sure you want to log out of your account?
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={handleLogout} style={btnDanger}>Logout</button>
              <button onClick={() => setShowLogoutModal(false)} style={btnOutline}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#1a1a1a')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e0ddd6')}>
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
