import React, { useState, useEffect } from 'react';

interface OnboardingStep {
  id: number;
  name: string;
  hint: string;
}

const OnboardingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [dismissed, setDismissed] = useState(false);

  const steps: OnboardingStep[] = [
    { id: 0, name: 'Complete your profile', hint: 'Add your details & preferences' },
    { id: 1, name: 'Claim your product', hint: 'Register your zai with your card' },
    { id: 2, name: 'Visit your dashboard', hint: 'See your full experience overview' },
    { id: 3, name: 'Connect with the community', hint: 'Link Instagram & follow WhatsApp' },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dismissed) setIsOpen(true);
    }, 800);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const progress = (completedSteps.length / steps.length) * 100;
  const circumference = 2 * Math.PI * 13;
  const strokeDashoffset = circumference - (completedSteps.length / steps.length) * circumference;

  if (dismissed) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        zIndex: 9999,
        fontFamily: 'Inter, sans-serif',
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
          <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#1a1a1a' }}>
              Getting Started
            </div>
            <div
              onClick={() => setDismissed(true)}
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
            {steps.map((step) => {
              const isDone = completedSteps.includes(step.id);
              return (
                <div
                  key={step.id}
                  onClick={() => {
                    if (!isDone) {
                      setCompletedSteps([...completedSteps, step.id]);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    borderBottom: step.id < steps.length - 1 ? '1px solid #f4f4f4' : 'none',
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
                  <div style={{ fontSize: '12px', color: '#333', transition: 'all 0.2s', flexShrink: 0 }}>›</div>
                </div>
              );
            })}
          </div>

          {/* Complete Message */}
          {completedSteps.length === steps.length && (
            <div style={{ padding: '16px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>✦</div>
              <p style={{ fontSize: '11px', color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                You're all set — <span style={{ color: '#b8a06a' }}>welcome to zai</span>
              </p>
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
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#7D1E2C';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.15)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = '#e0e0e0';
          (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.6)';
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
                strokeDashoffset: strokeDashoffset,
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
            {completedSteps.length}/{steps.length}
          </div>
        </div>

        {/* Text */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#1a1a1a' }}>
            Getting started
          </div>
          <div style={{ fontSize: '10px', color: '#888', letterSpacing: '0.05em' }}>
            {steps.length - completedSteps.length > 0
              ? `${steps.length - completedSteps.length} step${steps.length - completedSteps.length > 1 ? 's' : ''} remaining`
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
  );
};

export default OnboardingWidget;
