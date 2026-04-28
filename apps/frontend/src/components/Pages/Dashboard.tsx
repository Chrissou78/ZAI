import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAppContext();
  const [copiedWallet, setCopiedWallet] = useState(false);

  useEffect(() => {
    if (!user && !isLoading) {
      navigate('/');
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  const memberSince = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();

  const handleCopyWallet = () => {
    navigator.clipboard.writeText(user.wallet || '');
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  return (
    <div style={{ padding: '3rem 4rem 6rem', fontFamily: "'Inter', sans-serif" }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2.5rem', paddingBottom: '2rem', borderBottom: '1px solid #e0ddd6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#c8102e', marginBottom: '0.4rem' }}>overview</div>
          <h1 style={{ fontSize: '40px', fontWeight: 300, lineHeight: 1.15, margin: '0 0 0.3rem', color: '#1a1a1a' }}>Dashboard</h1>
          <p style={{ color: '#6a6a6a', fontSize: '13px', maxWidth: '520px', margin: '0.4rem 0 0' }}>Your zai experience club at a glance — points, products, and upcoming activity.</p>
        </div>
        <button style={{ background: '#7D1E2C', color: '#fff', border: 'none', padding: '13px 28px', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: "'Inter', sans-serif", transition: 'background 0.2s' }} onClick={() => navigate('/products')} onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')} onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}>Claim Product</button>
      </div>

      {/* Profile + Welcome */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', marginBottom: '1px' }}>
        <div style={{ background: '#f0ede6', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, #b8a06a, #8a7045)', border: '2px solid #b8a06a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '300', marginBottom: '1rem', color: '#fff' }}>
            {user.firstName?.[0]}{user.lastName?.[0]}
          </div>
          <div style={{ fontSize: '17px', fontWeight: 300, marginBottom: '2px' }}>
            {user.firstName} {user.lastName}
          </div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginBottom: '1.25rem' }}>
            {user.email} · {user.city || 'Location not set'}
          </div>
          <div style={{ fontSize: '10px', color: '#6a6a6a', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '4px', height: '4px', background: '#c8102e', borderRadius: '50%' }} />
            Member since {memberSince}
          </div>
        </div>

        <div style={{ background: '#1a1a1a', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', color: '#fff' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#555', marginBottom: '0.75rem' }}>Good to see you</div>
            <div style={{ fontSize: '28px', fontWeight: 200, lineHeight: 1.2, marginBottom: '1rem' }}>
              Welcome back,<br />
              <span style={{ color: '#b8a06a' }}>{user.firstName}.</span>
            </div>
            <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.8, maxWidth: '380px' }}>
              {user.verified ? '✓ Email verified · ' : ''}
              {user.address ? `${user.city}, ${user.country}` : 'Update your profile to complete verification'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 0, border: '1px solid #2a2a2a', marginTop: '1.5rem', width: 'fit-content' }}>
            <div style={{ padding: '1rem 1.5rem', borderRight: '1px solid #2a2a2a', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 200, color: '#b8a06a' }}>0</div>
              <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '2px' }}>Products</div>
            </div>
            <div style={{ padding: '1rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 200, color: '#fff' }}>0</div>
              <div style={{ fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '2px' }}>Events</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0, marginBottom: '1px' }}>
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>0</div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>Products claimed</div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>Get started by claiming a product</div>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem 1.25rem' }}>
          <div style={{ fontSize: '32px', fontWeight: 200, lineHeight: 1, color: '#1a1a1a' }}>0</div>
          <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6a6a6a', marginTop: '6px' }}>Events attended</div>
          <div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '2px' }}>Check upcoming events</div>
        </div>
      </div>

      {/* Activity + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', borderTop: 0 }}>
        <div style={{ background: '#fff', padding: '1.75rem' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>Profile information</div>
          <div style={{ fontSize: '12px', lineHeight: '2', color: '#6a6a6a' }}>
            <div><strong style={{ color: '#1a1a1a' }}>Email:</strong> {user.email}</div>
            <div><strong style={{ color: '#1a1a1a' }}>Phone:</strong> {user.phone || 'Not provided'}</div>
            <div><strong style={{ color: '#1a1a1a' }}>Address:</strong> {user.address || 'Not provided'}</div>
            
            {/* Wallet Address with Copy Button */}
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e0ddd6' }}>
              <strong style={{ color: '#1a1a1a' }}>Wallet Address:</strong>
              <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f4f0', padding: '0.5rem', borderRadius: '4px', flex: 1, wordBreak: 'break-all' }}>
                  {user.wallet}
                </span>
                <button
                  onClick={handleCopyWallet}
                  style={{
                    background: copiedWallet ? '#2ecc71' : '#b8a06a',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!copiedWallet) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#a0825f';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!copiedWallet) {
                      (e.currentTarget as HTMLButtonElement).style.background = '#b8a06a';
                    }
                  }}
                >
                  {copiedWallet ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <strong style={{ color: '#1a1a1a' }}>Verified:</strong> 
              <span style={{ marginLeft: '0.5rem', color: user.verified ? '#2ecc71' : '#e74c3c' }}>
                {user.verified ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ background: '#f0ede6', padding: '1.75rem' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#1a1a1a', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e0ddd6' }}>Quick actions</div>
          {[{ icon: '📦', title: 'Claim a product', sub: 'NFC or serial number', page: '/products' }, { icon: '📅', title: 'Browse events', sub: 'See upcoming events', page: '/events' }].map((action, i) => (
            <div key={i} onClick={() => navigate(action.page)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.9rem 0', borderBottom: i === 0 ? '1px solid #e0ddd6' : 'none', cursor: 'pointer' }}>
              <div style={{ width: '32px', height: '32px', background: '#fff', border: '1px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '16px' }}>{action.icon}</div>
              <div style={{ flex: 1 }}><div style={{ fontSize: '12px', fontWeight: 500 }}>{action.title}</div><div style={{ fontSize: '11px', color: '#6a6a6a', marginTop: '1px' }}>{action.sub}</div></div>
              <div style={{ marginLeft: 'auto', color: '#6a6a6a', fontSize: '14px' }}>›</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
