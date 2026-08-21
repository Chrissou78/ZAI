import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, {
  SUPPORTED_LANGUAGES,
  mapToSupportedLanguage,
  type SupportedLanguage,
} from '../../i18n';
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

/* ── tier data — restricted to the brand's actual color scheme: Ochsen Blut
   burgundy (RGB 122/34/46), white, black, 40% grey (RGB 178/178/178), and
   70% grey (RGB 112/111/111). No blue, no gold — those were never part of
   the allowed palette, so Blue and Diamond use the two greys instead. Black
   uses a light neutral rather than #1a1a1a, which is the exact same value
   as BG_CARD below and was invisible — the accent bar, badge, and bullet
   dots all render in tier.color directly, so an identical-to-background
   color renders nothing at all. */
const GREY_40 = '#B2B2B2';
const GREY_70 = '#706F6F';
const TIERS = [
  { key: 'blue', color: GREY_40, minPoints: 0 },
  { key: 'red', color: WINE, minPoints: 15000 },
  { key: 'black', color: '#f5f4f0', minPoints: 30000 },
  { key: 'diamond', color: GREY_70, minPoints: 50000 },
];

/* ── Locked-feature tooltip (hover) ── */
const LockedTooltip: React.FC<{
  children: React.ReactNode;
  locked: boolean;
  message?: string;
  dark?: boolean;
}> = ({ children, locked, message, dark = true }) => {
  const { t } = useTranslation();
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
            {t('home.lockedTooltip.badge')}
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
            {message || t('home.lockedTooltip.defaultMessage')}
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

/* ── Hero language switcher ──
   Lets an anonymous visitor change language from the public hero, before any
   account exists.

   PERSISTENCE CONTRACT: the picked code ('en' | 'de' | 'zh') is written to
   localStorage under the key `zai_lang`. Writing it here is only half the
   round trip — for the choice to survive a reload, the bootstrap in
   `src/i18n/index.ts` (getInitialLanguage) must also READ `zai_lang` in its
   resolution order, i.e. logged-in user's saved language > zai_lang >
   navigator.language > 'en'. That file is owned elsewhere; until it reads the
   key, switching is instant but resets on refresh. */
const LANG_STORAGE_KEY = 'zai_lang';
const OFF_WHITE = '#f5f4f0';

const GlobeIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden="true"
    style={{ flexShrink: 0, display: 'block' }}
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.6 2.5 15.4 0 18-2.5-2.6-2.5-15.4 0-18Z" />
  </svg>
);

const HeroLangSwitcher: React.FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 480
  );
  const [hovered, setHovered] = useState<SupportedLanguage | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setIsPhone(window.innerWidth < 480);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* Close on outside click + Escape (same pattern as AdminStore's dropdown) */
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const current = mapToSupportedLanguage(i18n.language);

  const select = (code: SupportedLanguage) => {
    setOpen(false);
    if (code !== current) {
      void i18n.changeLanguage(code);
      try {
        localStorage.setItem(LANG_STORAGE_KEY, code);
      } catch {
        /* private mode / storage disabled — the in-memory switch still works */
      }
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('langSwitcher.changeLanguage')}
        title={t('langSwitcher.changeLanguage')}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isPhone ? 4 : 6,
          padding: isPhone ? '7px 8px' : '10px 12px',
          background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(245,244,240,0.35)',
          borderRadius: 4,
          color: OFF_WHITE,
          fontFamily: 'Inter, sans-serif',
          fontSize: isPhone ? '9px' : '11px',
          fontWeight: 500,
          letterSpacing: isPhone ? '0.04em' : '0.12em',
          textTransform: 'uppercase',
          lineHeight: 1,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          backdropFilter: 'blur(4px)',
          transition: 'all 0.2s',
        }}
      >
        <GlobeIcon size={isPhone ? 12 : 14} />
        <span>{current.toUpperCase()}</span>
        {/* chevron is dropped on phones so the pill stays narrow enough not to
            collide with the absolutely-centred hero logo mark */}
        {!isPhone && (
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{
              display: 'block',
              transform: open ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          >
            <path d="M5 8.5 12 15.5 19 8.5" />
          </svg>
        )}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('langSwitcher.label')}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            /* anchored to the right edge so it can never push past the
               viewport on narrow screens */
            right: 0,
            minWidth: isPhone ? 130 : 150,
            maxWidth: 'calc(100vw - 2rem)',
            background: 'rgba(10,10,10,0.94)',
            border: '1px solid rgba(245,244,240,0.22)',
            borderRadius: 4,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            overflow: 'hidden',
            zIndex: 50,
          }}
        >
          {SUPPORTED_LANGUAGES.map((code, idx) => {
            const active = code === current;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(code)}
                onMouseEnter={() => setHovered(code)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background:
                    active
                      ? 'rgba(122,34,46,0.55)'
                      : hovered === code
                      ? 'rgba(255,255,255,0.08)'
                      : 'transparent',
                  border: 'none',
                  borderTop: idx === 0 ? 'none' : '1px solid rgba(245,244,240,0.12)',
                  color: OFF_WHITE,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 400,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <span>{t(`langSwitcher.languages.${code}`)}</span>
                <span
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.12em',
                    color: active ? OFF_WHITE : 'rgba(245,244,240,0.45)',
                  }}
                  title={active ? t('langSwitcher.activeOption') : undefined}
                >
                  {active ? '●' : code.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════
   HOME
   ════════════════════════════════════════════════════ */
const Home: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAppContext();
  // Seed from the same localStorage cache Dashboard/Sidebar/Products already
  // read and write (see ExclusiveRoute in Router.tsx) instead of defaulting
  // to "locked" and always waiting on a fresh network round-trip. Without
  // this, the hero's exclusive buttons flashed locked-then-unlocked on
  // every single visit, even for members who'd already been confirmed
  // exclusive in this same browser.
  const [hasExperienceCard, setHasExperienceCard] = useState(() => {
    const stored = localStorage.getItem('zai_experience_card');
    return !!stored && stored !== 'null' && stored !== 'undefined';
  });
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';

  /* ── Referral capture ── */
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('zai_referral_code', ref);
    }
  }, [searchParams]);

  /* ── Experience card check ──
     Stay in sync with whatever Dashboard/Products/Sidebar last confirmed
     (same event Dashboard dispatches after its own check), so if another
     tab/page resolves this first, the hero updates without a refetch. */
  useEffect(() => {
    const syncFromStorage = () => {
      const stored = localStorage.getItem('zai_experience_card');
      setHasExperienceCard(!!stored && stored !== 'null' && stored !== 'undefined');
    };
    window.addEventListener('zai:experience-card-updated', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('zai:experience-card-updated', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!user?.id || isAdmin) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await apiService.get(`/products/user/${user.id}`);
        if (!cancelled && res.data?.success) {
          const d = res.data as any;
          const ecFound = !!d.experienceCard || !!d.stats?.hasExperienceCard;
          setHasExperienceCard(ecFound);
          // Refresh the shared cache so Dashboard/Sidebar/Products (and this
          // page on the next visit) don't have to wait on their own fetch.
          if (ecFound) {
            localStorage.setItem('zai_experience_card', d.experienceCard ? JSON.stringify(d.experienceCard) : 'true');
          } else {
            localStorage.removeItem('zai_experience_card');
          }
          window.dispatchEvent(new Event('zai:experience-card-updated'));
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
          {t('home.referralBanner')}
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
          paddingLeft: 'clamp(1.5rem, 6vw, 4rem)',
          paddingRight: 'clamp(1.25rem, 4vw, 2rem)',
          paddingTop: '150px',
          paddingBottom: '140px',
          boxSizing: 'border-box' as const,
          position: 'relative' as const,
          overflowX: 'hidden' as const,
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
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            padding: 'clamp(1rem, 4vw, 2rem) clamp(1rem, 4vw, 3rem)',
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 'clamp(1rem, 4vw, 2rem)',
              left: '50%',
              transform: 'translateX(-50%)',
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
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 'clamp(6px, 1.5vw, 12px)',
            }}
          >
            <HeroLangSwitcher />
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
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '700px', width: '100%' }}>
          <div
            style={{
              fontSize: 'clamp(14px, 3vw, 22px)',
              letterSpacing: '0.3em',
              color: '#fdfdfd',
              marginBottom: '1.5rem',
            }}
          >
            {t('home.hero.badge')}
          </div>
          <h1
            style={{
              fontSize: 'clamp(36px, 10vw, 96px)',
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              marginBottom: '1.5rem',
              color: '#fff',
            }}
          >
            {t('home.hero.headingLine1')}
            <br />
            {t('home.hero.headingLine2')}
            <br />
            <span style={{ color: '#f5f4f0' }}>{t('home.hero.headingLine3')}</span>
          </h1>
          <p
            style={{
              color: '#999',
              fontSize: 'clamp(14px, 2.2vw, 18px)',
              maxWidth: '900px',
              lineHeight: 1.8,
              marginBottom: '2rem',
            }}
          >
            {t('home.hero.description')}
          </p>
          {user && (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <LockedTooltip
                locked={!exclusive}
                message={t('home.lockedTooltip.claimProduct')}
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
                  {t('home.hero.claimProduct')}
                </button>
              </LockedTooltip>
              <LockedTooltip
                locked={!exclusive}
                message={t('home.lockedTooltip.events')}
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
                  {t('home.hero.seeEvents')}
                </button>
              </LockedTooltip>
              <LockedTooltip
                locked={!exclusive}
                message={t('home.lockedTooltip.rewards')}
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
                  {t('home.hero.viewRewards')}
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
              padding: 'clamp(0.6rem, 2vw, 1.25rem) clamp(0.4rem, 2vw, 1.25rem)',
              borderRight: '1px solid #1e1e1e',
              textAlign: 'center',
              minWidth: 0,
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
                fontSize: 'clamp(9px, 2vw, 12px)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              {t('home.hero.stats.founded')}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              padding: 'clamp(0.6rem, 2vw, 1.25rem) clamp(0.4rem, 2vw, 1.25rem)',
              borderRight: '1px solid #1e1e1e',
              textAlign: 'center',
              minWidth: 0,
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
                fontSize: 'clamp(9px, 2vw, 12px)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              {t('home.hero.stats.alpineDesign')}
            </div>
          </div>
          <div style={{ flex: 1, padding: 'clamp(0.6rem, 2vw, 1.25rem) clamp(0.4rem, 2vw, 1.25rem)', textAlign: 'center', minWidth: 0 }}>
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
                fontSize: 'clamp(9px, 2vw, 12px)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: TEXT_DIM,
                marginTop: '3px',
              }}
            >
              {t('home.hero.stats.handcrafted')}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════  EXPERIENCE CARD  ════════════ */}
      <section
        style={{
          background: BG_WARM,
          padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div
          style={{
            maxWidth: '900px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'clamp(2rem, 6vw, 5rem)',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={LABEL}>{t('home.experienceCard.label')}</div>
            <div style={{ ...HEADING, color: '#1a1a1a' }}>
              {t('home.experienceCard.headingLine1')}
              <br />
              {t('home.experienceCard.headingLine2')}
            </div>
            <p
              style={{
                color: TEXT_MUTED,
                fontSize: '14px',
                lineHeight: 1.8,
                marginBottom: '2rem',
              }}
            >
              {t('home.experienceCard.description')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { num: 1, text: t('home.experienceCard.step1') },
                { num: 2, text: t('home.experienceCard.step2') },
                { num: 3, text: t('home.experienceCard.step3') },
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
          {t('home.experienceCard.note')}
        </div>
      </section>

      {/* ════════════  HOW IT WORKS  ════════════ */}
      <section style={{ background: BG_DARK, padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>{t('home.howItWorks.label')}</div>
          <h2 style={{ ...HEADING, color: '#fff', marginBottom: '3rem' }}>
            {t('home.howItWorks.headingLine1')}
            <br />
            {t('home.howItWorks.headingLine2')}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1px',
              background: '#2a2a2a',
              border: '1px solid #2a2a2a',
            }}
          >
            {(['step1', 'step2', 'step3', 'step4'] as const).map((stepKey) => ({
              num: t(`home.howItWorks.${stepKey}.num`),
              title: t(`home.howItWorks.${stepKey}.title`),
              desc: t(`home.howItWorks.${stepKey}.desc`),
            })).map((step, i) => (
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
          padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>{t('home.benefits.label')}</div>
          <div style={{ ...HEADING, color: '#1a1a1a' }}>{t('home.benefits.heading')}</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1px',
              background: '#e0ddd6',
              border: '1px solid #e0ddd6',
              marginTop: '3rem',
            }}
          >
            {[
              {
                icon: <StarIcon />,
                title: t('home.benefits.insurance.title'),
                desc: t('home.benefits.insurance.desc'),
                link: exclusive ? '/products' : undefined,
              },
              {
                icon: <CalendarIcon />,
                title: t('home.benefits.events.title'),
                desc: t('home.benefits.events.desc'),
                link: exclusive ? '/events' : undefined,
              },
              {
                icon: <LocationIcon />,
                title: t('home.benefits.rewards.title'),
                desc: t('home.benefits.rewards.desc'),
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
                    {t('home.benefits.explore')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════  REWARDS & TIERS  ════════════ */}
      <section style={{ background: BG_DARK, padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>{t('home.rewardsSection.label')}</div>
          <h2 style={{ ...HEADING, color: '#fff', marginBottom: '0.5rem' }}>
            {t('home.rewardsSection.heading')}
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
            {t('home.rewardsSection.description')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1px',
              background: '#2a2a2a',
              border: '1px solid #2a2a2a',
            }}
          >
            {TIERS.map((tier) => {
              const tierName = t(`home.rewardsSection.tiers.${tier.key}.name`);
              const tierPerks = t(`home.rewardsSection.tiers.${tier.key}.perks`, { returnObjects: true }) as string[];
              return (
              <div
                key={tier.key}
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
                    {tierName[0]}
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
                  {tierName}
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
                    ? t('home.rewardsSection.startingTier')
                    : `${tier.minPoints.toLocaleString()}${t('home.rewardsSection.ptsSuffix')}`}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {tierPerks.map((p, j) => (
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
              );
            })}
          </div>

          {/* CTA */}
          {user && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <LockedTooltip
                locked={!exclusive}
                message={t('home.lockedTooltip.joinRewards')}
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
                  {t('home.rewardsSection.cta')}
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
          padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)',
          borderTop: '1px solid #e0ddd6',
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>{t('home.updatesSection.label')}</div>
          <div style={{ ...HEADING, color: '#1a1a1a' }}>
            {t('home.updatesSection.heading')}
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
            {t('home.updatesSection.description')}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1px',
              background: '#e0ddd6',
              border: '1px solid #e0ddd6',
            }}
          >
            {[
              {
                title: t('home.updatesSection.deals.title'),
                desc: t('home.updatesSection.deals.desc'),
                tag: t('home.updatesSection.deals.tag'),
                to: '/updates',
              },
              {
                title: t('home.updatesSection.drops.title'),
                desc: t('home.updatesSection.drops.desc'),
                tag: t('home.updatesSection.drops.tag'),
                to: '/updates',
              },
              {
                title: t('home.updatesSection.stories.title'),
                desc: t('home.updatesSection.stories.desc'),
                tag: t('home.updatesSection.stories.tag'),
                to: '/community',
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
                onClick={() => exclusive && navigate(card.to)}
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
                message={t('home.lockedTooltip.joinDeals')}
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
                  {t('home.updatesSection.cta')}
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
          padding: 'clamp(2.5rem, 7vw, 5rem) clamp(1.25rem, 5vw, 4rem)',
          borderTop: `1px solid ${BORDER_DARK}`,
        }}
      >
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={LABEL}>{t('home.ecosystem.label')}</div>
          <h2 style={{ ...HEADING, color: '#fff' }}>
            {t('home.ecosystem.heading')}
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
            {t('home.ecosystem.description')}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1px',
              background: '#1e1e1e',
              border: '1px solid #1e1e1e',
              marginBottom: '2rem',
            }}
          >
            {(t('home.ecosystem.placeholders', { returnObjects: true }) as string[]).map((label, i) => (
              <div
                key={i}
                style={{
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
              {t('home.ecosystem.toBeAnnounced')}
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
            padding: 'clamp(2rem, 6vw, 4rem)',
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
              <div style={LABEL}>{t('home.referralSection.label')}</div>
              <div style={{ ...HEADING, color: '#1a1a1a', marginBottom: '0.5rem' }}>
                {t('home.referralSection.heading')}
              </div>
              <p
                style={{
                  color: TEXT_MUTED,
                  fontSize: '13px',
                  lineHeight: 1.8,
                  maxWidth: '420px',
                }}
              >
                {t('home.referralSection.description')}
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
              {t('home.referralSection.cta')}
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
          padding: 'clamp(1.75rem, 6vw, 2.5rem) clamp(1.25rem, 5vw, 4rem) 1.5rem',
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
                {t('home.footer.explore')}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {[
                  { href: 'https://www.zai.ch/shop', label: t('home.footer.linksExplore.shop') },
                  { href: 'https://www.zai.ch/dealer', label: t('home.footer.linksExplore.dealers') },
                  { href: 'https://www.zai.ch/contact', label: t('home.footer.linksExplore.contact') },
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
                {t('home.footer.members')}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                {[
                  { to: '/rewards', label: t('home.footer.linksMembers.pointsTiers') },
                  { to: '/updates', label: t('home.footer.linksMembers.dealsCollectibles') },
                  { to: '/community', label: t('home.footer.linksMembers.insights') },
                  { to: '/events', label: t('home.footer.linksMembers.events') },
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
                {t('home.footer.follow')}
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
            <span>{t('home.footer.location')}</span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {[
              t('home.footer.legal.privacy'),
              t('home.footer.legal.terms'),
              t('home.footer.legal.legalInfo'),
            ].map(
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
