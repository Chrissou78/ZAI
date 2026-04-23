import React, { useState } from 'react';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import Button from '../Common/Button';
import Tabs from '../Common/Tabs';

type SettingsPanel = 'notifications' | 'card' | 'privacy' | 'region' | 'security';

interface NotificationSettings {
  eventInvitations: boolean;
  membershipUpdates: boolean;
  productLaunches: boolean;
  partnerOffers: boolean;
  productUpdates: boolean;
  eventReminders: boolean;
}

const Settings: React.FC = () => {
  const { user } = useAppContext();
  const { logout } = useWalletAuth();
  const [activePanel, setActivePanel] = useState<SettingsPanel>('notifications');
  const [notifications, setNotifications] = useState<NotificationSettings>({
    eventInvitations: true,
    membershipUpdates: true,
    productLaunches: false,
    partnerOffers: false,
    productUpdates: true,
    eventReminders: true,
  });

  if (!user) return null;

  const handleToggle = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
    }
  };

  return (
    <div style={{ padding: '3rem 4rem 5rem' }}>
      {/* Header */}
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
                    onClick={() => handleToggle(setting.key as keyof NotificationSettings)}
                    style={{
                      width: '34px',
                      height: '18px',
                      background: notifications[setting.key as keyof NotificationSettings] ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
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
                    onClick={() => handleToggle(setting.key as keyof NotificationSettings)}
                    style={{
                      width: '34px',
                      height: '18px',
                      background: notifications[setting.key as keyof NotificationSettings] ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
                      transition: 'background 0.2s',
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
                    ZAI-2024 ···· 7823
                  </div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#4caf7d', marginTop: '3px' }}>
                    ● Active
                  </div>
                </div>
              </div>

              {[
                {
                  label: 'NFC card active',
                  desc: 'Enables contactless product claim and access',
                  value: 'Active',
                },
                { label: 'Auto-login on tap', desc: 'Tap card to log in without password', toggle: true },
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
                  {item.toggle && (
                    <button
                      style={{
                        width: '34px',
                        height: '18px',
                        background: '#c8102e',
                        borderRadius: '9px',
                        cursor: 'pointer',
                        border: 'none',
                        position: 'relative',
                      }}
                    >
                      <div style={{ position: 'absolute', width: '14px', height: '14px', background: 'white', borderRadius: '50%', top: '2px', right: '2px' }} />
                    </button>
                  )}
                  {item.button && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => alert('Card replacement requested')}
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
                }}
              >
                Data & Privacy
              </div>

              {[
                { label: 'Partner data sharing', desc: 'Allow partners to verify your membership', default: true },
                { label: 'Analytics', desc: 'Help improve zai experience club with anonymous usage data', default: false },
                { label: 'Profile visibility', desc: 'Show your membership to zai staff at events', default: true },
                { label: 'Be visible to other members', desc: 'Let other zai members find you in Community', default: false },
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
                  <button
                    style={{
                      width: '34px',
                      height: '18px',
                      background: item.default ? '#c8102e' : '#e0ddd6',
                      borderRadius: '9px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: 'none',
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
                        right: item.default ? '2px' : 'auto',
                        left: item.default ? 'auto' : '2px',
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
                }}
              >
                Region & Currency
              </div>

              {[
                { label: 'Account region', desc: 'Switzerland', value: '🇨🇭 CH' },
                { label: 'Currency', desc: 'Used for pricing and reward values', value: 'CHF' },
                { label: 'Language', desc: 'Portal display language', value: 'English' },
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
                      }}
                    >
                      <div style={{ position: 'absolute', width: '14px', height: '14px', background: 'white', borderRadius: '50%', top: '2px', left: '2px' }} />
                    </button>
                  )}
                  {item.action && (
                    <Button variant="ghost" size="sm">
                      {item.action}
                    </Button>
                  )}
                </div>
              ))}

              {/* Logout */}
              <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0ddd6' }}>
                <Button
                  variant="outline"
                  fullWidth
                  onClick={handleLogout}
                  style={{ background: 'transparent', color: '#c8102e', border: '1px solid #c8102e' }}
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
