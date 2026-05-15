import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import UserAvatar from '../Common/UserAvatar';
import { ZaiLogo } from '../Icons/LogoIcons';
import {
  HomeIcon,
  DashboardIcon,
  ProductsIcon,
  EventsIcon,
  CommunityIcon,
  ProfileIcon,
  SettingsIcon,
} from '../Icons/NavIcons';
import { LogoutButton } from '../Auth/LogoutButton';

const Sidebar: React.FC = () => {
  const { user } = useAppContext();
  const location = useLocation();
  const [communityNewCount, setCommunityNewCount] = useState(0);

  const isActive = (path: string) => location.pathname === path;

  // Check for new community photos from DB
  const checkCommunityUpdates = useCallback(async () => {
    if (!user) { setCommunityNewCount(0); return; }
    try {
      const res = await apiService.get('/community/notifications');
      if (res.data?.success) {
        setCommunityNewCount(res.data.data?.newCount || 0);
      }
    } catch {
      // silently fail
    }
  }, [user]);

  // Poll every 60s
  useEffect(() => {
    checkCommunityUpdates();
    const interval = setInterval(checkCommunityUpdates, 60000);
    return () => clearInterval(interval);
  }, [checkCommunityUpdates]);

  // When user visits /community, mark as seen in DB
  useEffect(() => {
    if (location.pathname === '/community' && user) {
      apiService.post('/community/notifications/seen').catch(() => {});
      setCommunityNewCount(0);
    }
  }, [location.pathname, user]);

  const navSections = [
    {
      section: 'Overview',
      items: [
        { path: '/', label: 'Home', icon: <HomeIcon /> },
        { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      ],
    },
    {
      section: 'My zai',
      items: [
        { path: '/products', label: 'My Products', icon: <ProductsIcon /> },
        { path: '/events', label: 'Events', icon: <EventsIcon /> },
        { path: '/community', label: 'Community', icon: <CommunityIcon />, badge: communityNewCount },
      ],
    },
    {
      section: 'Account',
      items: [
        { path: '/profile', label: 'Profile', icon: <ProfileIcon /> },
        { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '220px',
        height: '100vh',
        background: '#0a0a0a',
        borderRight: '1px solid #2a2a2a',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflowY: 'auto',
        color: '#f5f4f0',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ marginBottom: '0.4rem', color: '#f5f4f0' }}>
            <ZaiLogo size={60} />
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '4px' }}>
            experience club
        </div>
      </div>

      {/* User Profile */}
      {user && (
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserAvatar
            firstName={user.givenName || user.firstName}
            lastName={user.familyName || user.lastName}
            size="sm"
          />
          <div>
            <div style={{ fontSize: '12px', color: '#f5f4f0', fontWeight: 500 }}>
              {user.givenName || user.firstName || 'User'} {user.familyName || user.lastName || ''}
            </div>
            <div style={{ fontSize: '11px', color: '#b8a06a', letterSpacing: '0.1em', marginTop: '2px' }}>
              {user.role || 'member'}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ flex: 1, padding: '1.5rem 0' }}>
        {navSections.map((section, idx) => (
          <div key={idx} style={{ marginBottom: idx < navSections.length - 1 ? '1.5rem' : '0' }}>
            <div style={{ padding: '0.5rem 1.5rem', fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>
              {section.section}
            </div>
            {section.items.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: isActive(item.path) ? '#f5f4f0' : '#6a6a6a',
                  textDecoration: 'none',
                  fontSize: '13px',
                  letterSpacing: '0.05em',
                  borderLeft: isActive(item.path) ? '2px solid #c8102e' : '2px solid transparent',
                  background: isActive(item.path) ? 'rgba(255,255,255,0.05)' : 'transparent',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(item.path)) {
                    (e.currentTarget as HTMLAnchorElement).style.color = '#f5f4f0';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(item.path)) {
                    (e.currentTarget as HTMLAnchorElement).style.color = '#6a6a6a';
                    (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  }
                }}
              >
                <span style={{ display: 'flex', opacity: 0.7, width: '16px', height: '16px' }}>{item.icon}</span>
                <span>{item.label}</span>
                {'badge' in item && (item as any).badge > 0 && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      minWidth: '18px',
                      height: '18px',
                      borderRadius: '9px',
                      background: '#c8102e',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px',
                      lineHeight: 1,
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  >
                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </div>

      {/* Logout Button */}
      <div style={{ padding: '1rem', borderTop: '1px solid #2a2a2a', marginTop: 'auto', flexShrink: 0 }}>
        <LogoutButton />
      </div>

      {/* Footer */}
      <div style={{ padding: '1rem 1rem', borderTop: '1px solid #2a2a2a', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '0.5rem' }}>
          <svg width="11" height="9" viewBox="0 0 24 20" fill="none" style={{ flexShrink: 0 }}>
            <polyline points="1,19 7,7 12,13 16,5 23,19" stroke="#555" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '9px', color: '#555', letterSpacing: '0.05em' }}>Crafted in the Alps</span>
        </div>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.1); }
        }
      `}</style>
    </nav>
  );
};

export default Sidebar;
