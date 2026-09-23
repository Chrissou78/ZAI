/**
 * Which Stripe account a charge belongs to.
 *
 * Two models, chosen by STRIPE_DIRECT_CHARGES:
 *
 * DESTINATION CHARGES (default, the historical behaviour)
 *   The charge is created on the platform account. The platform receives the
 *   full amount, keeps its fee and transfers the rest to zai. The platform is
 *   the merchant of record, so the buyer's receipt and bank statement carry
 *   the PLATFORM's name — which is the whole reason for the switch below.
 *
 * DIRECT CHARGES (STRIPE_DIRECT_CHARGES=true)
 *   The charge is created ON zai's account. zai receives the full amount and
 *   is the merchant of record natively, so receipts, Apple Pay, TWINT and bank
 *   lines all show zai. Our commission comes back automatically as an
 *   application fee. This is the money flow zai asked for: their account takes
 *   everything and sends the fee percentage back to us.
 *
 * ── Why this is a flag and not just the behaviour ──
 * Direct charges CANNOT fall back. A destination charge that zai's account
 * cannot settle can be retried on the platform; a direct charge has nowhere to
 * go, because the charge is being created on that account in the first place.
 * So until `card_payments` is active on the connected account, turning this on
 * stops every purchase outright. Check with window.zaiCheck() — the Stripe
 * section reports the capability — and only then set the flag.
 */

export const CONNECTED_ACCOUNT = process.env.STRIPE_CONNECTED_ACCOUNT_ID || null;

export const DIRECT_CHARGES =
  (process.env.STRIPE_DIRECT_CHARGES || '').trim().toLowerCase() === 'true'
  && !!CONNECTED_ACCOUNT;

export async function getStripe() {
  const Stripe = (await import('stripe')).default;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

/**
 * The per-request options that say "this belongs to zai's account".
 *
 * Returns undefined in destination mode, which every Stripe method accepts as
 * "no options" — so call sites can pass it unconditionally rather than
 * branching, and a site that forgets it in direct mode fails loudly by looking
 * for an object on the wrong account rather than quietly acting on the wrong
 * one.
 */
export function chargeContext() {
  return DIRECT_CHARGES ? { stripeAccount: CONNECTED_ACCOUNT } : undefined;
}

/**
 * Apply the routing half of a PaymentIntent — fee, destination, merchant of
 * record — to a config object built by the caller.
 *
 * The two models need mutually exclusive fields, and mixing them is an error
 * Stripe reports obscurely, so they are decided here once rather than at each
 * charge site.
 */
export function applyChargeRouting(piConfig, amountMinor, feePercent) {
  if (!CONNECTED_ACCOUNT || !(amountMinor > 0)) return piConfig;

  const fee = Math.round(amountMinor * feePercent / 100);

  if (DIRECT_CHARGES) {
    // The charge lives on zai's account, so there is nothing to transfer and
    // no merchant of record to override — zai already is it. Only our cut
    // moves, and it moves to the platform.
    if (fee > 0) piConfig.application_fee_amount = fee;
    return piConfig;
  }

  piConfig.application_fee_amount = fee;
  piConfig.transfer_data = { destination: CONNECTED_ACCOUNT };
  // See the note at each call site: this asks Stripe to name zai as merchant
  // of record on a charge that still belongs to the platform.
  if ((process.env.STRIPE_ON_BEHALF_OF || '').trim().toLowerCase() !== 'false') {
    piConfig.on_behalf_of = CONNECTED_ACCOUNT;
  }
  return piConfig;
}
