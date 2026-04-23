import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWalletTwo } from '@oc-labs/wallettwo-sdk';
import { useAppContext } from '../../context/AppContext';
import Button from '../Common/Button';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user: walletUser } = useWalletTwo();
  const { user } = useAppContext();

  // Redirect authenticated users to dashboard
 // useEffect(() => {
  //  if (user && user.id) {
   //   // Only redirect if user exists AND we're not already on home
   //   const timer = setTimeout(() => {
   //     navigate('/dashboard', { replace: true });
   //   }, 500); // Small delay to allow page to render
   //   return () => clearTimeout(timer);
   // }
  //}, [user, navigate]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero Section */}
      <section
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.2) 100%), url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80") center/cover no-repeat',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '5rem 4rem 7rem',
          position: 'relative',
          color: '#ffffff',
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.5rem 3rem',
            zIndex: 3,
          }}
        >
          <div style={{ fontSize: '24px', fontWeight: 300, letterSpacing: '0.15em' }}>
            zai
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            Log In
          </Button>
        </div>

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px' }}>
          <div
            style={{
              fontSize: '13px',
              letterSpacing: '0.4em',
              textTransform: 'uppercase',
              color: '#c8102e',
              marginBottom: '1.5rem',
            }}
          >
            zai experience club
          </div>

          <h1
            style={{
              fontSize: 'clamp(52px, 6.5vw, 96px)',
              fontWeight: 200,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
              margin: 0,
            }}
          >
            Your world.
            <br />
            Beyond the
            <br />
            <span style={{ color: '#b8a06a' }}>mountain.</span>
          </h1>

          <p
            style={{
              color: '#999',
              fontSize: '17px',
              maxWidth: '480px',
              lineHeight: 1.8,
              marginBottom: '2rem',
              margin: '0 0 2rem',
            }}
          >
            More than ownership — a living connection to zai. Claim your products, earn your
            place, and unlock a world of events, rewards, and access built for those who live
            for the run.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              onClick={() => navigate('/products')}
            >
              Claim Your Product
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/events')}
            >
              See Events
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: '1px solid #1e1e1e',
            display: 'flex',
            zIndex: 2,
          }}
        >
          {[
            { num: '2003', label: 'Founded' },
            { num: '🏔️', label: 'Alpine Craft' },
            { num: '100%', label: 'Handcrafted' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                padding: '1.25rem',
                borderRight: i < 2 ? '1px solid #1e1e1e' : 'none',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '28px', fontWeight: 200, color: '#b8a06a' }}>
                {stat.num}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  color: '#555',
                  marginTop: '3px',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Your Key Section */}
      <section
        style={{
          background: '#f0ede6',
          padding: '5rem 4rem',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          <div>
            <div
              style={{
                fontSize: '11px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: '#c8102e',
                marginBottom: '0.75rem',
              }}
            >
              zai experience card
            </div>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.5vw, 40px)',
                fontWeight: 300,
                lineHeight: 1.15,
                marginBottom: '1rem',
                color: '#1a1a1a',
                margin: '0 0 1rem',
              }}
            >
              Your key to
              <br />
              everything zai
            </h2>
            <p
              style={{
                color: '#6a6a6a',
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '2rem',
              }}
            >
              Each zai product ships with a physical experience card — your passport to the zai
              ecosystem. With purchases over CHF 500, zai customers receive the exclusive zai
              Experience Card, equipped with an NFC tag.
            </p>

            {[1, 2, 3].map((num) => (
              <div key={num} style={{ display: 'flex', gap: '10px', marginBottom: '1rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    border: '1px solid #c8102e',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    color: '#c8102e',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {num}
                </div>
                <div style={{ fontSize: '12px', color: '#6a6a6a' }}>
                  {num === 1 && 'Receive your physical zai experience card with every purchase over CHF 500'}
                  {num === 2 && 'Tap the card with your NFC-enabled smartphone to activate instantly'}
                  {num === 3 && 'Access your portal and unlock exclusive privileges'}
                </div>
              </div>
            ))}
          </div>

          {/* Card Visual */}
          <div>
            <div
              style={{
                background: 'linear-gradient(135deg,#1a1a1a,#2a2a2a)',
                border: '1px solid #333',
                borderRadius: '14px',
                padding: '1.4rem 1.6rem',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                aspectRatio: '1.586',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: '36px',
                    height: '26px',
                    background: 'linear-gradient(135deg,#b8a06a,#8a7045)',
                    borderRadius: '4px',
                  }}
                />
                <div style={{ fontSize: '14px', fontWeight: 200, letterSpacing: '0.15em' }}>
                  zai <span style={{ color: '#b8a06a' }}>experience club</span>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: '8px',
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: '2px',
                    }}
                  >
                    Member
                  </div>
                  <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ANNA KIRCHNER
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ background: '#0a0a0a', padding: '5rem 4rem', color: '#ffffff' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#c8102e',
              marginBottom: '0.75rem',
            }}
          >
            how it works
          </div>
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              color: '#ffffff',
              margin: '0 0 3rem',
            }}
          >
            Get your zai
            <br />
            experience card
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1px',
              background: '#2a2a2a',
              border: '1px solid #2a2a2a',
            }}
          >
            {[
              { num: '01', title: 'Tap your experience card', desc: 'Tap your zai Experience Card with your phone and access the zai world after signing up.' },
              { num: '02', title: 'Select your purchased items', desc: 'Select your purchased zai items within the portal and access your zai Experience World.' },
              { num: '03', title: 'Unlock exclusive benefits', desc: 'Activate your free ski insurance, access exclusive events and more.' },
              { num: '04', title: 'Experience zai', desc: 'Join us at a zai ski event or come and visit us in our lab.' },
            ].map((step, i) => (
              <div
                key={i}
                style={{
                  background: '#1a1a1a',
                  padding: '2rem 1.5rem',
                }}
              >
                <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#c8102e', marginBottom: '1rem' }}>
                  Step {step.num}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '0.75rem', lineHeight: 1.4 }}>
                  {step.title}
                </div>
                <div style={{ fontSize: '12px', color: '#666', lineHeight: 1.8 }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ background: '#f0ede6', padding: '5rem 4rem', borderTop: '1px solid #e0ddd6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: '#c8102e',
              marginBottom: '0.75rem',
            }}
          >
            exclusive benefits
          </div>
          <h2
            style={{
              fontSize: 'clamp(24px, 3.5vw, 40px)',
              fontWeight: 300,
              lineHeight: 1.15,
              margin: '0 0 3rem',
              color: '#1a1a1a',
            }}
          >
            What you unlock
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1px',
              background: '#e0ddd6',
              border: '1px solid #e0ddd6',
            }}
          >
            {[
              { icon: '⭐', title: 'Free Ski Insurance', desc: 'Activate complimentary insurance on every new zai ski purchase' },
              { icon: '📅', title: 'Exclusive Events', desc: 'Priority access to ski demos, factory tours, and meet-and-greets' },
              { icon: '🎁', title: 'Mystery Box', desc: 'Each year, newly activated cards enter a draw for an exclusive weekend getaway' },
            ].map((benefit, i) => (
              <div key={i} style={{ background: '#ffffff', padding: '2rem' }}>
                <div style={{ fontSize: '24px', marginBottom: '1rem' }}>{benefit.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '0.5rem' }}>
                  {benefit.title}
                </div>
                <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.7 }}>
                  {benefit.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', color: '#ffffff', borderTop: '1px solid #2e2e2e', padding: '2.5rem 4rem 1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '1.25rem', borderBottom: '1px solid #2e2e2e' }}>
          <div style={{ fontSize: '14px', fontWeight: 200, letterSpacing: '0.2em', marginBottom: '1.25rem' }}>
            zai
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '3rem' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#444', marginBottom: '0.6rem' }}>
                Subscribe
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.querySelector('input') as HTMLInputElement);
                  if (input?.value) {
                    console.log('Newsletter signup:', input.value);
                    alert('Thank you for subscribing!');
                    input.value = '';
                  }
                }}
                style={{ display: 'flex', gap: 0, maxWidth: '280px', marginBottom: '1rem' }}
              >
                <input
                  type="email"
                  placeholder="Your email"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid #2a2a2a',
                    borderRight: 'none',
                    padding: '8px 12px',
                    fontSize: '11px',
                    color: '#ffffff',
                    fontFamily: "'Inter', sans-serif",
                    outline: 'none',
                  }}
                  required
                />
                <button
                  type="submit"
                  style={{
                    background: '#7D1E2C',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    fontSize: '10px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', fontSize: '10px', color: '#444' }}>
          <div>Pontresina, Alps · Since 2003</div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <a href="#" style={{ color: '#444', textDecoration: 'none' }}>Privacy</a>
            <a href="#" style={{ color: '#444', textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: '#444', textDecoration: 'none' }}>Legal</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
