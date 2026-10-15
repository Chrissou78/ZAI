import { loadStripe, type Stripe } from '@stripe/stripe-js/pure';

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

/**
 * Stripe.js for the account a payment lives on.
 *
 * Normally that is the platform (no account given). When payments are created
 * directly on zai's own Stripe account, the API returns that account's id and
 * Stripe.js has to be initialised with it, or confirming the payment fails
 * with "No such payment_intent". One instance per account, reused.
 */
const byAccount = new Map<string, Promise<Stripe | null>>();
export function stripeFor(account?: string | null): Promise<Stripe | null> {
  if (!account) return stripePromise;
  let p = byAccount.get(account);
  if (!p) {
    p = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY, { stripeAccount: account });
    byAccount.set(account, p);
  }
  return p;
}
