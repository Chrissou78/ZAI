import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ZaiMark } from '../Icons/LogoIcons';

// ── Keys for localStorage persistence ──
const STORAGE_KEY_STEPS = 'zai_onboarding_completed';
const STORAGE_KEY_DISMISSED = 'zai_onboarding_dismissed';
const STORAGE_KEY_TOURS = 'zai_page_tours_seen';

/* ══════════════════════════════════════════════════════════════════════════
   Welcome-gift campaign window — SINGLE SOURCE OF TRUTH
   ─────────────────────────────────────────────────────────────────────────
   The client gifts a physical item to every member who registers during the
   first three months of the promotional period. Both bounds are FIXED ISO
   instants (never derived from Date.now()), so the campaign stops by itself
   once the window closes — it is re-evaluated on every render, no manual
   cleanup needed. To extend or end the campaign, change these two constants
   only.

   The gift used to be pitched by a standalone WelcomeGiftModal mounted on the
   dashboard. That modal is gone: its full-screen backdrop (z-index 10002) sat
   on top of this widget (z-index 9999) for exactly the new members who were
   supposed to be working through this checklist, so the two competed. The
   offer now lives inside step 0 ("Complete your profile") below, and this file
   is the only definition of the campaign window and the gift name.
   ══════════════════════════════════════════════════════════════════════════ */
export const GIFT_PROMO_START_ISO = '2026-08-01T00:00:00Z';
export const GIFT_PROMO_END_ISO = '2026-11-01T00:00:00Z'; // exclusive — 3 months after start

/** True only while "now" sits inside the fixed welcome-gift campaign window. */
export const isGiftPromoWindowOpen = (now: number = Date.now()): boolean => {
  const start = Date.parse(GIFT_PROMO_START_ISO);
  const end = Date.parse(GIFT_PROMO_END_ISO);
  // Malformed constants must never keep the campaign running forever.
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return now >= start && now < end;
};

/* The gift on offer. The client changes this between campaigns, so it is
   named once here and interpolated into every string that mentions it. */
export const WELCOME_GIFT_ITEM = 'zai lip balm';

/* ── Gift design tokens (carried over from the retired modal) ── */
const BURGUNDY = '#7D1E2C';
const BURGUNDY_DEEP = '#7A222E';
const BURGUNDY_HOVER = '#9a2535';
const GIFT_CALLOUT_BG = '#f2efe9';
const GIFT_PANEL_BG = '#faf9f6';
const MUTED = '#6a6a6a';
const BLACK = '#0a0a0a';
const BORDER = '#e0ddd6';
const FONT = "'Inter', sans-serif";
const DISPLAY_FONT = "'Georgia', 'Times New Roman', serif";

/** The checklist step the welcome gift is attached to ("Complete your profile"). */
const PROFILE_STEP_ID = 0;

interface OnboardingStep {
  id: number;
  name: string;
  hint: string;
  route: string;
  completionRoute: string;
}

const STEPS: OnboardingStep[] = [
  { id: 0, name: 'Complete your profile',       hint: 'Add your details & preferences',    route: '/profile',   completionRoute: '/profile' },
  { id: 1, name: 'Claim your product',          hint: 'Register your zai with your card',  route: '/products',  completionRoute: '/products' },
  { id: 2, name: 'Visit your dashboard',        hint: 'See your full experience overview',  route: '/dashboard', completionRoute: '/dashboard' },
  { id: 3, name: 'Connect with the community',  hint: 'Meet members & share photos',       route: '/community', completionRoute: '/community' },
];

// ── Page tour definitions ──
interface TourStop {
  title: string;
  description: string;
  icon: string;
}

interface PageTour {
  pageTitle: string;
  stops: TourStop[];
}

// NOTE: /dashboard deliberately has NO tour. It fired behind a full-viewport
// backdrop above the onboarding widget, so a newcomer's first dashboard load
// was the tour rather than the welcome gift. The gift takes priority there.
const PAGE_TOURS: Record<string, PageTour> = {
  '/profile': {
    pageTitle: 'Your Profile',
    stops: [
      { title: 'Personal Information', description: 'Fill in your name, email, phone, and address. This data is used for insurance registration and event sign-ups.', icon: '👤' },
      { title: 'Edit Mode', description: 'Click "Edit Profile" to unlock the form, make your changes, then hit "Save Changes".', icon: '✏️' },
      { title: 'Public Profile', description: 'Toggle this on to let other community members see your basic info.', icon: '🌐' },
    ],
  },
  '/products': {
    pageTitle: 'Your Products',
    stops: [
      { title: 'Product Carousel', description: 'Browse all your claimed zai products here. Each card shows the product image, name, and insurance status.', icon: '🎿' },
      { title: 'Claim a Product', description: 'Click "+ Claim Product" or the "+" card to register a new product by uploading your purchase invoice and submitting it to the zai team for confirmation.', icon: '📦' },
      { title: 'Activate Insurance', description: 'For skis purchased within the last 30 days, you can activate your complimentary ski insurance in just a few clicks.', icon: '🛡️' },
    ],
  },
  '/community': {
    pageTitle: 'Community',
    stops: [
      { title: 'Photo Feed', description: 'Browse and share photos from the zai community. Upload images, add captions, and tag members.', icon: '📸' },
      { title: 'Members', description: 'See all club members in the directory and discover fellow zai owners.', icon: '👥' },
    ],
  },
};

const OnboardingWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [giftCtaHover, setGiftCtaHover] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STEPS);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY_DISMISSED) === 'true'; } catch { return false; }
  });

  // Page tour state
  const [showTour, setShowTour] = useState(false);
  const [tourPage, setTourPage] = useState<string>('');
  const [tourStopIndex, setTourStopIndex] = useState(0);
  const [seenTours, setSeenTours] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TOURS);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist completed steps
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_STEPS, JSON.stringify(completedSteps));
  }, [completedSteps]);

  // Persist dismissed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DISMISSED, String(dismissed));
  }, [dismissed]);

  // Persist seen tours
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TOURS, JSON.stringify(seenTours));
  }, [seenTours]);

  // Auto-open widget after delay
  useEffect(() => {
    if (dismissed || completedSteps.length === STEPS.length) return;
    const timer = setTimeout(() => setIsOpen(true), 800);
    return () => clearTimeout(timer);
  }, [dismissed, completedSteps.length]);

  // ── Auto-complete steps & trigger page tours on route change ──
  useEffect(() => {
    const path = location.pathname;

    // Check if visiting this route completes a step
    STEPS.forEach((step) => {
      if (path === step.completionRoute && !completedSteps.includes(step.id)) {
        // For "Claim your product" (step 1), don't auto-complete on visit alone
        if (step.id === 1) return;

        setCompletedSteps((prev) => {
          if (prev.includes(step.id)) return prev;
          return [...prev, step.id];
        });
      }
    });

    // Trigger page tour if first visit
    if (PAGE_TOURS[path] && !seenTours.includes(path)) {
      const tourTimer = setTimeout(() => {
        setTourPage(path);
        setTourStopIndex(0);
        setShowTour(true);
      }, 600);
      return () => clearTimeout(tourTimer);
    }
  }, [location.pathname]);

  // ── Listen for custom "product claimed" event to complete step 1 ──
  // Also check on mount & on route change whether the user already has products
  useEffect(() => {
    const completeClaimStep = () => {
      setCompletedSteps((prev) => {
        if (prev.includes(1)) return prev;
        return [...prev, 1];
      });
    };

    // Listen for explicit claim event (fired after a successful claim)
    window.addEventListener('zai:product-claimed', completeClaimStep);

    // Listen for products-loaded event (fired when products page fetches existing products)
    window.addEventListener('zai:products-loaded', completeClaimStep);

    // Also check localStorage for experience card (set by Products page)
    try {
      const expCard = localStorage.getItem('zai_experience_card');
      if (expCard && JSON.parse(expCard)) {
        completeClaimStep();
      }
    } catch { /* ignore */ }

    return () => {
      window.removeEventListener('zai:product-claimed', completeClaimStep);
      window.removeEventListener('zai:products-loaded', completeClaimStep);
    };
  }, []);

  // ── Re-check claim step when route changes to /products ──
  // (products may have loaded while we weren't listening)
  useEffect(() => {
    if (location.pathname !== '/products') return;
    if (completedSteps.includes(1)) return;

    // Poll briefly for the products to load and fire the event
    const checkInterval = setInterval(() => {
      try {
        const expCard = localStorage.getItem('zai_experience_card');
        if (expCard && JSON.parse(expCard)) {
          setCompletedSteps((prev) => {
            if (prev.includes(1)) return prev;
            return [...prev, 1];
          });
          clearInterval(checkInterval);
        }
      } catch { /* ignore */ }
    }, 1500);

    // Stop polling after 15 seconds
    const timeout = setTimeout(() => clearInterval(checkInterval), 15000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
    };
  }, [location.pathname, completedSteps]);

  // ── Tour handlers ──
  const currentTour = PAGE_TOURS[tourPage];

  const handleTourNext = () => {
    if (!currentTour) return;
    if (tourStopIndex < currentTour.stops.length - 1) {
      setTourStopIndex((i) => i + 1);
    } else {
      setSeenTours((prev) => [...prev, tourPage]);
      setShowTour(false);
    }
  };

  const handleTourSkip = () => {
    setSeenTours((prev) => [...prev, tourPage]);
    setShowTour(false);
  };

  // ── Step click: navigate to route ──
  const handleStepClick = (step: OnboardingStep) => {
    navigate(step.route);
    setIsOpen(false);
  };

  // ── Dismiss permanently ──
  const handleDismiss = () => {
    setDismissed(true);
    setIsOpen(false);
  };

  // ── Welcome gift ──
  // The gift is not a second system: it is the reward for finishing step 0, so
  // it shows only while the campaign window is open AND that step is still
  // outstanding. The moment the profile step completes it stops being pitched.
  const giftActive = isGiftPromoWindowOpen() && !completedSteps.includes(PROFILE_STEP_ID);
  const giftItem = { item: WELCOME_GIFT_ITEM };

  const handleGiftCta = () => {
    navigate(STEPS[PROFILE_STEP_ID].route);
    setIsOpen(false);
  };

  // ── Computed ──
  const progress = (completedSteps.length / STEPS.length) * 100;
  const circumference = 2 * Math.PI * 13;
  const strokeDashoffset = circumference - (completedSteps.length / STEPS.length) * circumference;
  const allDone = completedSteps.length === STEPS.length;

  if (dismissed && !showTour) return null;

  return (
    <>
      {/* ════════════ PAGE TOUR OVERLAY ════════════ */}
      {showTour && currentTour && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)',
            fontFamily: "'Inter', sans-serif",
          }}
          onClick={handleTourSkip}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              width: '420px',
              maxWidth: '92vw',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Tour header */}
            <div
              style={{
                background: '#1a1a1a',
                padding: '18px 22px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '9px', letterSpacing: '0.3em', textTransform: 'uppercase', color: '#666', marginBottom: '4px' }}>
                  Page Guide
                </div>
                <div style={{ fontSize: '16px', fontWeight: 300, color: '#fff' }}>
                  {currentTour.pageTitle}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#b8a06a', letterSpacing: '0.1em' }}>
                {tourStopIndex + 1} / {currentTour.stops.length}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: '2px', background: '#f0f0f0' }}>
              <div
                style={{
                  height: '100%',
                  background: '#b8a06a',
                  width: `${((tourStopIndex + 1) / currentTour.stops.length) * 100}%`,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Tour stop content */}
            <div style={{ padding: '28px 22px 22px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    background: '#f0ede6',
                    border: '1px solid #e0ddd6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    flexShrink: 0,
                  }}
                >
                  {currentTour.stops[tourStopIndex].icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', marginBottom: '6px' }}>
                    {currentTour.stops[tourStopIndex].title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6a6a6a', lineHeight: 1.7 }}>
                    {currentTour.stops[tourStopIndex].description}
                  </div>
                </div>
              </div>

              {/* Dots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
                {currentTour.stops.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === tourStopIndex ? '18px' : '6px',
                      height: '6px',
                      borderRadius: '3px',
                      background: i === tourStopIndex ? '#7D1E2C' : '#e0ddd6',
                      transition: 'all 0.3s',
                    }}
                  />
                ))}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleTourSkip}
                  style={{
                    flex: 1,
                    padding: '11px',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    background: 'transparent',
                    border: '1px solid #e0ddd6',
                    color: '#6a6a6a',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.color = '#1a1a1a'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e0ddd6'; e.currentTarget.style.color = '#6a6a6a'; }}
                >
                  Skip
                </button>
                <button
                  onClick={handleTourNext}
                  style={{
                    flex: 2,
                    padding: '11px',
                    fontSize: '11px',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    background: '#7D1E2C',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#9a2535')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#7D1E2C')}
                >
                  {tourStopIndex < currentTour.stops.length - 1 ? 'Next' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ ONBOARDING WIDGET ════════════ */}
      {!dismissed && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            right: '28px',
            zIndex: 9999,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {/* Card */}
          {isOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 'calc(100% + 12px)',
                right: 0,
                width: '300px',
                maxWidth: 'calc(100vw - 56px)',
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                opacity: 1,
                transform: 'translateY(0)',
                pointerEvents: 'all',
                transition: 'opacity 0.25s, transform 0.25s',
              }}
            >
              {/* Header — turns burgundy and carries the welcome-gift framing
                  while the gift is still on the table, so the offer and the
                  checklist read as one flow rather than two systems. */}
              <div
                style={{
                  padding: giftActive ? '14px 18px 13px' : '16px 18px 14px',
                  borderBottom: giftActive ? 'none' : '1px solid #f0f0f0',
                  background: giftActive
                    ? `linear-gradient(135deg, ${BURGUNDY} 0%, #641622 70%, #4d101a 100%)`
                    : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.25em',
                      textTransform: 'uppercase',
                      color: giftActive ? '#ffffff' : '#1a1a1a',
                    }}
                  >
                    {t('onboarding.title')}
                  </div>
                  <div
                    onClick={handleDismiss}
                    style={{
                      fontSize: '10px',
                      color: giftActive ? 'rgba(255,255,255,0.6)' : '#bbb',
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = giftActive ? '#ffffff' : '#555')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = giftActive ? 'rgba(255,255,255,0.6)' : '#bbb')}
                  >
                    {t('onboarding.dismiss')}
                  </div>
                </div>

                {giftActive && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '11px' }}>
                    <ZaiMark size={17} color="#ffffff" />
                    <div
                      style={{
                        fontFamily: DISPLAY_FONT,
                        fontSize: '13px',
                        fontWeight: 300,
                        lineHeight: 1.35,
                        color: '#ffffff',
                        minWidth: 0,
                        overflowWrap: 'break-word',
                      }}
                    >
                      {t('welcomeGift.headerLine1')} {t('welcomeGift.headerLine2')}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              <div style={{ height: '2px', background: '#f0f0f0', position: 'relative' }}>
                <div style={{ height: '100%', background: '#7D1E2C', width: `${progress}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>

              {/* Steps — the gift panel is rendered inside this scroller,
                  directly under the step it belongs to. `maxHeight` also
                  tracks the viewport so the taller gift composition can never
                  push the card off the top of a short screen. */}
              <div style={{ maxHeight: 'min(420px, calc(100vh - 250px))', overflowY: 'auto' }}>
                {STEPS.map((step) => {
                  const isDone = completedSteps.includes(step.id);
                  const carriesGift = giftActive && step.id === PROFILE_STEP_ID;
                  return (
                    <React.Fragment key={step.id}>
                    <div
                      onClick={() => handleStepClick(step)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '14px 18px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        borderBottom: step.id < STEPS.length - 1 ? '1px solid #f4f4f4' : 'none',
                        background: 'transparent',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Circle */}
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: isDone ? 'none' : '1.5px solid #ccc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.4s',
                          background: isDone ? 'rgba(125,30,44,0.06)' : 'transparent',
                          borderColor: isDone ? '#7D1E2C' : '#ccc',
                        }}
                      >
                        {isDone ? (
                          <svg viewBox="0 0 12 12" fill="none" style={{ width: '11px', height: '11px' }}>
                            <polyline points="2,6 5,9 10,3" stroke="#b8a06a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#aaa', fontWeight: 600 }}>{step.id + 1}</span>
                        )}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            color: isDone ? '#bbb' : '#1a1a1a',
                            letterSpacing: '0.03em',
                            marginBottom: '2px',
                            transition: 'color 0.2s',
                            textDecoration: isDone ? 'line-through' : 'none',
                            textDecorationColor: '#ddd',
                          }}
                        >
                          {step.name}
                          {carriesGift && (
                            <span
                              aria-hidden="true"
                              style={{ marginLeft: '6px', fontSize: '11px', lineHeight: 1 }}
                            >
                              🎁
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.03em' }}>{step.hint}</div>
                      </div>

                      {/* Arrow */}
                      <div style={{ fontSize: '14px', color: isDone ? '#ddd' : '#999', transition: 'all 0.2s', flexShrink: 0 }}>›</div>
                    </div>

                    {/* ── Welcome-gift panel — the reward for finishing this
                        step, shown inline beneath it while it is outstanding.
                        Composed tight to survive the 300px card. ── */}
                    {carriesGift && (
                      <div
                        style={{
                          padding: '0 18px 16px',
                          background: GIFT_PANEL_BG,
                          borderBottom: '1px solid #f4f4f4',
                        }}
                      >
                        {/* Gift callout */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            background: GIFT_CALLOUT_BG,
                            borderLeft: `3px solid ${BURGUNDY}`,
                            padding: '11px 11px 11px 9px',
                            marginTop: '14px',
                          }}
                        >
                          <div
                            aria-hidden="true"
                            style={{
                              width: '32px',
                              height: '32px',
                              flexShrink: 0,
                              background: '#ffffff',
                              border: `1px solid ${BORDER}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              lineHeight: 1,
                            }}
                          >
                            🎁
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '8px',
                                letterSpacing: '0.24em',
                                textTransform: 'uppercase',
                                color: BURGUNDY,
                                fontWeight: 600,
                                marginBottom: '4px',
                              }}
                            >
                              {t('welcomeGift.eyebrow')}
                            </div>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: 500,
                                color: BLACK,
                                lineHeight: 1.25,
                                marginBottom: '3px',
                                overflowWrap: 'break-word',
                              }}
                            >
                              {t('welcomeGift.giftName', giftItem)}
                            </div>
                            <div style={{ fontSize: '9.5px', color: MUTED, lineHeight: 1.45, overflowWrap: 'break-word' }}>
                              {t('welcomeGift.giftSubline')}
                            </div>
                          </div>
                        </div>

                        {/* Explanation */}
                        <p
                          style={{
                            fontSize: '11px',
                            lineHeight: 1.7,
                            color: MUTED,
                            margin: '12px 0 0',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {t('welcomeGift.body', giftItem)}
                        </p>

                        {/* Numbered steps */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', margin: '12px 0 14px' }}>
                          {[t('welcomeGift.step1'), t('welcomeGift.step2')].map((label, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  flexShrink: 0,
                                  borderRadius: '50%',
                                  border: `1px solid ${BURGUNDY}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '9px',
                                  fontWeight: 600,
                                  color: BURGUNDY,
                                }}
                              >
                                {i + 1}
                              </div>
                              <div
                                style={{
                                  fontSize: '10.5px',
                                  color: BLACK,
                                  lineHeight: 1.5,
                                  paddingTop: '2px',
                                  minWidth: 0,
                                  overflowWrap: 'break-word',
                                }}
                              >
                                {label}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Primary CTA — same destination as the step row */}
                        <button
                          type="button"
                          onClick={handleGiftCta}
                          onMouseEnter={() => setGiftCtaHover(true)}
                          onMouseLeave={() => setGiftCtaHover(false)}
                          style={{
                            width: '100%',
                            padding: '12px 8px',
                            background: giftCtaHover ? BURGUNDY_HOVER : BURGUNDY_DEEP,
                            border: 'none',
                            color: '#f5f4f0',
                            fontSize: '10px',
                            fontWeight: 600,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            fontFamily: FONT,
                            transition: 'background 0.2s',
                          }}
                        >
                          {t('welcomeGift.cta')}
                        </button>
                      </div>
                    )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Complete Message */}
              {allDone && (
                <div style={{ padding: '16px 18px', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>✨</div>
                  <p style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                    {t('onboarding.allSetLead')} <span style={{ color: '#b8a06a' }}>{t('onboarding.allSetHighlight')}</span>
                  </p>
                  <div
                    onClick={handleDismiss}
                    style={{
                      marginTop: '10px',
                      fontSize: '10px',
                      color: '#999',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {t('onboarding.hide')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pill */}
          <div
            onClick={() => setIsOpen(!isOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#ffffff',
              border: '1px solid #e0e0e0',
              padding: '10px 16px 10px 10px',
              cursor: 'pointer',
              transition: 'all 0.25s',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#7D1E2C';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)';
            }}
          >
            {/* Ring */}
            <div style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}>
              <svg viewBox="0 0 34 34" width="34" height="34" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
                <circle cx="17" cy="17" r="13" stroke="#e0e0e0" fill="none" strokeWidth="2.5" />
                <circle
                  cx="17"
                  cy="17"
                  r="13"
                  stroke="#7D1E2C"
                  fill="none"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset,
                    transition: 'stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#7D1E2C',
                }}
              >
                {completedSteps.length}/{STEPS.length}
              </div>

              {/* Gift marker — absolutely positioned so advertising the gift on
                  the collapsed pill costs the pill no extra width. */}
              {giftActive && (
                <div
                  title={t('welcomeGift.eyebrow')}
                  aria-label={t('welcomeGift.eyebrow')}
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-4px',
                    width: '15px',
                    height: '15px',
                    borderRadius: '50%',
                    background: BURGUNDY_DEEP,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    lineHeight: 1,
                    boxShadow: '0 0 0 2px #ffffff',
                  }}
                >
                  🎁
                </div>
              )}
            </div>

            {/* Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1a1a1a' }}>
                {t('onboarding.pillTitle')}
              </div>
              <div style={{ fontSize: '10px', color: giftActive ? BURGUNDY_DEEP : '#888', letterSpacing: '0.05em' }}>
                {giftActive
                  ? t('onboarding.giftWaiting')
                  : STEPS.length - completedSteps.length > 0
                    ? t('onboarding.stepsRemaining', { count: STEPS.length - completedSteps.length })
                    : t('onboarding.allDone')}
              </div>
            </div>

            {/* Chevron */}
            <div
              style={{
                marginLeft: '4px',
                color: '#aaa',
                transition: 'transform 0.25s',
                fontSize: '10px',
                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▲
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OnboardingWidget;
