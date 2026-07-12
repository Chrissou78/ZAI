import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

function CheckoutForm({ onSuccess, onCancel, amount }: {
  onSuccess: () => void;
  onCancel: () => void;
  amount: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/updates?payment=success',
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message || 'Payment failed');
      setLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && (
        <p style={{ color: '#e53935', marginTop: 12, fontSize: 14 }}>{error}</p>
      )}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          style={{
            flex: 1, padding: '12px', border: '1px solid #333',
            background: 'transparent', color: '#fff', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || loading}
          style={{
            flex: 1, padding: '12px', border: 'none',
            background: '#e53935', color: '#fff', cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Processing…' : `Pay CHF ${amount.toFixed(2)}`}
        </button>
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
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a1a', padding: 32, borderRadius: 8,
        width: '100%', maxWidth: 440, border: '1px solid #333',
      }}>
        <h3 style={{ color: '#fff', margin: '0 0 20px' }}>Complete Payment</h3>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'night',
              variables: {
                colorPrimary: '#e53935',
                colorBackground: '#1a1a1a',
                colorText: '#ffffff',
              },
            },
          }}
        >
          <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} amount={amount} />
        </Elements>
      </div>
    </div>
  );
}
