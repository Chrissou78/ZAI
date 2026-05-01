import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import { apiService } from '../../services/api';
import Button from '../Common/Button';

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

  // Fetch settings on mount
  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.get('/users/me/settings');

      if (response.data?.success) {
        const settings = response.data.data;
        
        if (settings.notifications) {
          setNotifications(settings.notifications);
        }
        if (settings.privacy) {
          setPrivacy(settings.privacy);
        }
        if (settings.card) {
          setCard(settings.card);
        }
        if (settings.region) {
          setRegion(settings.region);
        }
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiService.put('/users/me/settings', {
        notifications,
        privacy,
        card,
        region,
      });

      if (response.data?.success) {
        setSuccessMessage('Settings saved successfully');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotificationToggle = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePrivacyToggle = (key: keyof PrivacySettings) => {
    setPrivacy((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCardToggle = (key: keyof CardSettings) => {
    setCard((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
    }
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
      <div
        style={{
          marginBottom: '2.5rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e0ddd6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div>
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
          <h1
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 0.3rem',
            }}
          >
            Settings
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: 0 }}>
            Manage notifications, privacy, and account preferences.
          </p>
        </div>
        {(activePanel !== 'region') && (
          <Button
            variant="primary"
            onClick={saveSettings}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div style={{ padding: '12px', background: '#fff5f5', border: '1px solid #ffdddd', color: '#c8102e', marginBottom: '1rem', borderRadius: '4px', fontSize: '12px' }}>
          {error}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '12px', background: '#f0faf4', border: '1px solid #b6e8cc', color: '#2a7a50', marginBottom: '1rem', borderRadius: '4px', fontSize: '12px' }}>
          {successMessage}
        </div>
      )}

      {/* Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: '1px',
          background: '#e0ddd6',
          border: '1px solid #e0ddd6',
        }}
      >
        {/* Nav */}
        <div style={{ background: '#f0ede6', padding: '1.5rem 0' }}>
          {(['notifications', 'card', 'privacy', 'region', 'security'] as const).map((panel) => (
            <button
              key={panel}
              onClick={() => setActivePanel(panel)}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                fontSize: '11px',
                letterSpacing: '0.08em',
                cursor: 'pointer',
                color: activePanel === panel ? '#1a1a1a' : '#6a6a6a',
                background: activePanel === panel ? '#e8e5de' : 'transparent',
                border: 'none',
                borderLeft: activePanel === panel ? '2px solid #c8102e' : '2px solid transparent',
                textAlign: 'left',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.2s',
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
          {/* Notifications */}
          {activePanel === 'notifications' && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                Email Notifications
              </div>

              {[
                { key: 'eventInvitations', label: 'Event invitations', desc: 'Upcoming events and exclusive invitations' },
                { key: 'membershipUpdates', label: 'Membership updates', desc: 'When your membership status changes' },
                { key: 'productLaunches', label: 'Product launches', desc: 'New zai products before public release' },
                { key: 'partnerOffers', label: 'Partner offers', desc: 'Exclusive offers from our ecosystem partners' },
              ].map((setting) => (
                <div
                  key={setting.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {setting.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {setting.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(setting.key as keyof NotificationSettings)}
                    style={{
                      width: '34px',
                      height: '18px',
                      background: notifications[setting.key as keyof NotificationSettings] ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        width: '14px',
                        height: '14px',
                        background: 'white',
                        borderRadius: '50%',
                        top: '2px',
                        right: notifications[setting.key as keyof NotificationSettings] ? '2px' : 'auto',
                        left: notifications[setting.key as keyof NotificationSettings] ? 'auto' : '2px',
                        transition: 'all 0.2s',
                      }}
                    />
                  </button>
                </div>
              ))}

              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  margin: '2rem 0 1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                Push Notifications
              </div>

              {[
                { key: 'productUpdates', label: 'Product updates', desc: 'Notifications about your registered products' },
                { key: 'eventReminders', label: 'Event reminders', desc: '48 hours before registered events' },
              ].map((setting) => (
                <div
                  key={setting.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {setting.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {setting.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => handleNotificationToggle(setting.key as keyof NotificationSettings)}
                    style={{
                      width: '34px',
                      height: '18px',
                      background: notifications[setting.key as keyof NotificationSettings] ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        width: '14px',
                        height: '14px',
                        background: 'white',
                        borderRadius: '50%',
                        top: '2px',
                        right: notifications[setting.key as keyof NotificationSettings] ? '2px' : 'auto',
                        left: notifications[setting.key as keyof NotificationSettings] ? 'auto' : '2px',
                        transition: 'all 0.2s',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Experience Card */}
          {activePanel === 'card' && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                NFC Experience Card
              </div>

              <div
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  borderRadius: '4px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '26px',
                    background: 'linear-gradient(135deg,#b8a06a,#8a7045)',
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                />
                <div style={{ color: '#ffffff' }}>
                  <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>
                    Card ID
                  </div>
                  <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#ffffff', fontFamily: 'monospace' }}>
                    {user.nfcCardId || 'ZAI-2024 ···· XXXX'}
                  </div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4caf7d', marginTop: '3px' }}>
                    ● {card.nfcActive ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>

              {[
                {
                  label: 'NFC card active',
                  desc: 'Enables contactless product claim and access',
                  value: card.nfcActive ? 'Active' : 'Inactive',
                },
                { label: 'Auto-login on tap', desc: 'Tap card to log in without password', toggle: true, key: 'autoLoginOnTap' },
                { label: 'Replace card', desc: 'Request a new card if yours is lost or damaged', button: true },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                  {item.value && (
                    <div style={{ fontSize: '11px', color: '#2a8a5a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {item.value}
                    </div>
                  )}
                  {item.toggle && item.key && (
                    <button
                      onClick={() => handleCardToggle(item.key as keyof CardSettings)}
                      style={{
                        width: '34px',
                        height: '18px',
                        background: card[item.key as keyof CardSettings] ? '#c8102e' : '#e0ddd6',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        border: 'none',
                        position: 'relative',
                        transition: 'background 0.2s',
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          width: '14px',
                          height: '14px',
                          background: 'white',
                          borderRadius: '50%',
                          top: '2px',
                          right: card[item.key as keyof CardSettings] ? '2px' : 'auto',
                          left: card[item.key as keyof CardSettings] ? 'auto' : '2px',
                          transition: 'all 0.2s',
                        }}
                      />
                    </button>
                  )}
                  {item.button && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleReplaceCard}
                      disabled={isSaving}
                    >
                      Request
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Privacy */}
          {activePanel === 'privacy' && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                Data & Privacy
              </div>

              {[
                { key: 'partnerDataSharing', label: 'Partner data sharing', desc: 'Allow partners to verify your membership' },
                { key: 'analytics', label: 'Analytics', desc: 'Help improve zai experience club with anonymous usage data' },
                { key: 'profileVisibility', label: 'Profile visibility', desc: 'Show your membership to zai staff at events' },
                { key: 'communityVisibility', label: 'Be visible to other members', desc: 'Let other zai members find you in Community' },
              ].map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                  <button
                    onClick={() => handlePrivacyToggle(item.key as keyof PrivacySettings)}
                    style={{
                      width: '34px',
                      height: '18px',
                      background: privacy[item.key as keyof PrivacySettings] ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        width: '14px',
                        height: '14px',
                        background: 'white',
                        borderRadius: '50%',
                        top: '2px',
                        right: privacy[item.key as keyof PrivacySettings] ? '2px' : 'auto',
                        left: privacy[item.key as keyof PrivacySettings] ? 'auto' : '2px',
                        transition: 'all 0.2s',
                      }}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Region & Currency */}
          {activePanel === 'region' && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                Region & Currency
              </div>

              {[
                { label: 'Account region', desc: 'Switzerland', value: region.country },
                { label: 'Currency', desc: 'Used for pricing and reward values', value: region.currency },
                { label: 'Language', desc: 'Portal display language', value: region.language },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#1a1a1a' }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security */}
          {activePanel === 'security' && (
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#1a1a1a',
                  marginBottom: '1rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e0ddd6',
                }}
              >
                Account Security
              </div>

              {[
                {
                  label: 'Change password',
                  desc: 'Last updated 3 months ago',
                  action: 'Update',
                },
                {
                  label: 'Two-factor authentication',
                  desc: 'Add an extra layer of security',
                  toggle: true,
                },
                {
                  label: 'Active sessions',
                  desc: '2 devices logged in',
                  action: 'Sign out others',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>
                      {item.desc}
                    </div>
                  </div>
                  {item.toggle && (
                    <button
                      style={{
                        width: '34px',
                        height: '18px',
                        background: '#e0ddd6',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        border: 'none',
                        position: 'relative',
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ position: 'absolute', width: '14px', height: '14px', background: 'white', borderRadius: '50%', top: '2px', left: '2px' }} />
                    </button>
                  )}
                  {item.action && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => alert(`${item.action} clicked`)}
                    >
                      {item.action}
                    </Button>
                  )}
                </div>
              ))}

              {/* Logout */}
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0ddd6' }}>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={handleLogout}
                  style={{ borderColor: '#c8102e', color: '#c8102e' }}
                >
                  Logout
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;