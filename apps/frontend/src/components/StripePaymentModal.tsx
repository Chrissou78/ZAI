import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const C = {
  black: '#0a0a0a', white: '#f5f4f0', red: '#7A222E',
  gray: '#6a6a6a', border: '#e0ddd6', pureWhite: '#ffffff',
  font: "'Inter', sans-serif",
};

function CheckoutForm({ onSuccess, onCancel, amount }: {
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || loading) return;

    setLoading(true);
    setError('');

    try {
      // Validate form fields first
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Please check your payment details');
        setLoading(false);
        return;
      }

      // Confirm the payment
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/updates?payment=success',
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed. Please try again.');
        setLoading(false);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'requires_action') {
        // 3D Secure or other action — Stripe handles this automatically
        // If we get here after redirect: 'if_required', it means it needs a redirect
        const { error: actionError } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/updates?payment=success',
          },
        });
        if (actionError) {
          setError(actionError.message || 'Authentication failed');
          setLoading(false);
        }
      } else {
        // processing, requires_capture, etc.
        onSuccess();
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        onReady={() => setReady(true)}
        options={{
          layout: 'tabs',
        }}
      />

      {!ready && (
        <div style={{
          textAlign: 'center', padding: '24px 0', color: C.gray, fontSize: 13,
        }}>
          Loading payment form…
        </div>
      )}

      {error && (
        <div style={{
          color: '#e53935', marginTop: 16, fontSize: 13, padding: '10px 14px',
          background: 'rgba(229,57,53,0.08)', borderRadius: 6, border: '1px solid rgba(229,57,53,0.2)',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1, padding: '14px', border: `1px solid ${C.border}`,
            background: C.pureWhite, color: C.black, cursor: loading ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
            borderRadius: 6, fontFamily: C.font, opacity: loading ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !ready || loading}
          style={{
            flex: 1, padding: '14px', border: 'none',
            background: (!stripe || !ready || loading) ? '#999' : C.red,
            color: '#fff', cursor: (!stripe || !ready || loading) ? 'default' : 'pointer',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            borderRadius: 6, fontFamily: C.font,
            transition: 'background 0.2s',
          }}
        >
          {loading ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                animation: 'stripe-spin 0.6s linear infinite', display: 'inline-block',
              }} />
              Processing…
            </span>
          ) : (
            `Pay CHF ${amount.toFixed(2)}`
          )}
        </button>
      </div>

      <div style={{ textAlign: 'center', fontSize: 11, color: C.gray, marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gray} strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Secured by Stripe
      </div>
    </form>
  );
}

export default function StripePaymentModal({ clientSecret, amount, onSuccess, onCancel }: {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: mounted ? 1 : 0, transition: 'opacity 0.2s ease',
      }}
      onClick={onCancel}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div
        style={{
          position: 'relative', background: C.pureWhite, padding: '32px 28px',
          borderRadius: 12, width: '100%', maxWidth: 460, maxHeight: '90vh',
          overflow: 'auto', transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'transform 0.2s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onCancel} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1,
        }}>×</button>

        <h3 style={{
          fontSize: 18, fontWeight: 400, margin: '0 0 4px', color: C.black,
          fontFamily: C.font,
        }}>
          Complete Payment
        </h3>
        <div style={{ fontSize: 13, color: C.gray, marginBottom: 24 }}>
          CHF {amount.toFixed(2)}
        </div>

        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: {
                colorPrimary: C.red,
                colorText: C.black,
                fontFamily: C.font,
                borderRadius: '6px',
              },
              rules: {
                '.Input': {
                  border: `1px solid ${C.border}`,
                  boxShadow: 'none',
                },
                '.Input:focus': {
                  border: `1px solid ${C.red}`,
                  boxShadow: `0 0 0 1px ${C.red}`,
                },
              },
            },
          }}
        >
          <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} amount={amount} />
        </Elements>
      </div>

      <style>{`
        @keyframes stripe-spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
