/**
 * Can zai's connected account actually take a payment, and under what name?
 *
 * "The buyer's statement still says WALLETTWO ONCHAINLABS" has two possible
 * causes that look identical from outside: either the account cannot settle
 * the charge at all — so the PaymentIntent falls back to the platform — or it
 * can, but its business name and statement descriptor were never filled in.
 * Both are fixed in the Stripe Dashboard, in different places, and guessing
 * between them has already cost days.
 *
 * So ask Stripe. This reads the connected account and reports the two things
 * that decide what a buyer sees: whether card payments are live, and which
 * name is configured. Read-only.
 */
export async function stripeAccountStatus() {
  const accountId = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  const direct = (process.env.STRIPE_DIRECT_CHARGES || '').trim().toLowerCase() === 'true';
  const merchantOfRecord =
    direct || (process.env.STRIPE_ON_BEHALF_OF || '').trim().toLowerCase() !== 'false';

  if (!accountId) {
    return {
      configured: false,
      reason: 'STRIPE_CONNECTED_ACCOUNT_ID is not set — payments stay entirely on the platform account.',
    };
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return { configured: false, reason: 'STRIPE_SECRET_KEY is not set.' };
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const acct = await stripe.accounts.retrieve(accountId);

    const caps = acct.capabilities || {};
    const cardPayments = caps.card_payments || 'missing';
    const transfers = caps.transfers || 'missing';
    // The name a buyer sees comes from the account, never from our code.
    const businessName =
      acct.business_profile?.name || acct.settings?.dashboard?.display_name || null;
    const descriptor = acct.settings?.card_payments?.statement_descriptor
      || acct.settings?.payments?.statement_descriptor
      || null;

    const canCharge = cardPayments === 'active';
    const notes = [];
    if (direct && !canCharge) {
      // Worth stating first and plainly: unlike the destination model, this one
      // has no fallback. Every purchase fails until the capability is live.
      notes.push(
        'DIRECT CHARGES ARE ON BUT THIS ACCOUNT CANNOT CHARGE. There is no fallback in '
        + 'this mode — the charge is created on this account, so every purchase will fail '
        + 'until card_payments is active. Set STRIPE_DIRECT_CHARGES=false and restart to '
        + 'restore sales while the capability is enabled.'
      );
    }
    if (!merchantOfRecord) {
      notes.push('STRIPE_ON_BEHALF_OF=false — the platform is deliberately the merchant of record.');
    }
    if (!canCharge) {
      notes.push(
        `card_payments is "${cardPayments}" on this account, not "active". Stripe will reject `
        + 'any PaymentIntent that names it as merchant of record, so each payment falls back to '
        + 'the platform and the buyer sees the PLATFORM name. Enable card payments (and TWINT) '
        + 'for CHF on this account in the Stripe Dashboard — this is not about whether zai '
        + 'accepts francs, it is about what is switched on in this account.'
      );
    }
    if (canCharge && !businessName) {
      notes.push('No business name set on this account, so Stripe has nothing better to display.');
    }
    if (canCharge && !descriptor) {
      notes.push('No statement descriptor set on this account — bank lines will fall back to the business name.');
    }

    return {
      configured: true,
      accountId,
      merchantOfRecordRequested: merchantOfRecord,
      model: direct ? 'direct charges (zai receives, fee returns to platform)'
                    : 'destination charges (platform receives, transfers to zai)',
      // The bottom line, in one field: is the buyer seeing zai or not?
      buyerSeesThisAccount: merchantOfRecord && canCharge,
      capabilities: { card_payments: cardPayments, transfers },
      businessName,
      statementDescriptor: descriptor,
      country: acct.country || null,
      chargesEnabled: !!acct.charges_enabled,
      payoutsEnabled: !!acct.payouts_enabled,
      notes,
    };
  } catch (e) {
    return { configured: false, accountId, reason: e?.message || 'Could not read the connected account.' };
  }
}
