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

  // ── Shared styles ──
  const sectionTitle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1.5rem',
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 0', borderBottom: '1px solid #f0ede6',
  };
  const labelStyle: React.CSSProperties = { fontSize: 14, color: '#1a1a1a' };
  const subLabel: React.CSSProperties = { fontSize: 12, color: '#8a8a8a', marginTop: 2 };
  const btnPrimary: React.CSSProperties = {
    background: '#7D1E2C', color: '#fff', border: 'none', padding: '10px 24px',
    fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', transition: 'background 0.2s',
  };
  const btnOutline: React.CSSProperties = {
    background: 'transparent', color: '#7D1E2C', border: '1px solid #7D1E2C',
    padding: '10px 24px', fontSize: 11, letterSpacing: '0.15em',
    textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.2s',
  };
  const btnDanger: React.CSSProperties = {
    background: '#c0392b', color: '#fff', border: 'none', padding: '10px 24px',
    fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer',
  };
  const modalOverlay: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(2px)',
  };
  const modalBox: React.CSSProperties = {
    background: '#fff', padding: '2rem', maxWidth: 480, width: '90%',
    boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e0ddd6',
    fontSize: 14, marginBottom: '1rem', boxSizing: 'border-box',
    outline: 'none',
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: '#8a8a8a' }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', padding: '2rem', maxWidth: 960 }}>
      {/* ── Side navigation ── */}
      <div style={{ minWidth: 180 }}>
        <div style={{ ...sectionTitle, marginBottom: '1rem' }}>Settings</div>
        {(['notifications', 'card', 'privacy', 'region', 'security'] as Panel[]).map(p => (
          <div
            key={p}
            onClick={() => setActivePanel(p)}
            style={{
              padding: '10px 16px', cursor: 'pointer', fontSize: 13,
              textTransform: 'capitalize', marginBottom: 2,
              background: activePanel === p ? '#f0ede6' : 'transparent',
              color: activePanel === p ? '#7D1E2C' : '#1a1a1a',
              fontWeight: activePanel === p ? 600 : 400,
              transition: 'all 0.2s',
            }}
          >
            {p}
          </div>
        ))}
      </div>

      {/* ── Panel content ── */}
      <div style={{ flex: 1 }}>
        {error && (
          <div style={{ background: '#fef0f0', color: '#8a1a1a', padding: '12px 16px', marginBottom: '1rem', fontSize: 13 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#f0faf4', color: '#1a5c3a', padding: '12px 16px', marginBottom: '1rem', fontSize: 13 }}>
            {success}
          </div>
        )}

        {/* ═══ NOTIFICATIONS ═══ */}
        {activePanel === 'notifications' && (
          <div>
            <div style={sectionTitle}>Notifications</div>
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
              <button onClick={saveSettings} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ CARD ═══ */}
        {activePanel === 'card' && (
          <div>
            <div style={sectionTitle}>Card</div>
            <div style={rowStyle}>
              <div>
                <div style={labelStyle}>Card ID</div>
                <div style={subLabel}>{card.cardId || 'Not assigned'}</div>
              </div>
              <span style={{ fontSize: 12, color: card.isActive ? '#1a5c3a' : '#8a8a8a' }}>
                {card.isActive ? 'Active' : 'Inactive'}
              </span>
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
            <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
              <button onClick={saveSettings} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button style={btnOutline}>Request Replacement</button>
            </div>
          </div>
        )}

        {/* ═══ PRIVACY ═══ */}
        {activePanel === 'privacy' && (
          <div>
            <div style={sectionTitle}>Privacy</div>
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
              <button onClick={saveSettings} disabled={saving} style={btnPrimary}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* ═══ REGION ═══ */}
        {activePanel === 'region' && (
          <div>
            <div style={sectionTitle}>Region</div>
            <div style={rowStyle}>
              <div style={labelStyle}>Country</div>
              <div style={{ fontSize: 14, color: '#444' }}>{region.country}</div>
            </div>
            <div style={rowStyle}>
              <div style={labelStyle}>Currency</div>
              <div style={{ fontSize: 14, color: '#444' }}>{region.currency}</div>
            </div>
            <div style={rowStyle}>
              <div style={labelStyle}>Language</div>
              <div style={{ fontSize: 14, color: '#444' }}>{region.language}</div>
            </div>
          </div>
        )}

        {/* ═══ SECURITY ═══ */}
        {activePanel === 'security' && (
          <div>
            <div style={sectionTitle}>Security</div>

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
              <button onClick={() => { setShowPasswordModal(true); setPasswordError(''); setPasswordForm({ current: '', newPass: '', confirm: '' }); }} style={btnPrimary}>
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
              <button onClick={openSessionsModal} style={btnOutline}>
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

      {/* ═══════════════════════ MODALS ═══════════════════════ */}

      {/* ── Password Modal ── */}
      {showPasswordModal && (
        <div style={modalOverlay} onClick={() => setShowPasswordModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ ...sectionTitle, marginBottom: '1.5rem' }}>Change Password</div>
            {passwordError && (
              <div style={{ background: '#fef0f0', color: '#8a1a1a', padding: '10px 14px', marginBottom: '1rem', fontSize: 13 }}>
                {passwordError}
              </div>
            )}
            <label style={{ fontSize: 12, color: '#8a8a8a', display: 'block', marginBottom: 4 }}>Current Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.current}
              onChange={e => setPasswordForm(p => ({ ...p, current: e.target.value }))}
            />
            <label style={{ fontSize: 12, color: '#8a8a8a', display: 'block', marginBottom: 4 }}>New Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.newPass}
              onChange={e => setPasswordForm(p => ({ ...p, newPass: e.target.value }))}
            />
            <label style={{ fontSize: 12, color: '#8a8a8a', display: 'block', marginBottom: 4 }}>Confirm New Password</label>
            <input
              type="password" style={inputStyle}
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button onClick={handlePasswordChange} disabled={passwordSaving} style={btnPrimary}>
                {passwordSaving ? 'Saving...' : 'Update Password'}
              </button>
              <button onClick={() => setShowPasswordModal(false)} style={btnOutline}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2FA Enable Modal ── */}
      {showTwoFactorModal && (
        <div style={modalOverlay} onClick={() => setShowTwoFactorModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ ...sectionTitle, marginBottom: '1.5rem' }}>
              {tfaStep === 'choose' && 'Enable Two-Factor Authentication'}
              {tfaStep === 'scan' && 'Scan QR Code'}
              {tfaStep === 'verify' && 'Verify Code'}
              {tfaStep === 'success' && '2FA Enabled'}
            </div>

            {tfaError && (
              <div style={{ background: '#fef0f0', color: '#8a1a1a', padding: '10px 14px', marginBottom: '1rem', fontSize: 13 }}>
                {tfaError}
              </div>
            )}

            {/* Step 1: Choose method */}
            {tfaStep === 'choose' && (
              <div>
                <div style={{ marginBottom: '1.5rem', fontSize: 13, color: '#666' }}>
                  Choose your preferred verification method.
                </div>
                <div
                  onClick={() => setTfaMethod('authenticator')}
                  style={{
                    padding: '1rem', border: `2px solid ${tfaMethod === 'authenticator' ? '#7D1E2C' : '#e0ddd6'}`,
                    marginBottom: '0.75rem', cursor: 'pointer', transition: 'border 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Authenticator App</div>
                  <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 4 }}>
                    Use Google Authenticator, Authy, or any TOTP app
                  </div>
                </div>
                <div
                  onClick={() => setTfaMethod('email')}
                  style={{
                    padding: '1rem', border: `2px solid ${tfaMethod === 'email' ? '#7D1E2C' : '#e0ddd6'}`,
                    marginBottom: '1.5rem', cursor: 'pointer', transition: 'border 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Email Verification</div>
                  <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 4 }}>
                    Receive a code via email each time you log in
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleSetup2FA} disabled={tfaLoading} style={btnPrimary}>
                    {tfaLoading ? 'Setting up...' : 'Continue'}
                  </button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnOutline}>Cancel</button>
                </div>
              </div>
            )}

            {/* Step 2: Scan QR / view secret */}
            {tfaStep === 'scan' && (
              <div>
                {tfaMethod === 'authenticator' ? (
                  <>
                    <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
                      Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                      <img src={tfaQrUrl} alt="2FA QR Code" style={{ width: 200, height: 200 }} />
                    </div>
                    <div style={{ background: '#f9f8f5', padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#8a8a8a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Or enter this code manually
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, letterSpacing: '0.2em', wordBreak: 'break-all' }}>
                        {tfaSecret}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
                    A verification code has been generated. In a production setup, this would be emailed to you.
                    For now, enter the code from your authenticator app using the secret below:
                    <div style={{ background: '#f9f8f5', padding: '1rem', marginTop: '1rem', textAlign: 'center', fontFamily: 'monospace', fontSize: 16, fontWeight: 600 }}>
                      {tfaSecret}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={() => setTfaStep('verify')} style={btnPrimary}>I've scanned it</button>
                  <button onClick={() => setShowTwoFactorModal(false)} style={btnOutline}>Cancel</button>
                </div>
              </div>
            )}

            {/* Step 3: Verify code */}
            {tfaStep === 'verify' && (
              <div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
                  Enter the 6-digit code from your authenticator app to complete setup.
                </div>
                <input
                  type="text" maxLength={6} placeholder="000000"
                  value={tfaCode}
                  onChange={e => setTfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{
                    ...inputStyle,
                    textAlign: 'center', fontSize: 24, fontFamily: 'monospace',
                    letterSpacing: '0.5em', fontWeight: 600,
                  }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button onClick={handleVerify2FA} disabled={tfaLoading} style={btnPrimary}>
                    {tfaLoading ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                  <button onClick={() => setTfaStep('scan')} style={btnOutline}>Back</button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {tfaStep === 'success' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: '1rem' }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: '0.5rem' }}>
                  Two-Factor Authentication Enabled
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
                  Your account is now protected with an additional layer of security.
                </div>
                <button onClick={() => setShowTwoFactorModal(false)} style={btnPrimary}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 2FA Disable Modal ── */}
      {showDisable2FAModal && (
        <div style={modalOverlay} onClick={() => setShowDisable2FAModal(false)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ ...sectionTitle, marginBottom: '1.5rem' }}>Disable Two-Factor Authentication</div>
            {disableError && (
              <div style={{ background: '#fef0f0', color: '#8a1a1a', padding: '10px 14px', marginBottom: '1rem', fontSize: 13 }}>
                {disableError}
              </div>
            )}
            <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
              Enter your current 6-digit verification code to disable 2FA.
            </div>
            <input
              type="text" maxLength={6} placeholder="000000"
              value={disableCode}
              onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{
                ...inputStyle,
                textAlign: 'center', fontSize: 24, fontFamily: 'monospace',
                letterSpacing: '0.5em', fontWeight: 600,
              }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={handleDisable2FA} disabled={disableLoading} style={btnDanger}>
                {disableLoading ? 'Disabling...' : 'Disable 2FA'}
              </button>
              <button onClick={() => setShowDisable2FAModal(false)} style={btnOutline}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sessions Modal ── */}
      {showSessionsModal && (
        <div style={modalOverlay} onClick={() => setShowSessionsModal(false)}>
          <div style={{ ...modalBox, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={sectionTitle}>Active Sessions</div>
              <button
                onClick={() => setShowSessionsModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#8a8a8a' }}
              >✕</button>
            </div>
            {sessionsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8a8a8a', fontSize: 13 }}>
                Loading sessions...
              </div>
            ) : sessionsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#8a8a8a', fontSize: 13 }}>
                No active sessions found
              </div>
            ) : (
              <>
                {sessionsList.map(session => (
                  <div key={session.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '1rem 0', borderBottom: '1px solid #f0ede6',
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: session.isCurrent ? 600 : 400 }}>
                        {session.device} — {session.browser}
                        {session.isCurrent && (
                          <span style={{
                            background: '#f0faf4', color: '#1a5c3a', fontSize: 10,
                            padding: '2px 8px', marginLeft: 8, textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                          }}>
                            Current
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#8a8a8a', marginTop: 4 }}>
                        {session.ipAddress} · Last active {new Date(session.lastActive).toLocaleString()}
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <button
                        onClick={() => revokeSession(session.id)}
                        style={{ ...btnOutline, padding: '6px 14px', fontSize: 10 }}
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
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: '0.75rem' }}>Sign Out</div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: '1.5rem' }}>
              Are you sure you want to log out of your account?
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button onClick={handleLogout} style={btnDanger}>Logout</button>
              <button onClick={() => setShowLogoutModal(false)} style={btnOutline}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
