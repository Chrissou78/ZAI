/**
 * Inspect, roll back, or resume onboarding on the connected account.
 *
 *     node scripts/stripe-account.mjs                 # report
 *     node scripts/stripe-account.mjs --undo          # withdraw the card_payments request
 *     node scripts/stripe-account.mjs --link          # onboarding URL for zai to complete KYC
 *
 * ── What happened, so the next person does not repeat it ──
 * Requesting card_payments on this account moved its verification requirements
 * from "eventually" to "past due". Stripe then disabled the whole account:
 * transfers went active -> inactive and charges/payouts went off. Because the
 * app sends destination charges there, that breaks checkout, not just the
 * merchant name.
 *
 * --undo withdraws the request. If Stripe restores transfers, selling resumes
 * immediately and zai can complete the paperwork at their own pace.
 * --link produces the hosted onboarding URL, which is the only way zai can
 * supply what Stripe is asking for: this account has stripe_dashboard "none",
 * so they cannot log in and fill it in themselves.
 */

import { readFileSync, existsSync } from 'node:fs';

const ENV_FILES = ['.env', '.env.local', 'apps/frontend/.env.local'];
const ASSIGNMENT = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/;

for (const file of ENV_FILES) {
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const m = ASSIGNMENT.exec(raw.replace(/\r$/, ''));
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    const quoted = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
    process.env[m[1]] = quoted ? v.slice(1, -1) : v;
  }
}

const KEY = process.env.STRIPE_SECRET_KEY;
const ACCOUNT = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
const UNDO = process.argv.includes('--undo');
const LINK = process.argv.includes('--link');
const APP_URL = process.env.PUBLIC_APP_URL || 'https://experience.zai.ch';

if (!KEY || !ACCOUNT) {
  console.error('STRIPE_SECRET_KEY and STRIPE_CONNECTED_ACCOUNT_ID are both required.');
  process.exit(1);
}

const Stripe = (await import('stripe')).default;
const stripe = new Stripe(KEY);

function show(acct, label) {
  const req = acct.requirements || {};
  console.log('');
  console.log(label);
  console.log('  charges / payouts     :', acct.charges_enabled ? 'ON' : 'OFF', '/', acct.payouts_enabled ? 'ON' : 'OFF');
  console.log('  capabilities          :',
    Object.entries(acct.capabilities || {}).map(([k, v]) => k + '=' + v).join(' ') || '(none)');
  console.log('  disabled_reason       :', req.disabled_reason || '-');
  console.log('  currently_due         :', (req.currently_due || []).join(', ') || '-');
  console.log('  past_due              :', (req.past_due || []).join(', ') || '-');
  // What Stripe will ask for eventually. After withdrawing a capability
  // request currently_due empties, but these remain — and they are what the
  // hosted onboarding form will actually collect.
  console.log('  eventually_due        :', (req.eventually_due || []).join(', ') || '-');
  // Selling is what matters most right now, so say it in plain words.
  const canReceive = (acct.capabilities || {}).transfers === 'active';
  console.log('  >> destination charges:', canReceive ? 'WORKING' : 'BROKEN - payments to this account will fail');
}

const before = await stripe.accounts.retrieve(ACCOUNT);
show(before, 'CURRENT  ' + ACCOUNT);

if (UNDO) {
  console.log('');
  console.log('Withdrawing the card_payments request ...');
  const after = await stripe.accounts.update(ACCOUNT, {
    capabilities: { card_payments: { requested: false } },
  });
  show(after, 'AFTER --undo');
  console.log('');
  console.log(
    (after.capabilities || {}).transfers === 'active'
      ? 'Transfers restored. Selling works again; the merchant name stays the platform until'
        + ' zai complete verification.'
      : 'Transfers are still inactive. Stripe is not releasing the account until the'
        + ' requirements are met - use --link and have zai complete it.'
  );
}

if (LINK) {
  console.log('');
  const link = await stripe.accountLinks.create({
    account: ACCOUNT,
    refresh_url: APP_URL + '/dashboard',
    return_url: APP_URL + '/dashboard',
    type: 'account_onboarding',
  });
  console.log('Send this to zai. It expires in a few minutes, so generate it when they are ready:');
  console.log('');
  console.log('  ' + link.url);
  console.log('');
  console.log('Stripe asks them only for what is outstanding above - company phone, tax id,');
  console.log('MCC and the owner details. Once submitted, capabilities go active on their own.');
}

if (!UNDO && !LINK) {
  console.log('');
  console.log('Read-only. Use --undo to withdraw the capability request, or --link for onboarding.');
}
