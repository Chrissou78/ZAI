import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { StarIcon, CalendarIcon, LocationIcon, MountainIcon } from '../Icons/BenefitIcons';
import { ZaiLogo, ZaiMark, InstagramIcon, FacebookIcon, LinkedInIcon, YouTubeIcon } from '../Icons/LogoIcons';
import { WalletConnectButton } from '../Auth/WalletConnectButton';
import { useAppContext } from '../../context/AppContext';
import { apiService } from '../../services/api';

/* ── design tokens ── */
const WINE = '#7A222E';
const WINE_HOVER = '#9a2535';
const BG_WARM = '#f0ede6';
const BG_DARK = '#0a0a0a';
const BG_CARD = '#1a1a1a';
const BORDER_DARK = '#2a2a2a';
const TEXT_MUTED = '#6a6a6a';
const TEXT_DIM = '#555';
const LABEL: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.3em',
  textTransform: 'uppercase',
  color: WINE,
  marginBottom: '0.75rem',
};
const HEADING: React.CSSProperties = {
  fontSize: 'clamp(24px, 3.5vw, 40px)',
  fontWeight: 300,
  lineHeight: 1.15,
  marginBottom: '1rem',
};
const BTN_BASE: React.CSSProperties = {
  padding: '13px 28px',
  fontSize: '11px',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
  transition: 'all 0.2s',
  border: 'none',
};

/* ── tier data ── */
const TIERS = [
  {
    name: 'Blue',
    color: '#3B6B9E',
    minPoints: 0,
    perks: ['Product registration', 'Event newsletter', 'Digital warranty'],
  },
  {
    name: 'Red',
    color: '#7D1E2C',
    minPoints: 15000,
    perks: ['Priority event access', 'Maintenance discount', 'Partner benefits', 'Dedicated support'],
  },
  {
    name: 'Black',
    color: '#1a1a1a',
    minPoints: 30000,
    perks: ['VIP event invitations', 'Early product launches', 'Custom fitting service', 'Referral bonuses'],
  },
  {
    name: 'Diamond',
    color: '#8B7D6B',
    minPoints: 50000,
    perks: ['Factory visits, Pontresina', 'Bespoke commission', 'Personal zai ambassador', 'Annual zai retreat'],
  },
];

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
      <div style={{ opacity: 0.35, pointerEvents: 'none', filter: 'grayscale(80%)' }}>
        {children}
      </div>
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
              color: WINE,
              textTransform: 'uppercase',
            }}
          >
            Exclusive
          </span>
        </div>
      </div>
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: dark ? BG_CARD : '#fff',
            border: `1px solid ${WINE}`,
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
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              left: '50%',
              marginLeft: -6,
              width: 12,
              height: 12,
              background: dark ? BG_CARD : '#fff',
              border: `1px solid ${WINE}`,
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

/* ════════════════════════════════════════════════════
   HOME
   ════════════════════════════════════════════════════ */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAppContext();
  const [hasExperienceCard, setHasExperienceCard] = useState(false);
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  /* ── Referral capture ── */
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('zai_referral_code', ref);
    }
  }, [searchParams]);

  /* ── Experience card check ── */
  useEffect(() => {
    if (!user?.id || isAdmin) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiService.get(`/products/user/${user.id}`);
        if (!cancelled && res.data?.success) {
          const d = res.data as any;
          setHasExperienceCard(!!d.experienceCard || !!d.stats?.hasExperienceCard);
        }
      } catch {
        /* ignore */
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user?.id, isAdmin]);

  const exclusive = hasExperienceCard || isAdmin;
  const referralCode = localStorage.getItem('zai_referral_code');

  return (
    <div style={{ background: '#f5f4f0', minHeight: '100vh' }}>
      {/* ── Referral welcome banner ── */}
      {referralCode && !user && (
        <div
          style={{
            background: WINE,
            color: '#fff',
            textAlign: 'center',
            padding: '10px 1rem',
            fontSize: '12px',
            letterSpacing: '0.1em',
            position: 'relative',
            zIndex: 10,
          }}
        >
          You've been invited to the zai Experience Club. Connect your wallet to get started and earn bonus points.
        </div>
      )}

      {/* ════════════  HERO  ════════════ */}
      <section
        style={{
          minHeight: '100vh',
          background: 'url(/images/hero-bg.jpg) center center / cover no-repeat',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingLeft: '4rem',
          paddingRight: '2rem',
          paddingTop: '150px',
          paddingBottom: '140px',
          boxSizing: 'border-box' as const,
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
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              paddingTop: '0.5rem',
            }}
          >
            <ZaiMark size={72} color="#ffffff" />
            <svg
              width="50"
              height="24"
              viewBox="48 0 62 35"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M63.7822 31.2694H52.0256C51.5457 31.2694 51.2758 31.1395 50.9259 30.7796C50.4461 30.2497 50.3961 29.5499 50.746 28.9701L60.9631 13.6445H52.0256C51.1858 13.6445 50.526 12.9447 50.576 12.1049C50.576 11.3151 51.2358 10.6953 52.0256 10.6953H63.7822C64.2221 10.6953 64.482 10.7853 64.8419 11.1352C65.3718 11.625 65.4118 12.3648 65.0219 12.9847L54.6748 28.3103H63.7922C64.582 28.3103 65.2418 29.0201 65.2418 29.8099C65.2418 30.5996 64.582 31.2594 63.7922 31.2594"
                fill="#f5f4f0"
              />
              <path
                d="M86.1055 22.4627H78.7476C77.468 22.4627 77.298 24.1322 77.298 25.4119C77.298 26.6915 77.478 28.321 78.7476 28.321H86.1055V22.4627ZM88.7048 30.7803C88.3949 31.1302 88.045 31.2702 87.5551 31.2702H78.7476C75.8884 31.2702 74.3489 28.281 74.3489 25.4119C74.3489 22.5427 75.8884 19.5135 78.7476 19.5135H86.1055V16.6044C86.1055 15.7246 85.8456 15.1048 85.2258 14.495C84.6059 13.8751 84.0361 13.6552 83.1564 13.6552H77.298C76.5083 13.6552 75.7985 12.9954 75.7985 12.2056C75.7985 11.4159 76.5083 10.7061 77.298 10.7061H83.1564C84.8759 10.7061 86.1055 11.1459 87.3452 12.3756C88.5748 13.6052 89.0147 14.8449 89.0147 16.6044V29.8106C89.0147 30.1605 88.9247 30.4704 88.7048 30.7803Z"
                fill="#f5f4f0"
              />
              <path
                d="M106.279 3.39661C106.279 0.887328 109.978 0.887328 109.978 3.39661C109.978 5.90589 106.279 5.86591 106.279 3.39661ZM108.129 31.2687C107.339 31.2687 106.679 30.6088 106.679 29.8191V13.7437H100.161C99.2413 13.7437 98.5715 13.3438 98.4015 12.644C98.1316 11.5443 98.9713 10.7545 99.7211 10.7545C99.7211 10.7545 107.739 10.7145 108.129 10.7145C108.918 10.7145 109.578 11.4143 109.578 12.2141V29.8291C109.578 30.6188 108.918 31.2786 108.129 31.2786"
                fill="#f5f4f0"
              />
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
            background:
              'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.2) 100%)',
            zIndex: 1,
          }}
        />

        {/* Hero Content */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px' }}>
          <div
            style={{
              fontSize: '22px',
              letterSpacing: '0.3em',
              color: '#fdfdfd',
              marginBottom: '1.5rem',
            }}
          >
            zai Experience Club
          </div>
          <h1
            style={{
              fontSize: 'clamp(60px, 6.5vw, 96px)',
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
              color: '#fff',
            }}
          >
            Your world
            <br />
            beyond the
            <br />
            <span style={{ color: '#f5f4f0' }}>mountain.</span>
          </h1>
          <p
            style={{
              color: '#999',
              fontSize: '18px',
              maxWidth: '900px',
              lineHeight: 1.8,
              marginBottom: '2rem',
            }}
          >
            Welcome to zai Experience Club. Claim your products, sign up for zai
            events, and
            <br />
            manage your personal zai ski collection all in one place. The zai
            Experience Club
            <br />
            makes zai more personal, more interactive, and closer than ever before!
          </p>
          {user && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <LockedTooltip
                locked={!exclusive}
                message="Claim your zai Experience Card to unlock product claims and your personal collection."
              >
                <button
                  onClick={() => navigate('/products')}
                  style={{ ...BTN_BASE, background: WINE, color: '#fff' }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = WINE_HOVER)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = WINE)
                  }
                >
                  Claim Your Product
                </button>
              </LockedTooltip>
              <LockedTooltip
                locked={!exclusive}
                message="Access exclusive zai events with the Experience Card membership."
              >
                <button
                  onClick={() => navigate('/events')}
                  style={{
                    ...BTN_BASE,
                    background: 'transparent',
                    color: '#fff',
                    border: '1px solid #444',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = '#fff')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = '#444')
                  }
                >
                  See Events
                </button>
              </LockedTooltip>
              <LockedTooltip
                locked={!exclusive}
                message="Unlock rewards and exclusive deals with your Experience Card membership."
              >
                <button
                  onClick={() => navigate('/rewards')}
                  style={{
                    ...BTN_BASE,
                    background: 'transparent',
                    color: '#fff',
                    border: '1px solid #444',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = '#fff')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = '#444')
                  }
                >
                  View Rewards
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
          <div
            style={{
              flex: 1,
              padding: '1.25rem',
              borderRight: '1px solid #1e1e1e',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 200,
                color: '#f5f4f0',
                height: '38px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              2003
            </div>
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              Founded
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: '1.25rem',
              borderRight: '1px solid #1e1e1e',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '28px',
                fontWeight: 200,
                color: '#f5f4f0',
                height: '38px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <MountainIcon />
            </div>
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              Alpine Design
            </div>
          </div>
          <div style={{ flex: 1, padding: '1.25rem', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '28px',
                fontWeight: 200,
                color: '#f5f4f0',
                height: '38px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              100%
            </div>
            <div
              style={{
                fontSize: '12px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              Handcrafted
            </div>
          </div>
        </div>
      </section>

      {/* ════════════  EXPERIENCE CARD  ════════════ */}
      <section
        style={{
          background: BG_WARM,
          padding: '5rem 4rem',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '5rem',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={LABEL}>zai experience card</div>
            <div style={{ ...HEADING, color: '#1a1a1a' }}>
              Your key to
              <br />
              everything zai
            </div>
            <p
              style={{
                color: TEXT_MUTED,
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '2rem',
              }}
            >
              Customers who spend over CHF 500 on zai products are eligible to
              join the exclusive zai Experience Club. In-store customers receive a
              physical NFC-enabled zai Experience Card, while online customers can
              request membership through the zai Experience Club dashboard by
              submitting proof of purchase.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                {
                  num: 1,
                  text: 'Spend over CHF 500 on zai products to become eligible for the zai Experience Club',
                },
                {
                  num: 2,
                  text: 'Receive a physical NFC Experience Card from an authorized dealer or boutique, or, if you purchased online, visit the zai Experience Club dashboard to request your membership by submitting proof of purchase.',
                },
                {
                  num: 3,
                  text: 'Access your membership portal and unlock exclusive member privileges',
                },
              ].map((step) => (
                <div key={step.num} style={{ display: 'flex', gap: '10px' }}>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      border: `1px solid ${WINE}`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      color: WINE,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {step.num}
                  </div>
                  <div style={{ fontSize: '12px', color: TEXT_MUTED }}>
                    {step.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <img
            src="/images/experience-card.png"
            alt="zai Experience Club Card"
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: 14,
              display: 'block',
            }}
          />
        </div>
        <div
          style={{
            marginTop: '0.75rem',
            fontSize: '10px',
            color: TEXT_MUTED,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            maxWidth: '900px',
            margin: '0.75rem auto 0',
          }}
        >
          <div
            style={{
              width: '4px',
              height: '4px',
              background: WINE,
              borderRadius: '50%',
            }}
          />
          Available for purchases over CHF 500
        </div>
      </section>

      {/* ════════════  HOW IT WORKS  ════════════ */}
      <section style={{ background: BG_DARK, padding: '5rem 4rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>how it works</div>
          <h2 style={{ ...HEADING, color: '#fff', marginBottom: '3rem' }}>
            Start Your
            <br />
            Membership Journey
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
              {
                num: 'Step 01',
                title: 'Activate your membership',
                desc: 'Purchased in-store? Tap your NFC-enabled zai Experience Card to activate your membership. Purchased online? Visit the zai Experience Club dashboard and submit proof of purchase to request your membership.',
              },
              {
                num: 'Step 02',
                title: 'Claim your purchased products',
                desc: 'Claim your zai products in the My Collection page to build your digital collection, verify ownership, and access product-specific experiences and benefits.',
              },
              {
                num: 'Step 03',
                title: 'Unlock exclusive benefits',
                desc: 'Activate your complimentary ski insurance, register for exclusive events, discover member-only offers, and enjoy unique experiences. New benefits and rewards will continue to be revealed over time.',
              },
              {
                num: 'Step 04',
                title: 'Be part of the community',
                desc: 'Connect with fellow zai owners, share your experiences, and discover stories from the global zai Experience Club community.',
              },
            ].map((step, i) => (
              <div
                key={i}
                style={{ background: BG_CARD, padding: '2rem 1.5rem' }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    color: WINE,
                    marginBottom: '1rem',
                    fontWeight: 500,
                  }}
                >
                  {step.num}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#fff',
                    marginBottom: '0.75rem',
                    lineHeight: 1.4,
                  }}
                >
                  {step.title}
                </div>
                <div
                  style={{ fontSize: '12px', color: '#666', lineHeight: 1.8 }}
                >
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════  BENEFITS  ════════════ */}
      <section
        style={{
          background: BG_WARM,
          padding: '5rem 4rem',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>exclusive benefits</div>
          <div style={{ ...HEADING, color: '#1a1a1a' }}>What you unlock</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1px',
              background: '#e0ddd6',
              border: '1px solid #e0ddd6',
              marginTop: '3rem',
            }}
          >
            {[
              {
                icon: <StarIcon />,
                title: 'Free Ski Insurance',
                desc: 'Activate complimentary insurance on every new zai ski purchase directly through your portal.',
                link: exclusive ? '/products' : undefined,
              },
              {
                icon: <CalendarIcon />,
                title: 'Exclusive Events',
                desc: 'Priority access to ski demos, factory tours, quarry visits, and personal meet-and-greets.',
                link: exclusive ? '/events' : undefined,
              },
              {
                icon: <LocationIcon />,
                title: 'Rewards & Deals',
                desc: 'Earn points on every purchase, climb tiers for better perks, and redeem exclusive member-only deals and collectible drops.',
                link: exclusive ? '/rewards' : undefined,
              },
            ].map((b, i) => (
              <div
                key={i}
                onClick={() => b.link && navigate(b.link)}
                style={{
                  background: '#fff',
                  padding: '2rem',
                  cursor: b.link ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = BG_WARM)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = '#fff')
                }
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    border: '1px solid #e0ddd6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.25rem',
                  }}
                >
                  {b.icon}
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '0.5rem',
                    color: '#1a1a1a',
                  }}
                >
                  {b.title}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: TEXT_MUTED,
                    lineHeight: 1.7,
                  }}
                >
                  {b.desc}
                </div>
                {b.link && (
                  <div
                    style={{
                      marginTop: '1rem',
                      fontSize: '10px',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                      color: WINE,
                      fontWeight: 600,
                    }}
                  >
                    Explore &rarr;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════  REWARDS & TIERS  ════════════ */}
      <section style={{ background: BG_DARK, padding: '5rem 4rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>loyalty program</div>
          <h2 style={{ ...HEADING, color: '#fff', marginBottom: '0.5rem' }}>
            Rewards &amp; Tiers
          </h2>
          <p
            style={{
              color: '#666',
              fontSize: '14px',
              lineHeight: 1.8,
              maxWidth: '580px',
              marginBottom: '3rem',
            }}
          >
            Earn 2.7 points for every CHF spent on zai products. Climb through
            four exclusive tiers to unlock increasingly premium rewards, deals,
            and experiences.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1px',
              background: '#2a2a2a',
              border: '1px solid #2a2a2a',
            }}
          >
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                style={{
                  background: BG_CARD,
                  padding: '2rem 1.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* tier accent bar */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: tier.color,
                  }}
                />
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: tier.color,
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#fff',
                      fontWeight: 700,
                    }}
                  >
                    {tier.name[0]}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: '4px',
                  }}
                >
                  {tier.name}
                </div>
                <div
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.1em',
                    color: '#555',
                    marginBottom: '1.25rem',
                  }}
                >
                  {tier.minPoints === 0
                    ? 'Starting tier'
                    : `${tier.minPoints.toLocaleString()}+ pts`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {tier.perks.map((p, j) => (
                    <div
                      key={j}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div
                        style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          background: tier.color,
                          flexShrink: 0,
                          marginTop: '6px',
                        }}
                      />
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#888',
                          lineHeight: 1.5,
                        }}
                      >
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          {user && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <LockedTooltip
                locked={!exclusive}
                message="Join the zai Experience Club to start earning rewards."
              >
                <button
                  onClick={() => navigate('/rewards')}
                  style={{
                    ...BTN_BASE,
                    background: WINE,
                    color: '#fff',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = WINE_HOVER)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = WINE)
                  }
                >
                  View My Rewards
                </button>
              </LockedTooltip>
            </div>
          )}
        </div>
      </section>

      {/* ════════════  UPDATES & DEALS  ════════════ */}
      <section
        style={{
          background: BG_WARM,
          padding: '5rem 4rem',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>updates &amp; deals</div>
          <div style={{ ...HEADING, color: '#1a1a1a' }}>
            Exclusive Offers &amp; Drops
          </div>
          <p
            style={{
              color: TEXT_MUTED,
              fontSize: '14px',
              lineHeight: 1.8,
              maxWidth: '580px',
              marginBottom: '3rem',
            }}
          >
            Discover member-only deals, redeem your points for discounts and
            merchandise, claim limited-edition collectible drops, and stay up to
            date with the latest stories from the world of zai.
          </p>

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
              {
                title: 'Deals & Offers',
                desc: 'Exchange points for exclusive discounts on zai products and partner experiences.',
                tag: 'DEALS',
              },
              {
                title: 'Collectible Drops',
                desc: 'Claim limited-edition digital collectibles — some unlocked by owning specific products or attending events.',
                tag: 'DROPS',
              },
              {
                title: 'Media & Stories',
                desc: 'Read articles, view photos, and watch behind-the-scenes videos from the zai universe.',
                tag: 'STORIES',
              },
            ].map((card, i) => (
              <div
                key={i}
                style={{
                  background: '#fff',
                  padding: '2rem',
                  cursor: exclusive ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onClick={() => exclusive && navigate('/updates')}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = BG_WARM)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = '#fff')
                }
              >
                <div
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.2em',
                    color: WINE,
                    fontWeight: 700,
                    marginBottom: '0.75rem',
                    textTransform: 'uppercase',
                  }}
                >
                  {card.tag}
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: '#1a1a1a',
                    marginBottom: '0.5rem',
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: TEXT_MUTED,
                    lineHeight: 1.7,
                  }}
                >
                  {card.desc}
                </div>
              </div>
            ))}
          </div>

          {user && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <LockedTooltip
                locked={!exclusive}
                message="Join the zai Experience Club to access deals and drops."
              >
                <button
                  onClick={() => navigate('/updates')}
                  style={{
                    ...BTN_BASE,
                    background: '#1a1a1a',
                    color: '#fff',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = '#333')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = '#1a1a1a')
                  }
                >
                  Browse Updates &amp; Deals
                </button>
              </LockedTooltip>
            </div>
          )}
        </div>
      </section>

      {/* ════════════  ECOSYSTEM / PARTNERS  ════════════ */}
      <section
        style={{
          background: BG_DARK,
          padding: '5rem 4rem',
          borderTop: `1px solid ${BORDER_DARK}`,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>zai ecosystem</div>
          <h2 style={{ ...HEADING, color: '#fff' }}>
            Partners &amp; Community
          </h2>
          <p
            style={{
              color: '#666',
              fontSize: '14px',
              lineHeight: 1.8,
              maxWidth: '580px',
              marginBottom: '2.5rem',
            }}
          >
            The zai ecosystem brings together exclusive brand partners and a
            global community of zai owners — connected through a shared passion
            for the mountain. Partners will be revealed soon. Join the community
            to share your experiences.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '1px',
              background: '#1e1e1e',
              border: '1px solid #1e1e1e',
              marginBottom: '2rem',
            }}
          >
            {[
              'Mountain Pass',
              'Destination',
              'Financial',
              'Mountain Pass',
              'Destination',
            ].map((label, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: BG_CARD,
                  padding: '2rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage:
                      'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.015) 3px, rgba(255,255,255,0.015) 6px)',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: 0.35,
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  <div
                    style={{
                      fontSize: '22px',
                      color: TEXT_DIM,
                      letterSpacing: '4px',
                    }}
                  >
                    ■
                  </div>
                  <div
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.25em',
                      textTransform: 'uppercase',
                      color: TEXT_DIM,
                    }}
                  >
                    {label}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '1.25rem 0',
              borderTop: '1px solid #333',
            }}
          >
            <div
              style={{
                width: '5px',
                height: '5px',
                background: WINE,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '11px',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                whiteSpace: 'nowrap',
              }}
            >
              Partners to be announced
            </span>
            <div
              style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(90deg, #333, transparent)',
              }}
            />
          </div>
        </div>
      </section>

      {/* ════════════  REFERRAL SECTION  ════════════ */}
      {user && exclusive && (
        <section
          style={{
            background: BG_WARM,
            padding: '4rem',
            borderTop: '1px solid #e0ddd6',
          }}
        >
          <div
            style={{
              maxWidth: '900px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '280px' }}>
              <div style={LABEL}>refer a friend</div>
              <div style={{ ...HEADING, color: '#1a1a1a', marginBottom: '0.5rem' }}>
                Share the Experience
              </div>
              <p
                style={{
                  color: TEXT_MUTED,
                  fontSize: '13px',
                  lineHeight: 1.8,
                  maxWidth: '420px',
                }}
              >
                Invite friends to join the zai Experience Club. When they claim
                their first product, you'll earn 200 bonus points and they'll
                receive 100 points to get started.
              </p>
            </div>
            <button
              onClick={() => navigate('/profile')}
              style={{
                ...BTN_BASE,
                background: '#1a1a1a',
                color: '#fff',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#333')}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = '#1a1a1a')
              }
            >
              Get Your Referral Code
            </button>
          </div>
        </section>
      )}

      {/* ════════════  FOOTER  ════════════ */}
      <footer
        style={{
          background: BG_DARK,
          color: '#fff',
          borderTop: '1px solid #2e2e2e',
          padding: '2.5rem 4rem 1.5rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '2rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid #2e2e2e',
            flexWrap: 'wrap',
            marginBottom: '1.25rem',
            maxWidth: '1200px',
            margin: '0 auto 1.25rem',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '14px',
                fontWeight: 200,
                letterSpacing: '0.2em',
                marginBottom: '1.25rem',
                color: '#f5f4f0',
              }}
            >
              <ZaiLogo size={200} color="#333" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#444',
                  marginBottom: '0.6rem',
                }}
              >
                Explore
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {[
                  { href: 'https://www.zai.ch/shop', label: 'Shop' },
                  { href: 'https://www.zai.ch/dealer', label: 'Dealers' },
                  { href: 'https://www.zai.ch/contact', label: 'Contact' },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    style={{
                      fontSize: '11px',
                      color: TEXT_DIM,
                      textDecoration: 'none',
                      letterSpacing: '0.05em',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#fff')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT_DIM)
                    }
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#444',
                  marginBottom: '0.6rem',
                }}
              >
                Members
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {[
                  { to: '/rewards', label: 'Rewards' },
                  { to: '/updates', label: 'Deals & Drops' },
                  { to: '/events', label: 'Events' },
                ].map((link) => (
                  <span
                    key={link.label}
                    onClick={() => navigate(link.to)}
                    style={{
                      fontSize: '11px',
                      color: TEXT_DIM,
                      textDecoration: 'none',
                      letterSpacing: '0.05em',
                      transition: 'color 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) =>
                      ((e.target as HTMLElement).style.color = '#fff')
                    }
                    onMouseLeave={(e) =>
                      ((e.target as HTMLElement).style.color = TEXT_DIM)
                    }
                  >
                    {link.label}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.25em',
                  textTransform: 'uppercase',
                  color: '#444',
                  marginBottom: '0.6rem',
                }}
              >
                Follow
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {[
                  {
                    href: 'https://instagram.com/zaiski',
                    title: 'Instagram',
                    icon: <InstagramIcon />,
                  },
                  {
                    href: 'https://facebook.com/zaiski',
                    title: 'Facebook',
                    icon: <FacebookIcon />,
                  },
                  {
                    href: 'https://linkedin.com/company/zai-ski',
                    title: 'LinkedIn',
                    icon: <LinkedInIcon />,
                  },
                  {
                    href: 'https://www.youtube.com/user/ZaiDisentis',
                    title: 'YouTube',
                    icon: <YouTubeIcon />,
                  },
                ].map((social) => (
                  <a
                    key={social.title}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={social.title}
                    style={{
                      width: '30px',
                      height: '30px',
                      border: `1px solid ${BORDER_DARK}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: TEXT_DIM,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.borderColor =
                        TEXT_DIM;
                      (e.currentTarget as HTMLAnchorElement).style.color =
                        '#fff';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.borderColor =
                        BORDER_DARK;
                      (e.currentTarget as HTMLAnchorElement).style.color =
                        TEXT_DIM;
                    }}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            maxWidth: '1200px',
            margin: '0 auto',
            paddingTop: '1.25rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              color: '#444',
            }}
          >
            <svg
              width="12"
              height="10"
              viewBox="0 0 24 20"
              fill="none"
              style={{ flexShrink: 0 }}
            >
              <polyline
                points="1,19 7,7 12,13 16,5 23,19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <span>Pontresina, Alps · Since 2003</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {['Privacy Policy', 'Terms & Conditions', 'Legal Information'].map(
              (text) => (
                <a
                  key={text}
                  href="#"
                  style={{
                    fontSize: '10px',
                    color: '#444',
                    textDecoration: 'none',
                    letterSpacing: '0.08em',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = '#888')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = '#444')
                  }
                >
                  {text}
                </a>
              )
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
