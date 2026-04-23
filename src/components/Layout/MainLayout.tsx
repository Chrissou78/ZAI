import React from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const MainLayout: React.FC = () => {
  const { user } = useAppContext();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* SIDENAV */}
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
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Logo Section */}
        <div style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <svg width="80" height="25" viewBox="0 0 110 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip-nav-logo)">
                <path d="M24.4032 15.5546C24.4032 14.215 25.4329 13.1253 26.7025 13.1253H32.6908C33.9604 13.1253 34.9901 14.215 34.9901 15.5546V19.4435C34.9901 20.7831 33.9604 21.8728 32.6908 21.8728H26.7025C25.4329 21.8728 24.4032 20.7831 24.4032 19.4435V15.5546ZM12.6665 2.29837C12.6665 1.02873 13.6962 -0.000976562 14.9658 -0.000976562H20.0344C21.304 -0.000976562 22.3337 1.02873 22.3337 2.29837V32.6897C22.3337 33.9593 21.304 34.989 20.0344 34.989H14.9658C13.6962 34.989 12.6665 33.9593 12.6665 32.6897V2.29837ZM0.00012207 21.8728L3.00926 16.3144C3.28918 15.8045 3.09924 15.3946 2.58938 15.3946H0.00012207C0.0201164 14.135 1.03983 13.1253 2.29947 13.1253H10.5871V13.1553L7.54797 18.7537C7.26805 19.2635 7.45799 19.6734 7.96785 19.6734H10.5871C10.5271 20.8931 9.5274 21.8728 8.28776 21.8728H0.00012207Z" fill="#f5f4f0"/>
                <path d="M63.7822 31.2694H52.0256C51.5457 31.2694 51.2758 31.1395 50.9259 30.7796C50.4461 30.2497 50.3961 29.5499 50.746 28.9701L60.9631 13.6445H52.0256C51.1858 13.6445 50.526 12.9447 50.576 12.1049C50.576 11.3151 51.2358 10.6953 52.0256 10.6953H63.7822C64.2221 10.6953 64.482 10.7853 64.8419 11.1352C65.3718 11.625 65.4118 12.3648 65.0219 12.9847L54.6748 28.3103H63.7922C64.582 28.3103 65.2418 29.0201 65.2418 29.8099C65.2418 30.5996 64.582 31.2594 63.7922 31.2594" fill="#f5f4f0"/>
                <path d="M86.1055 22.4627H78.7476C77.468 22.4627 77.298 24.1322 77.298 25.4119C77.298 26.6915 77.478 28.321 78.7476 28.321H86.1055V22.4627ZM88.7048 30.7803C88.3949 31.1302 88.045 31.2702 87.5551 31.2702H78.7476C75.8884 31.2702 74.3489 28.281 74.3489 25.4119C74.3489 22.5427 75.8884 19.5135 78.7476 19.5135H86.1055V16.6044C86.1055 15.7246 85.8456 15.1048 85.2258 14.495C84.6059 13.8751 84.0361 13.6552 83.1564 13.6552H77.298C76.5083 13.6552 75.7985 12.9954 75.7985 12.2056C75.7985 11.4159 76.5083 10.7061 77.298 10.7061H83.1564C84.8759 10.7061 86.1055 11.1459 87.3452 12.3756C88.5748 13.6052 89.0147 14.8449 89.0147 16.6044V29.8106C89.0147 30.1605 88.9247 30.4704 88.7048 30.7803Z" fill="#f5f4f0"/>
                <path d="M106.279 3.39661C106.279 0.887328 109.978 0.887328 109.978 3.39661C109.978 5.90589 106.279 5.86591 106.279 3.39661ZM108.129 31.2687C107.339 31.2687 106.679 30.6088 106.679 29.8191V13.7437H100.161C99.2413 13.7437 98.5715 13.3438 98.4015 12.644C98.1316 11.5443 98.9713 10.7545 99.7211 10.7545C99.7211 10.7545 107.739 10.7145 108.129 10.7145C108.918 10.7145 109.578 11.4143 109.578 12.2141V29.8291C109.578 30.6188 108.918 31.2786 108.129 31.2786" fill="#f5f4f0"/>
              </g>
              <defs>
                <clipPath id="clip-nav-logo">
                  <rect width="109.979" height="35" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </div>
          <div style={{ fontSize: '11px', letterSpacing: '0.35em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '4px' }}>
            experience club
          </div>
        </div>

        {/* User Section */}
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#2e2e2e',
            border: '1px solid #b8a06a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            color: '#b8a06a',
            flexShrink: 0,
          }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div>
            <div style={{ fontSize: '12px', color: '#f5f4f0', fontWeight: 500 }}>
              {user?.firstName} {user?.lastName}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0' }}>
          {/* Overview Section */}
          <div style={{ padding: '0.5rem 1.5rem', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555' }}>
            Overview
          </div>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>🏠</span> Home
          </Link>
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/dashboard') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/dashboard') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/dashboard') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>📊</span> Dashboard
          </Link>

          {/* My zai Section */}
          <div style={{ padding: '0.5rem 1.5rem 0.5rem', marginTop: '1rem', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555' }}>
            My zai
          </div>
          <Link to="/products" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/products') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/products') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/products') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>🛍️</span> My Products
          </Link>
          <Link to="/events" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/events') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/events') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/events') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>📅</span> Events
          </Link>
          <Link to="/community" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/community') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/community') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/community') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>👥</span> Community
          </Link>

          {/* Account Section */}
          <div style={{ padding: '0.5rem 1.5rem 0.5rem', marginTop: '1rem', fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555' }}>
            Account
          </div>
          <Link to="/profile" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/profile') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/profile') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/profile') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>👤</span> Profile
          </Link>
          <Link to="/settings" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.65rem 1.5rem', color: isActive('/settings') ? '#f5f4f0' : '#6a6a6a', textDecoration: 'none', fontSize: '12px', letterSpacing: '0.05em', borderLeft: isActive('/settings') ? '2px solid #c8102e' : '2px solid transparent', backgroundColor: isActive('/settings') ? 'rgba(255,255,255,0.05)' : 'transparent', transition: 'all 0.2s' }}>
            <span>⚙️</span> Settings
          </Link>
        </nav>

        {/* Footer */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #2a2a2a', fontSize: '11px', color: '#555', display: 'flex', alignItems: 'center', gap: '6px' }}>
          ▲ Crafted in the Alps
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', background: '#f5f4f0' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;