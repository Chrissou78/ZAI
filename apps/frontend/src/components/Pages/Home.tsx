import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarIcon, CalendarIcon, LocationIcon, MountainIcon } from '../Icons/BenefitIcons';
import { ZaiLogo, ZaiMark, InstagramIcon, FacebookIcon, LinkedInIcon, YouTubeIcon, WhatsAppIcon } from '../Icons/LogoIcons';
import { WalletConnectButton } from '../Auth/WalletConnectButton';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

/* ── Locked-feature tooltip (hover) ── */
const LockedTooltip: React.FC<{
  children: React.ReactNode;
  locked: boolean;
  message?: string;
  dark?: boolean;
}> = ({ children, locked, message, dark = true }) => {
  const [hover, setHover] = useState(false);

  if (!locked) return <>{children}</>;

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Greyed-out content */}
      <div style={{ opacity: 0.35, pointerEvents: 'none', filter: 'grayscale(80%)' }}>
        {children}
      </div>
      {/* Lock overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
            borderRadius: 8,
            padding: '6px 14px',
          }}
        >
          <span style={{ fontSize: 14 }}>🔒</span>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              fontWeight: 600,
              color: '#c9a84c',
              textTransform: 'uppercase',
            }}
          >
            Exclusive
          </span>
        </div>
      </div>
      {/* Tooltip bubble */}
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: dark ? '#1a1a1a' : '#fff',
            border: '1px solid #c9a84c',
            borderRadius: 8,
            padding: '10px 16px',
            zIndex: 100,
            minWidth: 240,
            maxWidth: 300,
            textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: dark ? '#f5f4f0' : '#1a1a1a',
              lineHeight: 1.6,
            }}
          >
            {message || 'Access exclusive content with the Experience Card membership.'}
          </div>
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              marginLeft: -6,
              width: 12,
              height: 12,
              background: dark ? '#1a1a1a' : '#fff',
              border: '1px solid #c9a84c',
              borderTop: 'none',
              borderLeft: 'none',
              transform: 'rotate(45deg)',
            }}
          />
        </div>
      )}
    </div>
  );
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppContext();
  const [hasExperienceCard, setHasExperienceCard] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  useEffect(() => {
    if (!user?.id || isAdmin) return; // admins are exclusive already; skip the probe
    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiService.get(`/products/user/${user.id}`);
        if (!cancelled && res.data?.success) {
          const products = res.data.data || [];
          const EC_NAMES = ['experience card'];
          setHasExperienceCard(
            products.some((p: any) =>
              EC_NAMES.some((n) => (p.name || '').toLowerCase().includes(n))
            )
          );
        }
      } catch { /* ignore */ }
    };
    check();
    return () => { cancelled = true; };
  }, [user?.id, isAdmin]);

  const exclusive = hasExperienceCard || isAdmin;

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100vh' }}>
      {/* Hero Section */}
      <section
        style={{
          minHeight: '100vh',
          background: 'url(/images/hero-bg.jpg) center center / cover no-repeat',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '4rem',
          position: 'relative' as const,
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'start',
            padding: '2rem 3rem',
            zIndex: 3,
          }}
        >
          <div />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', paddingTop: '0.5rem' }}>
            <ZaiMark size={72} color="#ffffff" />
            <svg width="50" height="24" viewBox="48 0 62 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M63.7822 31.2694H52.0256C51.5457 31.2694 51.2758 31.1395 50.9259 30.7796C50.4461 30.2497 50.3961 29.5499 50.746 28.9701L60.9631 13.6445H52.0256C51.1858 13.6445 50.526 12.9447 50.576 12.1049C50.576 11.3151 51.2358 10.6953 52.0256 10.6953H63.7822C64.2221 10.6953 64.482 10.7853 64.8419 11.1352C65.3718 11.625 65.4118 12.3648 65.0219 12.9847L54.6748 28.3103H63.7922C64.582 28.3103 65.2418 29.0201 65.2418 29.8099C65.2418 30.5996 64.582 31.2594 63.7922 31.2594" fill="#f5f4f0"/>
              <path d="M86.1055 22.4627H78.7476C77.468 22.4627 77.298 24.1322 77.298 25.4119C77.298 26.6915 77.478 28.321 78.7476 28.321H86.1055V22.4627ZM88.7048 30.7803C88.3949 31.1302 88.045 31.2702 87.5551 31.2702H78.7476C75.8884 31.2702 74.3489 28.281 74.3489 25.4119C74.3489 22.5427 75.8884 19.5135 78.7476 19.5135H86.1055V16.6044C86.1055 15.7246 85.8456 15.1048 85.2258 14.495C84.6059 13.8751 84.0361 13.6552 83.1564 13.6552H77.298C76.5083 13.6552 75.7985 12.9954 75.7985 12.2056C75.7985 11.4159 76.5083 10.7061 77.298 10.7061H83.1564C84.8759 10.7061 86.1055 11.1459 87.3452 12.3756C88.5748 13.6052 89.0147 14.8449 89.0147 16.6044V29.8106C89.0147 30.1605 88.9247 30.4704 88.7048 30.7803Z" fill="#f5f4f0"/>
              <path d="M106.279 3.39661C106.279 0.887328 109.978 0.887328 109.978 3.39661C109.978 5.90589 106.279 5.86591 106.279 3.39661ZM108.129 31.2687C107.339 31.2687 106.679 30.6088 106.679 29.8191V13.7437H100.161C99.2413 13.7437 98.5715 13.3438 98.4015 12.644C98.1316 11.5443 98.9713 10.7545 99.7211 10.7545C99.7211 10.7545 107.739 10.7145 108.129 10.7145C108.918 10.7145 109.578 11.4143 109.578 12.2141V29.8291C109.578 30.6188 108.918 31.2786 108.129 31.2786" fill="#f5f4f0"/>
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <WalletConnectButton />
          </div>
        </div>

        {/* Overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.2) 100%)',
            zIndex: 1,
          }}
        />

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px' }}>
          <div style={{ fontSize: '22px', letterSpacing: '0.3em', color: '#fdfdfd', marginBottom: '1.5rem' }}>
            zai Experience Club
          </div>
          <h1 style={{ fontSize: 'clamp(60px, 6.5vw, 96px)', fontWeight: 300, lineHeight: 1.05, letterSpacing: '-0.02em', marginBottom: '1.5rem', color: '#fff' }}>
            Your world.<br />Beyond the<br /><span style={{ color: '#f5f4f0' }}>mountain.</span>
          </h1>
          <p style={{ color: '#999', fontSize: '18px', maxWidth: '900px', lineHeight: 1.8, marginBottom: '2rem' }}>
            Welcome to zai Experience Club. Claim your products, sign up for zai events, and <br />
            manage your personal zai ski collection all in one place. The zai Experience Club <br />
            makes zai more personal, more interactive, and closer than ever!
          </p>
          {user && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <LockedTooltip locked={!exclusive} message="Claim your zai Experience Card to unlock product claims and your personal collection.">
                <button
                  onClick={() => navigate('/products')}
                  style={{
                    background: '#7D1E2C',
                    color: '#fff',
                    border: 'none',
                    padding: '13px 28px',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  Claim Your Product
                </button>
              </LockedTooltip>
              <LockedTooltip locked={!exclusive} message="Access exclusive zai events with the Experience Card membership.">
                <button
                  onClick={() => navigate('/events')}
                  style={{
                    background: 'transparent',
                    color: '#fff',
                    border: '1px solid #444',
                    padding: '12px 28px',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fff')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#444')}
                >
                  See Events
                </button>
              </LockedTooltip>
            </div>
          )}
        </div>

        {/* Hero Stats */}
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
          <div style={{ flex: 1, padding: '1.25rem', borderRight: '1px solid #1e1e1e', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: '#f5f4f0', height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              2003
            </div>
            <div style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '3px' }}>
              Founded
            </div>
          </div>
          <div style={{ flex: 1, padding: '1.25rem', borderRight: '1px solid #1e1e1e', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: '#f5f4f0', height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <MountainIcon />
            </div>
            <div style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '3px' }}>
              Alpine Craft
            </div>
          </div>
          <div style={{ flex: 1, padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 200, color: '#f5f4f0', height: '38px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              100%
            </div>
            <div style={{ fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', marginTop: '3px' }}>
              Handcrafted
            </div>
          </div>
        </div>
      </section>

      {/* Zai Experience Card Section */}
      <section style={{ background: '#f0ede6', padding: '5rem 4rem', borderTop: '1px solid #e0ddd6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5rem', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.75rem' }}>
              zai experience card
            </div>
            <div style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, marginBottom: '1rem', color: '#1a1a1a' }}>
              Your key to<br />everything zai
            </div>
            <p style={{ color: '#6a6a6a', fontSize: '14px', lineHeight: 1.8, marginBottom: '2rem' }}>
              Each zai product ships with a physical experience card — your passport to the zai ecosystem. Our dealers and boutiques remain our customers' primary contact. With purchases over CHF 500, zai customers receive the exclusive zai Experience Card, equipped with an NFC tag.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { num: 1, text: 'Receive your physical zai experience card with every purchase over CHF 500' },
                { num: 2, text: 'Tap the card with your NFC-enabled smartphone to activate instantly' },
                { num: 3, text: 'Access your portal and unlock exclusive privileges' },
              ].map((step) => (
                <div key={step.num} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', border: '1px solid #7A222E', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#7A222E', flexShrink: 0, marginTop: '2px' }}>
                    {step.num}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6a6a6a' }}>{step.text}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Experience Card */}
          <div style={{ background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)', border: '1px solid #333', borderRadius: '14px', padding: '1.4rem 1.6rem', position: 'relative', overflow: 'hidden', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', aspectRatio: '1.586' }}>
            <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(200,16,46,0.15), transparent 70%)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '36px', height: '26px', background: 'linear-gradient(135deg, #888, #555)', borderRadius: '4px' }} />
              <div style={{ fontSize: '14px', fontWeight: 200, letterSpacing: '0.15em' }}>
                zai <span style={{ color: '#f5f4f0' }}>experience club</span>
              </div>
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
              ZAI-2024 •••• 7823
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '8px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '2px' }}>
                  Member
                </div>
                <div style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ANNA KIRCHNER</div>
              </div>
            </div>
            <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '3px', background: 'linear-gradient(90deg, #7A222E, transparent)' }} />
          </div>
        </div>
        <div style={{ marginTop: '0.75rem', fontSize: '10px', color: '#6a6a6a', display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '900px', margin: '0.75rem auto 0' }}>
          <div style={{ width: '4px', height: '4px', background: '#7A222E', borderRadius: '50%' }} />
          Available for purchases over CHF 500
        </div>
      </section>

      {/* How It Works Section */}
      <section style={{ background: '#0a0a0a', padding: '5rem 4rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.75rem' }}>
            how it works
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, color: '#fff', marginBottom: '3rem' }}>
            Get your zai<br />experience card
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: '#2a2a2a', border: '1px solid #2a2a2a' }}>
            {[
              { num: 'Step 01', title: 'Tap your experience card with your phone', desc: 'Tap your zai Experience Card with your phone and access the zai world after signing up. By successfully claiming your card as a new client, you will have the chance to win a weekend getaway for two, revealed through a mystery box, each year.' },
              { num: 'Step 02', title: 'Select your purchased items and get access', desc: 'Select your purchased zai items within the portal and access your zai Experience World to view exclusive benefits and track your collection.' },
              { num: 'Step 03', title: 'Unlock exclusive benefits', desc: 'Activate your free ski insurance, access exclusive events — skiing experiences, factory tours, quarry visits, personal meet-and-greets, and more. Additional benefits revealed over time.' },
              { num: 'Step 04', title: 'Experience zai', desc: 'Join us at a zai ski event to test our ski collection or come and visit us in our lab to experience the zai spirit.' },
            ].map((step, i) => (
              <div key={i} style={{ background: '#1a1a1a', padding: '2rem 1.5rem' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: '#7A222E', marginBottom: '1rem', fontWeight: 500 }}>
                  {step.num}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#fff', marginBottom: '0.75rem', lineHeight: 1.4 }}>
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

      {/* Benefits Section */}
      <section style={{ background: '#f0ede6', padding: '5rem 4rem', borderTop: '1px solid #e0ddd6' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.75rem' }}>
            exclusive benefits
          </div>
          <div style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, marginBottom: '1rem', color: '#1a1a1a' }}>
            What you unlock
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: '#e0ddd6', border: '1px solid #e0ddd6', marginTop: '3rem' }}>
            <div style={{ background: '#fff', padding: '2rem', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
              <div style={{ width: '36px', height: '36px', border: '1px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <StarIcon />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                Free Ski Insurance
              </div>
              <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.7 }}>
                Activate complimentary insurance on every new zai ski purchase directly through your portal.
              </div>
            </div>
            <div style={{ background: '#fff', padding: '2rem', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
              <div style={{ width: '36px', height: '36px', border: '1px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <CalendarIcon />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                Exclusive Events
              </div>
              <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.7 }}>
                Priority access to ski demos, factory tours, quarry visits, and personal meet-and-greets.
              </div>
            </div>
            <div style={{ background: '#fff', padding: '2rem', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#f0ede6')} onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}>
              <div style={{ width: '36px', height: '36px', border: '1px solid #e0ddd6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <LocationIcon />
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '0.5rem', color: '#1a1a1a' }}>
                Mystery Box
              </div>
              <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.7 }}>
                Each year, newly activated cards enter a draw for an exclusive weekend getaway for two.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Zai Ecosystem Section */}
      <section style={{ background: '#0a0a0a', padding: '5rem 4rem', borderTop: '1px solid #2a2a2a' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#7A222E', marginBottom: '0.75rem' }}>
            zai ecosystem
          </div>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 300, lineHeight: 1.15, color: '#fff', marginBottom: '1rem' }}>
            Partners &amp; Community
          </h2>
          <p style={{ color: '#666', fontSize: '14px', lineHeight: 1.8, maxWidth: '580px', marginBottom: '2.5rem' }}>
            The zai ecosystem brings together exclusive brand partners and a global community of zai owners — connected through a shared passion for the mountain. Partners will be revealed soon. Join the community to share your experiences.
          </p>
          <div style={{ display: 'flex', gap: '1px', background: '#1e1e1e', border: '1px solid #1e1e1e', marginBottom: '2rem' }}>
            {['Mountain Pass', 'Destination', 'Financial', 'Mountain Pass', 'Destination'].map((label, i) => (
              <div key={i} style={{ flex: 1, background: '#1a1a1a', padding: '2rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px)' }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.35, position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '22px', color: '#555', letterSpacing: '4px' }}>■</div>
                  <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#555' }}>
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '1.25rem 0', borderTop: '1px solid #333' }}>
            <div style={{ width: '5px', height: '5px', background: '#7A222E', borderRadius: '50%', flexShrink: 0 }} />
            <span style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#555', whiteSpace: 'nowrap' }}>Partners to be announced</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, #333, transparent)' }} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', color: '#fff', borderTop: '1px solid #2e2e2e', padding: '2.5rem 4rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #2e2e2e', flexWrap: 'wrap', marginBottom: '1.25rem', maxWidth: '1200px', margin: '0 auto 1.25rem' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 200, letterSpacing: '0.2em', marginBottom: '1.25rem', color: '#f5f4f0' }}>
              <ZaiLogo size={48} color="#333" />
            </div>
            <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#555', marginBottom: '0.6rem' }}>
              Subscribe to our newsletter
            </div>
            <div style={{ display: 'flex', gap: '0', maxWidth: '280px' }}>
              <input
                type="email"
                placeholder="Your email address"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #2a2a2a',
                  borderRight: 'none',
                  padding: '8px 12px',
                  fontSize: '11px',
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  outline: 'none',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
              />
              <button
                onClick={() => alert('Subscribed!')}
                style={{
                  background: '#7D1E2C',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 14px',
                  fontSize: '10px',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.2s',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
              >
                Subscribe
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#444', marginBottom: '0.6rem' }}>
                Explore
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <a href="#" style={{ fontSize: '11px', color: '#555', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>Shop</a>
                <a href="#" style={{ fontSize: '11px', color: '#555', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>Dealers</a>
                <a href="#" style={{ fontSize: '11px', color: '#555', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>Contact</a>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#444', marginBottom: '0.6rem' }}>
                Follow
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  { href: 'https://instagram.com/zaiski', title: 'Instagram', icon: <InstagramIcon /> },
                  { href: 'https://facebook.com/zaiski', title: 'Facebook', icon: <FacebookIcon /> },
                  { href: 'https://linkedin.com/company/zai-ski', title: 'LinkedIn', icon: <LinkedInIcon /> },
                  { href: 'https://youtube.com/@zaiski', title: 'YouTube', icon: <YouTubeIcon /> },
                  { href: 'https://wa.me/zaiski', title: 'WhatsApp', icon: <WhatsAppIcon /> },
                ].map((social) => (
                  <a
                    key={social.title}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.title}
                    style={{ width: '30px', height: '30px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', textDecoration: 'none', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#555'; (e.currentTarget as HTMLAnchorElement).style.color = '#fff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2a2a2a'; (e.currentTarget as HTMLAnchorElement).style.color = '#555'; }}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', maxWidth: '1200px', margin: '0 auto', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#444' }}>
            <svg width="12" height="10" viewBox="0 0 24 20" fill="none" style={{ flexShrink: 0 }}>
              <polyline points="1,19 7,7 12,13 16,5 23,19" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
            <span>Pontresina, Alps · Since 2003</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            <a href="#" style={{ fontSize: '10px', color: '#444', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#888')} onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}>Privacy Policy</a>
            <a href="#" style={{ fontSize: '10px', color: '#444', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#888')} onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}>Terms &amp; Conditions</a>
            <a href="#" style={{ fontSize: '10px', color: '#444', textDecoration: 'none', letterSpacing: '0.08em', transition: 'color 0.2s' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#888')} onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}>Legal Information</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;