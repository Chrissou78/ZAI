import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useWalletAuth } from '../../hooks/useWalletAuth';
import Button from '../Common/Button';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const { logout } = useWalletAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', items: [
      { icon: '🏠', label: 'Home', path: '/dashboard' },
    ]},
    { id: 'my-zai', label: 'My zai', items: [
      { icon: '📦', label: 'My Products', path: '/products' },
      { icon: '📅', label: 'Events', path: '/events' },
      { icon: '👥', label: 'Community', path: '/community' },
    ]},
    { id: 'account', label: 'Account', items: [
      { icon: '👤', label: 'Profile', path: '/profile' },
      { icon: '⚙️', label: 'Settings', path: '/settings' },
    ]},
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
      navigate('/');
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav
        style={{
          width: '220px',
          background: '#0a0a0a',
          borderRight: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          color: '#ffffff',
          position: 'fixed',
          height: '100vh',
          overflowY: 'auto',
          left: sidebarOpen ? 0 : '-220px',
          transition: 'left 0.3s',
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '0.15em' }}>
            zai
          </div>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.35em',
              textTransform: 'uppercase',
              color: '#555',
              marginTop: '4px',
            }}
          >
            experience club
          </div>
        </div>

        {/* User Info */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
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
            }}
          >
            {user?.firstName[0]}{user?.lastName[0]}
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 500 }}>
              {user?.firstName}
            </div>
            <div style={{ fontSize: '10px', color: '#b8a06a', letterSpacing: '0.1em' }}>
              {user?.tier.toUpperCase()}
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <div style={{ flex: 1, padding: '1rem 0' }}>
          {navItems.map((section) => (
            <div key={section.id}>
              <div
                style={{
                  padding: '0.5rem 1.5rem',
                  fontSize: '11px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: '#444',
                  marginTop: section.id !== navItems[0].id ? '0.5rem' : 0,
                }}
              >
                {section.label}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.65rem 1.5rem',
                    cursor: 'pointer',
                    background: 'transparent',
                    border: 'none',
                    color: '#6a6a6a',
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s',
                    borderLeft: '2px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#6a6a6a';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #2a2a2a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#444', marginBottom: '1rem' }}>
            <svg width="12" height="10" viewBox="0 0 24 20" fill="none">
              <polyline points="1,19 7,7 12,13 16,5 23,19" stroke="#555" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>Crafted in the Alps</span>
          </div>
          <Button
            variant="ghost"
            fullWidth
            onClick={handleLogout}
            style={{ fontSize: '10px' }}
          >
            Logout
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ marginLeft: '220px', flex: 1, background: '#f5f4f0' }}>
        {/* Header */}
        <div
          style={{
            background: '#ffffff',
            borderBottom: '1px solid #e0ddd6',
            padding: '1.5rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'sticky',
            top: 0,
            zIndex: 50,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#1a1a1a',
            }}
          >
            ≡
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#1a1a1a',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#f0ede6',
                border: '1px solid #e0ddd6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 500,
              }}
            >
              {user?.firstName[0]}{user?.lastName[0]}
            </div>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e0ddd6',
                  borderRadius: '4px',
                  minWidth: '160px',
                  marginTop: '0.5rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                <button
                  onClick={() => navigate('/profile')}
                  style={{
                    width: '100%',
                    padding: '10px 1rem',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  View Profile
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  style={{
                    width: '100%',
                    padding: '10px 1rem',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e0ddd6',
                  }}
                >
                  Settings
                </button>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    padding: '10px 1rem',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: '#c8102e',
                  }}
                >
                  Logout
                </button>
              </div>
            )}
          </button>
        </div>

        {/* Page Content */}
        <div style={{ background: '#f5f4f0', minHeight: 'calc(100vh - 80px)' }}>
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 99,
            display: window.innerWidth > 900 ? 'none' : 'block',
          }}
        />
      )}
    </div>
  );
};

export default MainLayout;
