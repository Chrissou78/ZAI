/**
 * Ask Stripe to enable card payments on zai's connected account.
 *
 * Run ON THE SERVER, where STRIPE_SECRET_KEY already exists:
 *
 *     node scripts/request-card-payments.mjs          # report only
 *     node scripts/request-card-payments.mjs --apply  # actually request it
 *
 * Why a script rather than a dashboard click: the account reports
 * `type: "none"`, which means it was created with a `controller` rather than
 * as standard/express/custom. On those accounts capabilities are requested
 * over the API by whichever side the controller nominates — there is no
 * "request" button to find in either dashboard, which is exactly what we kept
 * looking for and not finding.
 *
 * Without --apply this changes nothing; it prints who controls what, so the
 * decision is made on facts.
 */

const KEY = process.env.STRIPE_SECRET_KEY;
const ACCOUNT = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
const APPLY = process.argv.includes('--apply');

if (!KEY) { console.error('STRIPE_SECRET_KEY is not set in this environment.'); process.exit(1); }
if (!ACCOUNT) { console.error('STRIPE_CONNECTED_ACCOUNT_ID is not set in this environment.'); process.exit(1); }

const Stripe = (await import('stripe')).default;
const stripe = new Stripe(KEY);

const show = (acct) => {
  const c = acct.controller || {};
  console.log('  account            :', acct.id, `(type: ${acct.type || 'none'})`);
  console.log('  charges / payouts  :', acct.charges_enabled ? 'on' : 'off', '/', acct.payouts_enabled ? 'on' : 'off');
  console.log('  capabilities       :',
    Object.entries(acct.capabilities || {}).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)');
  // These two decide who may request a capability at all.
  console.log('  controller.type    :', c.type || '—');
  console.log('  requirement_collection:', c.requirement_collection || '—',
    c.requirement_collection === 'application'
      ? '→ WE collect requirements, so WE can request capabilities'
      : c.requirement_collection === 'stripe'
        ? '→ STRIPE collects them; zai enables this in their own dashboard'
        : '');
  console.log('  stripe_dashboard   :', c.stripe_dashboard?.type || '—');
  console.log('  fees payer         :', c.fees?.payer || '—');
  console.log('  losses.payments    :', c.losses?.payments || '—');
  const req = acct.requirements || {};
  console.log('  disabled_reason    :', req.disabled_reason || '—');
  console.log('  currently_due      :', (req.currently_due || []).join(', ') || '—');
};

console.log('\nBEFORE');
const before = await stripe.accounts.retrieve(ACCOUNT);
show(before);

if ((before.capabilities || {}).card_payments === 'active') {
  console.log('\ncard_payments is already active — nothing to do.');
  process.exit(0);
}

if (!APPLY) {
  console.log('\nRead-only. Re-run with --apply to request card_payments (and twint_payments).');
  process.exit(0);
}

console.log('\nRequesting card_payments and twint_payments …');
try {
  const after = await stripe.accounts.update(ACCOUNT, {
    capabilities: {
      card_payments: { requested: true },
      // TWINT is the method club members actually use; requesting it here
      // avoids a second round trip when cards come back active.
      twint_payments: { requested: true },
    },
  });
  console.log('\nAFTER');
  show(after);
  const state = (after.capabilities || {}).card_payments;
  console.log(
    state === 'active'
      ? '\nDone — card_payments is ACTIVE. zai is now the merchant of record on the next purchase.'
      : `\ncard_payments is now "${state}". Stripe is collecting the requirements listed above;`
        + ' it goes active once they are satisfied.'
  );
} catch (e) {
  console.error('\nRequest refused:', e?.message || e);
  console.error(
    '\nIf this says capabilities cannot be requested on this account, then Stripe — not the'
    + ' platform — collects its requirements, and zai enables card payments from their own'
    + ' dashboard: Settings → Payments → Payment methods.'
  );
  process.exit(1);
}
