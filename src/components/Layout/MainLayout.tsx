import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const MainLayout: React.FC = () => {
  const { user, setUser, setWalletState } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => setSidebarOpen(false), [location.pathname]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    setIsLoggingOut(true);
    
    // Create hidden logout iframe to properly disconnect from WalletTwo
    const companyId = import.meta.env.VITE_COMPANY_ID || 'zai';
    const logoutUrl = new URL('https://wallet.wallettwo.com/auth/login');
    logoutUrl.searchParams.append('action', 'logout');
    logoutUrl.searchParams.append('iframe', 'true');
    logoutUrl.searchParams.append('companyId', companyId);
    logoutUrl.searchParams.append('auto_accept', 'true');

    const logoutIframe = document.createElement('iframe');
    logoutIframe.id = 'wallettwo-logout-iframe';
    logoutIframe.src = logoutUrl.toString();
    logoutIframe.style.display = 'none';
    document.body.appendChild(logoutIframe);

    const logoutHandler = (event: MessageEvent) => {
      if (!event.origin.includes('wallettwo.com')) return;

      console.log('🚪 Logout event:', event.data);

      if (event.data.type === 'wallet_logout') {
        console.log('✅ WalletTwo logout confirmed');
        
        // Clear local state
        setUser(null);
        setWalletState({
          isConnected: false,
          address: undefined,
          token: null,
          isLoading: false,
          error: null,
        });

        // Clear storage
        localStorage.removeItem('zai_user');
        localStorage.removeItem('zai_token');

        // Clean up
        window.removeEventListener('message', logoutHandler);
        if (document.body.contains(logoutIframe)) {
          document.body.removeChild(logoutIframe);
        }

        // Redirect to home
        setTimeout(() => {
          navigate('/');
          setIsLoggingOut(false);
        }, 500);
      }
    };

    window.addEventListener('message', logoutHandler);

    // Fallback timeout - proceed with logout after 5 seconds regardless
    setTimeout(() => {
      window.removeEventListener('message', logoutHandler);
      if (document.body.contains(logoutIframe)) {
        document.body.removeChild(logoutIframe);
      }

      setUser(null);
      setWalletState({
        isConnected: false,
        address: undefined,
        token: null,
        isLoading: false,
        error: null,
      });

      localStorage.removeItem('zai_user');
      localStorage.removeItem('zai_token');

      navigate('/');
      setIsLoggingOut(false);
    }, 5000);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {sidebarOpen && isMobile && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
        />
      )}

      {/* SIDEBAR */}
      <nav
        style={{
          position: isMobile ? 'fixed' : 'sticky',
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
          transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
          transition: 'transform 0.3s ease',
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #2a2a2a' }}>
          <div style={{ fontSize: '18px', fontWeight: 300, letterSpacing: '0.15em' }}>
            zai
          </div>
        </div>

        {/* User Profile */}
        {user && (
          <div style={{ padding: '1rem', borderBottom: '1px solid #2a2a2a' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #b8a06a, #8a7045)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 500,
                marginBottom: '0.75rem',
              }}
            >
              {`${(user.firstName || 'U')[0]}${(user.lastName || '')[0] || ''}`}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 500 }}>{user.firstName || 'User'}</div>
            <div style={{ fontSize: '10px', color: '#b8a06a', marginTop: '2px' }}>
              {user.tier || 'member'}
            </div>
          </div>
        )}

        {/* Navigation Links */}
        <div style={{ flex: 1, padding: '1rem 0' }}>
          {[
            { path: '/', label: 'Home', icon: '🏠' },
            { path: '/dashboard', label: 'Dashboard', icon: '📊' },
            { path: '/products', label: 'Products', icon: '📦' },
            { path: '/events', label: 'Events', icon: '📅' },
            { path: '/community', label: 'Community', icon: '👥' },
            { path: '/profile', label: 'Profile', icon: '👤' },
            { path: '/settings', label: 'Settings', icon: '⚙️' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                color: isActive(item.path) ? '#b8a06a' : '#888',
                textDecoration: 'none',
                fontSize: '13px',
                borderLeft: isActive(item.path) ? '2px solid #b8a06a' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#b8a06a';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#888';
                }
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Logout Button at Bottom */}
        <div
          style={{
            padding: '1rem',
            borderTop: '1px solid #2a2a2a',
            marginTop: 'auto',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: isLoggingOut ? '#999' : '#c8102e',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              opacity: isLoggingOut ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoggingOut) {
                (e.currentTarget as HTMLButtonElement).style.background = '#a0071f';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoggingOut) {
                (e.currentTarget as HTMLButtonElement).style.background = '#c8102e';
              }
            }}
          >
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>

        {/* Footer Info */}
        <div
          style={{
            padding: '0.75rem 1rem',
            fontSize: '10px',
            color: '#555',
            borderTop: '1px solid #2a2a2a',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          Crafted in the Alps<br />Since 2003
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main
        style={{
          marginLeft: !isMobile ? '220px' : '0',
          flex: 1,
          minHeight: '100vh',
          background: '#f5f4f0',
          transition: 'margin-left 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isMobile && (
          <div
            style={{
              padding: '1rem',
              background: '#0a0a0a',
              borderBottom: '1px solid #2a2a2a',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              zIndex: 50,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: '#f5f4f0',
                fontSize: '24px',
                cursor: 'pointer',
              }}
            >
              ☰
            </button>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#f5f4f0' }}>zai</span>
          </div>
        )}

        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
