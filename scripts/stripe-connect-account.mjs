/**
 * Connect zai's own Stripe account to the platform, instead of the shell
 * account we created for them.
 *
 *   node scripts/stripe-connect-account.mjs --url          # link to send zai
 *   node scripts/stripe-connect-account.mjs --code ac_xxx  # finish the handshake
 *
 * ── Why ──
 * acct_1U2qw4RIL4qPksAA was created by us on 2026-08-10 purely as a payout
 * destination. Stripe has never verified it, so enabling card payments on it
 * means putting it through full KYC — and every attempt disabled the account
 * and stopped the shop.
 *
 * zai's own account (acct_1LV7EoBwfpwLMs75) is already verified and already
 * taking card payments. Connecting THAT brings the capability with it: no KYC,
 * no documents, no outage. The commercial arrangement is unchanged — their
 * account receives, our fee comes back automatically.
 *
 * Needs STRIPE_CONNECT_CLIENT_ID (ca_...), from the platform dashboard:
 * Settings -> Connect -> Integration. It is not a secret; it appears in the
 * authorisation URL that zai opens.
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
    const q = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
    process.env[m[1]] = q ? v.slice(1, -1) : v;
  }
}

const KEY = process.env.STRIPE_SECRET_KEY;
const CLIENT_ID = process.env.STRIPE_CONNECT_CLIENT_ID;
const WANT_URL = process.argv.includes('--url');
const CODE_IDX = process.argv.indexOf('--code');
const CODE = CODE_IDX > -1 ? process.argv[CODE_IDX + 1] : null;

if (!KEY) {
  console.error('STRIPE_SECRET_KEY not found.');
  process.exit(1);
}

if (WANT_URL) {
  if (!CLIENT_ID) {
    console.error('STRIPE_CONNECT_CLIENT_ID is not set.');
    console.error('');
    console.error('Find it in the PLATFORM dashboard (Onchain Technologies):');
    console.error('  https://dashboard.stripe.com/settings/connect  ->  Integration  ->  Client ID');
    console.error('It starts with ca_ and is not a secret. Add it to apps/frontend/.env.local as');
    console.error('  STRIPE_CONNECT_CLIENT_ID=ca_...');
    process.exit(1);
  }
  // read_write is what lets the platform create charges on their account.
  const url = 'https://connect.stripe.com/oauth/authorize'
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(CLIENT_ID)
    + '&scope=read_write'
    + '&stripe_user[country]=CH';
  console.log('');
  console.log('Send this to zai. They sign into THEIR OWN Stripe account and approve:');
  console.log('');
  console.log('  ' + url);
  console.log('');
  console.log('Stripe then redirects to the URL registered on the platform, with ?code=ac_...');
  console.log('in the address bar. Send that code back and finish with:');
  console.log('');
  console.log('  node scripts/stripe-connect-account.mjs --code ac_...');
  process.exit(0);
}

if (CODE) {
  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(KEY);
  console.log('');
  console.log('Exchanging the authorisation code ...');
  let res;
  try {
    res = await stripe.oauth.token({ grant_type: 'authorization_code', code: CODE });
  } catch (e) {
    console.error('Exchange failed:', e && e.message ? e.message : e);
    console.error('Codes are single use and short lived - generate a fresh link if it has been a while.');
    process.exit(1);
  }
  const connected = res.stripe_user_id;
  console.log('Connected account:', connected);

  const acct = await stripe.accounts.retrieve(connected);
  console.log('');
  console.log('  name           :', acct.business_profile?.name || acct.company?.name || '-');
  console.log('  capabilities   :', Object.entries(acct.capabilities || {}).map(([k, v]) => k + '=' + v).join(' ') || '(none)');
  console.log('  charges/payouts:', acct.charges_enabled ? 'ON' : 'OFF', '/', acct.payouts_enabled ? 'ON' : 'OFF');
  console.log('  currently_due  :', (acct.requirements?.currently_due || []).join(', ') || '-');
  console.log('');
  const ok = (acct.capabilities || {}).card_payments === 'active';
  console.log(ok
    ? 'card_payments is ACTIVE on this account. Set on the server and restart:\n'
      + '  STRIPE_CONNECTED_ACCOUNT_ID=' + connected
    : 'card_payments is not active here either - do not switch yet, tell me what it says.');
  process.exit(0);
}

console.error('Use --url to get the authorisation link, or --code ac_... to finish.');
process.exit(1);
