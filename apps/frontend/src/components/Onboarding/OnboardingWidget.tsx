import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// ── Keys for localStorage persistence ──
const STORAGE_KEY_STEPS = 'zai_onboarding_completed';
const STORAGE_KEY_DISMISSED = 'zai_onboarding_dismissed';
const STORAGE_KEY_TOURS = 'zai_page_tours_seen';

interface OnboardingStep {
  id: number;
  name: string;
  hint: string;
  route: string;           // where to navigate
  completionRoute: string; // visiting this route fulfils the step
}

const STEPS: OnboardingStep[] = [
  { id: 0, name: 'Complete your profile',       hint: 'Add your details & preferences', route: '/profile',   completionRoute: '/profile' },
  { id: 1, name: 'Claim your product',          hint: 'Register your zai with your card', route: '/products',  completionRoute: '/products' },
  { id: 2, name: 'Visit your dashboard',        hint: 'See your full experience overview', route: '/dashboard', completionRoute: '/dashboard' },
  { id: 3, name: 'Connect with the community',  hint: 'Meet members & share photos',     route: '/community', completionRoute: '/community' },
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
      { title: 'Claim a Product', description: 'Click "+ Claim Product" or the "+" card to register a new product using your NFC Experience Card or serial number.', icon: '📦' },
      { title: 'Activate Insurance', description: 'For each claimed product you can activate insurance through our partner Suisse Alpine Services.', icon: '🛡️' },
    ],
  },
  '/dashboard': {
    pageTitle: 'Your Dashboard',
    stops: [
      { title: 'Welcome Section', description: 'See your profile summary, verification status, and a quick snapshot of your products and events.', icon: '👋' },
      { title: 'Stats Overview', description: 'Track your total claimed products, upcoming events, and active insurance policies at a glance.', icon: '📊' },
      { title: 'Recent Activity', description: 'Your latest claims, event registrations, and membership updates appear here.', icon: '🕒' },
      { title: 'Quick Actions', description: 'Jump directly to claim a product or browse upcoming events.', icon: '⚡' },
    ],
  },
  '/community': {
    pageTitle: 'Community',
    stops: [
      { title: 'Photo Feed', description: 'Browse and share photos from the zai community. Upload images, add captions, and tag members.', icon: '📸' },
      { title: 'Members', description: 'See all club members and start direct conversations with them.', icon: '👥' },
      { title: 'Chat', description: 'Join the general chat or send private messages to other members.', icon: '💬' },
    ],
  },
};

const OnboardingWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
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
        // For "Claim your product" (step 1), we don't auto-complete on visit alone
        // — it completes when the claim modal is used (handled via event below)
        if (step.id === 1) return;

        setCompletedSteps((prev) => {
          if (prev.includes(step.id)) return prev;
          return [...prev, step.id];
        });
      }
    });

    // Trigger page tour if first visit
    if (PAGE_TOURS[path] && !seenTours.includes(path)) {
      // Small delay so the page renders first
      const tourTimer = setTimeout(() => {
        setTourPage(path);
        setTourStopIndex(0);
        setShowTour(true);
      }, 600);
      return () => clearTimeout(tourTimer);
    }
  }, [location.pathname]);

  // ── Listen for custom "product claimed" event to complete step 1 ──
  useEffect(() => {
    const handler = () => {
      setCompletedSteps((prev) => {
        if (prev.includes(1)) return prev;
        return [...prev, 1];
      });
    };
    window.addEventListener('zai:product-claimed', handler);
    return () => window.removeEventListener('zai:product-claimed', handler);
  }, []);

  // ── Tour handlers ──
  const currentTour = PAGE_TOURS[tourPage];

  const handleTourNext = () => {
    if (!currentTour) return;
    if (tourStopIndex < currentTour.stops.length - 1) {
      setTourStopIndex((i) => i + 1);
    } else {
      // Tour finished
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
                background: '#ffffff',
                border: '1px solid #e8e8e8',
                boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
                opacity: 1,
                transform: 'translateY(0)',
                pointerEvents: 'all',
                transition: 'opacity 0.25s, transform 0.25s',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 18px 14px',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a' }}>
                  Getting Started
                </div>
                <div
                  onClick={handleDismiss}
                  style={{
                    fontSize: '10px',
                    color: '#bbb',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#555')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#bbb')}
                >
                  Dismiss
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '2px', background: '#f0f0f0', position: 'relative' }}>
                <div style={{ height: '100%', background: '#7D1E2C', width: `${progress}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>

              {/* Steps */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {STEPS.map((step) => {
                  const isDone = completedSteps.includes(step.id);
                  return (
                    <div
                      key={step.id}
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
                        </div>
                        <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.03em' }}>{step.hint}</div>
                      </div>

                      {/* Arrow */}
                      <div style={{ fontSize: '14px', color: isDone ? '#ddd' : '#999', transition: 'all 0.2s', flexShrink: 0 }}>›</div>
                    </div>
                  );
                })}
              </div>

              {/* Complete Message */}
              {allDone && (
                <div style={{ padding: '16px 18px', textAlign: 'center', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '22px', marginBottom: '8px' }}>✨</div>
                  <p style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
                    You're all set — <span style={{ color: '#b8a06a' }}>welcome to zai</span>
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
                    Hide this widget
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
            </div>

            {/* Text */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1a1a1a' }}>
                Getting started
              </div>
              <div style={{ fontSize: '10px', color: '#888', letterSpacing: '0.05em' }}>
                {STEPS.length - completedSteps.length > 0
                  ? `${STEPS.length - completedSteps.length} step${STEPS.length - completedSteps.length > 1 ? 's' : ''} remaining`
                  : 'All done!'}
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
