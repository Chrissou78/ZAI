import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiService } from '../../services/api';
import { ZaiMark } from '../Icons/LogoIcons';

/* ══════════════════════════════════════════════════════════════════════════
   Welcome-gift campaign window — SINGLE SOURCE OF TRUTH
   ─────────────────────────────────────────────────────────────────────────
   The client gifts a physical item to every member who registers during the
   first three months of the promotional period. Both bounds are FIXED ISO
   instants (never derived from Date.now()), so the campaign stops by itself
   once the window closes — it is re-evaluated on every mount, no manual
   cleanup needed. To extend or end the campaign, change these two constants
   only. They used to live in OnboardingWidget.tsx alongside a duplicate
   gift-promo panel; that panel is gone and this is now the only definition.
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

/* Small entrance delay so the modal does not slam in during first paint. */
const ENTRANCE_DELAY_MS = 600;

/* ── Design tokens (mirrors the rest of the app — inline styles, no CSS modules) ── */
const BURGUNDY = '#7D1E2C';
const BURGUNDY_HOVER = '#9a2535';
const OFF_WHITE = '#f5f4f0';
const BLACK = '#0a0a0a';
const MUTED = '#6a6a6a';
const BORDER = '#e0ddd6';
const FONT = "'Inter', sans-serif";
const DISPLAY_FONT = "'Georgia', 'Times New Roman', serif";

interface WelcomeGiftModalProps {
  /** Logged-in member id. The modal stays dormant until this is present. */
  userId?: string | null;
  /** Invoked after the modal closes when the member picks "Complete your profile". */
  onCompleteProfile: () => void;
}

const WelcomeGiftModal: React.FC<WelcomeGiftModalProps> = ({ userId, onCompleteProfile }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const [closeHover, setCloseHover] = useState(false);
  const [laterHover, setLaterHover] = useState(false);

  // One check per mounted session — never re-ask the API after a close.
  const checkedRef = useRef(false);

  /* ── Should this member see the modal? ──
     Persistence is ACCOUNT-LEVEL on purpose: `welcomeGiftSeen` comes from
     GET /users/me, not localStorage, so the modal does not reappear after a
     cache clear, in incognito, or on another device. */
  useEffect(() => {
    if (!userId || checkedRef.current) return;
    if (!isGiftPromoWindowOpen()) return;
    checkedRef.current = true;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        const res = await apiService.get('/users/me');
        const payload = res.data as any;
        const seen = payload?.data?.welcomeGiftSeen ?? payload?.welcomeGiftSeen;
        if (cancelled || seen === true) return;
        timer = setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, ENTRANCE_DELAY_MS);
      } catch {
        // Could not read the flag — stay silent rather than risk nagging a
        // member who has already seen (and dismissed) the offer.
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [userId]);

  /* ── Mark seen + close ──
     Fire-and-forget: the modal closes immediately and a failed POST never
     traps the member behind a request. `apiService.post` also invalidates the
     cached GET /users/me, so a later visit in the same session reads the
     updated flag rather than the stale one. */
  const dismiss = (then?: () => void) => {
    setVisible(false);
    apiService.post('/users/me/welcome-gift-seen', {}).catch(() => {
      /* Non-fatal: worst case the modal is offered once more on a later visit. */
    });
    if (then) then();
  };

  /* ── Escape closes ── */
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visible]);

  if (!visible) return null;

  const giftItem = { item: WELCOME_GIFT_ITEM };

  const steps = [t('welcomeGift.step1'), t('welcomeGift.step2')];

  return (
    <div
      onClick={() => dismiss()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        fontFamily: FONT,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-gift-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 'min(420px, calc(100vw - 32px))',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: OFF_WHITE,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          boxSizing: 'border-box',
        }}
      >
        {/* ══════════ Header ══════════ */}
        <div
          style={{
            position: 'relative',
            background: `linear-gradient(135deg, ${BURGUNDY} 0%, #641622 60%, #4d101a 100%)`,
            padding: '34px 28px 30px',
            textAlign: 'center',
          }}
        >
          {/* Explicit close control — required: full-screen mobile modals
              without a visible ✕ have bitten this codebase twice. */}
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label={t('welcomeGift.close')}
            title={t('welcomeGift.close')}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              color: '#ffffff',
              opacity: closeHover ? 1 : 0.7,
              fontSize: '17px',
              lineHeight: 1,
              cursor: 'pointer',
              padding: 0,
              transition: 'opacity 0.2s',
              fontFamily: FONT,
            }}
          >
            ✕
          </button>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <ZaiMark size={30} color="#ffffff" />
          </div>
          <div
            style={{
              fontSize: '10px',
              letterSpacing: '0.42em',
              textTransform: 'lowercase',
              color: 'rgba(255,255,255,0.75)',
              marginBottom: '18px',
            }}
          >
            zai
          </div>
          <div
            id="welcome-gift-title"
            style={{
              fontFamily: DISPLAY_FONT,
              fontSize: '26px',
              fontWeight: 300,
              lineHeight: 1.28,
              color: '#ffffff',
            }}
          >
            {t('welcomeGift.headerLine1')}
            <br />
            {t('welcomeGift.headerLine2')}
          </div>
        </div>

        {/* ══════════ Body ══════════ */}
        <div style={{ padding: '26px 28px 28px', background: OFF_WHITE }}>
          {/* ── Gift callout ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              background: '#ebe9e3',
              borderLeft: `3px solid ${BURGUNDY}`,
              padding: '16px 16px 16px 14px',
              marginBottom: '22px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                flexShrink: 0,
                background: '#ffffff',
                border: `1px solid ${BORDER}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '19px',
                lineHeight: 1,
              }}
              aria-hidden="true"
            >
              🎁
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '9px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: BURGUNDY,
                  fontWeight: 600,
                  marginBottom: '6px',
                }}
              >
                {t('welcomeGift.eyebrow')}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: 500,
                  color: BLACK,
                  lineHeight: 1.3,
                  marginBottom: '4px',
                }}
              >
                {t('welcomeGift.giftName', giftItem)}
              </div>
              <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>
                {t('welcomeGift.giftSubline')}
              </div>
            </div>
          </div>

          {/* ── Explanation ── */}
          <p
            style={{
              fontSize: '13px',
              lineHeight: 1.8,
              color: MUTED,
              margin: '0 0 22px',
            }}
          >
            {t('welcomeGift.body', giftItem)}
          </p>

          {/* ── Numbered steps ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '26px' }}>
            {steps.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    flexShrink: 0,
                    borderRadius: '50%',
                    border: `1px solid ${BURGUNDY}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: BURGUNDY,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ fontSize: '12.5px', color: BLACK, lineHeight: 1.65, paddingTop: '2px' }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Primary CTA ── */}
          <button
            type="button"
            onClick={() => dismiss(onCompleteProfile)}
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => setCtaHover(false)}
            style={{
              width: '100%',
              padding: '15px',
              background: ctaHover ? BURGUNDY_HOVER : BURGUNDY,
              border: 'none',
              color: OFF_WHITE,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontFamily: FONT,
              transition: 'background 0.2s',
            }}
          >
            {t('welcomeGift.cta')}
          </button>

          {/* ── Secondary dismissal ── */}
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => dismiss()}
              onMouseEnter={() => setLaterHover(true)}
              onMouseLeave={() => setLaterHover(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px 8px',
                fontSize: '10px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: laterHover ? BLACK : MUTED,
                cursor: 'pointer',
                fontFamily: FONT,
                transition: 'color 0.2s',
              }}
            >
              {t('welcomeGift.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeGiftModal;
