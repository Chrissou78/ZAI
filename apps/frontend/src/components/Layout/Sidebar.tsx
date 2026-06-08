import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';
import UserAvatar from '../Common/UserAvatar';
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

/* ── Derive a clean display name from user fields ── */
function getDisplayName(user: any): { first: string; last: string; display: string } {
  const first = (user?.givenName || user?.firstName || '').trim();
  const last = (user?.familyName || user?.lastName || '').trim();
  if (first || last) {
    return { first, last, display: [first, last].filter(Boolean).join(' ') };
  }
  // Fallback: extract from email
  const emailLocal = (user?.email || '').split('@')[0] || '';
  const parts = emailLocal.replace(/[._-]/g, ' ').split(' ').filter(Boolean);
  const fallbackFirst = parts[0] ? parts[0][0].toUpperCase() + parts[0].slice(1) : '';
  const fallbackLast = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : '';
  return {
    first: fallbackFirst,
    last: fallbackLast,
    display: [fallbackFirst, fallbackLast].filter(Boolean).join(' ') || user?.email || 'User',
  };
}

const Sidebar: React.FC = () => {
  const { user } = useAppContext();
  const location = useLocation();
  const [communityNewCount, setCommunityNewCount] = useState(0);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [hasExperienceCard, setHasExperienceCard] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const isAdminUser = user?.role === 'admin' || user?.role === 'owner';

  // ── Experience card detection ──
  useEffect(() => {
    const check = () => {
      const stored = localStorage.getItem('zai_experience_card');
      setHasExperienceCard(!!stored && stored !== 'null' && stored !== 'undefined');
    };
    check();

    // Listen for updates from Dashboard / Products page
    const handler = () => check();
    window.addEventListener('zai:experience-card-updated', handler);
    window.addEventListener('storage', handler);

    // Also poll localStorage in case the event was missed
    const interval = setInterval(check, 3000);

    return () => {
      window.removeEventListener('zai:experience-card-updated', handler);
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, []);

  // Admins always see everything
  const showExclusive = hasExperienceCard || isAdminUser;

  const checkCommunityUpdates = useCallback(async () => {
    if (!user || !showExclusive) { setCommunityNewCount(0); return; }
    try {
      const res = await apiService.get('/community/notifications');
      if (res.data?.success) {
        setCommunityNewCount(res.data.data?.newCount || 0);
      }
    } catch {
      // silently fail
    }
  }, [user, showExclusive]);

  useEffect(() => {
    checkCommunityUpdates();
    const interval = setInterval(checkCommunityUpdates, 60000);
    return () => clearInterval(interval);
  }, [checkCommunityUpdates]);

  useEffect(() => {
    if (location.pathname === '/community' && user) {
      apiService.post('/community/notifications/seen').catch(() => {});
      setCommunityNewCount(0);
    }
  }, [location.pathname, user]);

  // ── Admin pending claims polling ──
  const checkAdminUpdates = useCallback(async () => {
    if (!user || !isAdminUser) { setAdminPendingCount(0); return; }
    try {
      const res = await apiService.get('/products/admin/pending-count');
      if (res.data?.success) {
        setAdminPendingCount((res.data as any).count ?? (res.data as any).data?.count ?? 0);
      }
    } catch {
      // silently fail
    }
  }, [user, isAdminUser]);

  useEffect(() => {
    checkAdminUpdates();
    const interval = setInterval(checkAdminUpdates, 60000);
    return () => clearInterval(interval);
  }, [checkAdminUpdates]);

  useEffect(() => {
    if (location.pathname === '/admin' && user) {
      setAdminPendingCount(0);
    }
  }, [location.pathname, user]);

  // ── Derive display name ──
  const { first, last, display: displayName } = user ? getDisplayName(user) : { first: '', last: '', display: '' };

  const navSections = [
    {
      section: 'Overview',
      items: [
        { path: '/', label: 'Home', icon: <HomeIcon /> },
        { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
      ],
    },
    // ── zai Exclusive — only for experience card holders + admins ──
    ...(showExclusive ? [{
      section: 'zai Exclusive',
      items: [
        { path: '/products', label: 'My Collection', icon: <ProductsIcon /> },
        { path: '/events', label: 'Events', icon: <EventsIcon /> },
        { path: '/community', label: 'Community', icon: <CommunityIcon />, badge: communityNewCount },
      ],
    }] : []),
    {
      section: 'Account',
      items: [
        { path: '/profile', label: 'Profile', icon: <ProfileIcon /> },
        { path: '/settings', label: 'Settings', icon: <SettingsIcon /> },
      ],
    },
    // ── Admin section — only visible to admin/owner ──
    ...(isAdminUser ? [{
      section: 'Admin',
      items: [
        { path: '/admin', label: 'Claim Requests', icon: <ProductsIcon />, badge: adminPendingCount },
      ],
    }] : []),
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '250px',
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
      {/* Logo — text only "zai", left-aligned */}
      <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a2a2a' }}>
        <svg width="60" height="28" viewBox="48 0 62 35" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M63.7822 31.2694H52.0256C51.5457 31.2694 51.2758 31.1395 50.9259 30.7796C50.4461 30.2497 50.3961 29.5499 50.746 28.9701L60.9631 13.6445H52.0256C51.1858 13.6445 50.526 12.9447 50.576 12.1049C50.576 11.3151 51.2358 10.6953 52.0256 10.6953H63.7822C64.2221 10.6953 64.482 10.7853 64.8419 11.1352C65.3718 11.625 65.4118 12.3648 65.0219 12.9847L54.6748 28.3103H63.7922C64.582 28.3103 65.2418 29.0201 65.2418 29.8099C65.2418 30.5996 64.582 31.2594 63.7922 31.2594" fill="#f5f4f0"/>
          <path d="M86.1055 22.4627H78.7476C77.468 22.4627 77.298 24.1322 77.298 25.4119C77.298 26.6915 77.478 28.321 78.7476 28.321H86.1055V22.4627ZM88.7048 30.7803C88.3949 31.1302 88.045 31.2702 87.5551 31.2702H78.7476C75.8884 31.2702 74.3489 28.281 74.3489 25.4119C74.3489 22.5427 75.8884 19.5135 78.7476 19.5135H86.1055V16.6044C86.1055 15.7246 85.8456 15.1048 85.2258 14.495C84.6059 13.8751 84.0361 13.6552 83.1564 13.6552H77.298C76.5083 13.6552 75.7985 12.9954 75.7985 12.2056C75.7985 11.4159 76.5083 10.7061 77.298 10.7061H83.1564C84.8759 10.7061 86.1055 11.1459 87.3452 12.3756C88.5748 13.6052 89.0147 14.8449 89.0147 16.6044V29.8106C89.0147 30.1605 88.9247 30.4704 88.7048 30.7803Z" fill="#f5f4f0"/>
          <path d="M106.279 3.39661C106.279 0.887328 109.978 0.887328 109.978 3.39661C109.978 5.90589 106.279 5.86591 106.279 3.39661ZM108.129 31.2687C107.339 31.2687 106.679 30.6088 106.679 29.8191V13.7437H100.161C99.2413 13.7437 98.5715 13.3438 98.4015 12.644C98.1316 11.5443 98.9713 10.7545 99.7211 10.7545C99.7211 10.7545 107.739 10.7145 108.129 10.7145C108.918 10.7145 109.578 11.4143 109.578 12.2141V29.8291C109.578 30.6188 108.918 31.2786 108.129 31.2786" fill="#f5f4f0"/>
        </svg>
        <div style={{
          fontSize: '11px',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          color: '#6a6a6a',
          marginTop: '2px',
        }}>
          experience club
        </div>
      </div>

      {/* User Profile */}
      {user && (
        <div style={{
          padding: '0.6rem 1.5rem',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <UserAvatar
            firstName={first}
            lastName={last}
            size="sm"
          />
          <div>
            <div style={{ fontSize: '12px', color: '#f5f4f0', fontWeight: 500 }}>
              {displayName}
            </div>
            {/* Tier label */}
            <div style={{
              fontSize: '9px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: isAdminUser ? '#7A222E' : hasExperienceCard ? '#7A222E' : '#555',
              fontWeight: 600,
              marginTop: '2px',
            }}>
              {isAdminUser ? user.role : hasExperienceCard ? 'exclusive member' : 'member'}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ flex: 1, padding: '0.75rem 0' }}>
        {navSections.map((section, idx) => (
          <div key={idx} style={{ marginBottom: idx < navSections.length - 1 ? '1rem' : '0' }}>
            <div style={{
              padding: '0.7rem 1.5rem',
              fontSize: '12px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#555',
              marginBottom: '1rem',
            }}>
              {section.section}
            </div>
            {section.items.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.5rem 1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    color: active ? '#f5f4f0' : '#6a6a6a',
                    textDecoration: 'none',
                    fontSize: '14px',
                    letterSpacing: '0.05em',
                    borderLeft: active ? '2px solid #7A222E' : '2px solid transparent',
                    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                    position: 'relative',
                    boxShadow: active
                      ? 'none'
                      : 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.25)',
                    textShadow: active
                      ? 'none'
                      : '0 1px 2px rgba(0,0,0,0.4)',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = '#f5f4f0';
                      el.style.background = 'rgba(255,255,255,0.04)';
                      el.style.boxShadow = 'inset 0 0 0 rgba(0,0,0,0), 0 2px 8px rgba(0,0,0,0.35)';
                      el.style.textShadow = 'none';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      const el = e.currentTarget as HTMLAnchorElement;
                      el.style.color = '#6a6a6a';
                      el.style.background = 'transparent';
                      el.style.boxShadow = 'inset 0 -1px 0 rgba(255,255,255,0.04), 0 1px 3px rgba(0,0,0,0.25)';
                      el.style.textShadow = '0 1px 2px rgba(0,0,0,0.4)';
                    }
                  }}
                >
                  <span style={{
                    display: 'flex',
                    opacity: active ? 0.9 : 0.5,
                    width: '16px',
                    height: '16px',
                    transition: 'opacity 0.25s ease',
                    filter: active ? 'none' : 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
                  }}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {'badge' in item && (item as any).badge > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '9px',
                        background: '#7A222E',
                        color: '#fff',
                        fontSize: '10px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                        lineHeight: 1,
                        animation: 'pulse 2s ease-in-out infinite',
                        boxShadow: '0 0 6px rgba(200,16,46,0.5)',
                      }}
                    >
                      {(item as any).badge > 9 ? '9+' : (item as any).badge}
                    </span>
                  )}
                </Link>
              );
            })}
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
          <svg width="13" height="13" viewBox="0 0 24 20" fill="none" style={{ flexShrink: 0 }}>
            <polyline points="1,19 7,7 12,13 16,5 23,19" stroke="#555" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '11px', color: '#555', letterSpacing: '0.05em' }}>Crafted in the Alps</span>
        </div>
      </div>

      {/* Animations */}
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
