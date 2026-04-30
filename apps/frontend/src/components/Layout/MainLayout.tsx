import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import OnboardingWidget from '../Onboarding/OnboardingWidget';

const MainLayout: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => setSidebarOpen(false), [location.pathname]);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
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

      {/* Sidebar - hidden on mobile unless open */}
      <div
        style={{
          display: isMobile && !sidebarOpen ? 'none' : 'block',
          position: isMobile ? 'fixed' : 'relative',
          width: '220px',
          zIndex: 100,
        }}
      >
        <Sidebar />
      </div>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          minHeight: '100vh',
          background: '#f5f4f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Mobile header */}
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

        {/* Page content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </div>
      </main>

      {/* Onboarding Widget */}
      <OnboardingWidget />
    </div>
  );
};

export default MainLayout;
