/**
 * Ask Stripe to enable card payments on zai's connected account.
 *
 *     node scripts/request-card-payments.mjs                  # report only
 *     node scripts/request-card-payments.mjs acct_xxx         # report on another account
 *     node scripts/request-card-payments.mjs --apply          # request the capability
 *
 * Why a script rather than a dashboard click: the connected account can charge
 * for itself, but the PLATFORM has no card_payments grant on it — only
 * transfers was ever requested. That grant is what on_behalf_of and direct
 * charges need, it appears on no settings page, and Stripe calls it a
 * "capability" (fonctionnalité in the French dashboard).
 *
 * Requests card_payments only. Nothing else, and nothing French.
 */

import { readFileSync, existsSync } from 'node:fs';

// Node does not read .env files and this project has no dotenv — the server
// takes its environment from whatever starts the process. Run from a laptop,
// that makes the keys look absent while they sit in a file right here. Values
// are never printed.
const ENV_FILES = ['.env', '.env.local', 'apps/frontend/.env.local'];
const ASSIGNMENT = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/;

for (const file of ENV_FILES) {
  if (!existsSync(file)) continue;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const m = ASSIGNMENT.exec(raw.replace(/\r$/, ''));
    if (!m) continue;
    // A real environment variable always wins, so an explicit export is never
    // silently overridden by a stale file in the checkout.
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2].trim().replace(/\s+#.*$/, '');
    const quoted = (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"));
    process.env[m[1]] = quoted ? v.slice(1, -1) : v;
  }
}

const KEY = process.env.STRIPE_SECRET_KEY;
const APPLY = process.argv.includes('--apply');
// An account id can be passed to inspect one OTHER than the configured
// destination — for checking another account is reachable from this platform
// before repointing anything at it.
const ARG_ACCOUNT = process.argv.find(a => a.startsWith('acct_'));
const ACCOUNT = ARG_ACCOUNT || process.env.STRIPE_CONNECTED_ACCOUNT_ID;

if (!KEY) {
  console.error('STRIPE_SECRET_KEY not found in the environment or in ' + ENV_FILES.join(', ') + '.');
  process.exit(1);
}
if (!KEY.startsWith('sk_') && !KEY.startsWith('rk_')) {
  console.error('That does not look like a Stripe secret key (expected sk_live_... or sk_test_...).');
  process.exit(1);
}
if (!ACCOUNT) {
  console.error('No account: pass one as an argument (acct_...) or set STRIPE_CONNECTED_ACCOUNT_ID.');
  process.exit(1);
}
if (ARG_ACCOUNT && APPLY) {
  // Requesting a capability against an account named ad hoc on the command
  // line is too easy to do to the wrong one.
  console.error('Refusing --apply for an account given as an argument.');
  console.error('Inspect it first, then set STRIPE_CONNECTED_ACCOUNT_ID and re-run with no argument.');
  process.exit(1);
}

const Stripe = (await import('stripe')).default;
const stripe = new Stripe(KEY);

function show(acct) {
  const c = acct.controller || {};
  const req = acct.requirements || {};
  console.log('  account               :', acct.id, '(type: ' + (acct.type || 'none') + ')');
  console.log('  name                  :', acct.business_profile?.name || '-');
  console.log('  email                 :', acct.email || '-');
  console.log('  created               :', acct.created ? new Date(acct.created * 1000).toISOString().slice(0, 10) : '-');
  console.log('  charges / payouts     :', acct.charges_enabled ? 'on' : 'off', '/', acct.payouts_enabled ? 'on' : 'off');
  console.log('  capabilities          :',
    Object.entries(acct.capabilities || {}).map(([k, v]) => k + '=' + v).join(' ') || '(none)');
  // These decide whether the platform may request a capability at all.
  console.log('  controller.type       :', c.type || '-');
  console.log('  requirement_collection:', c.requirement_collection || '-',
    c.requirement_collection === 'application' ? '-> the PLATFORM can request capabilities'
      : c.requirement_collection === 'stripe' ? '-> STRIPE collects them; the account holder enables it'
      : '');
  console.log('  stripe_dashboard      :', c.stripe_dashboard?.type || '-');
  console.log('  disabled_reason       :', req.disabled_reason || '-');
  console.log('  currently_due         :', (req.currently_due || []).join(', ') || '-');
}

console.log('');
console.log('BEFORE  ' + ACCOUNT + (ARG_ACCOUNT ? '  (given on the command line)' : '  (from STRIPE_CONNECTED_ACCOUNT_ID)'));

let before;
try {
  before = await stripe.accounts.retrieve(ACCOUNT);
} catch (e) {
  console.error('Could not read ' + ACCOUNT + ' - ' + (e && e.message ? e.message : e));
  console.error(
    'A platform can only read accounts CONNECTED to it. If this is a real Stripe account and'
    + ' it fails here, it has never been connected to this platform - and that, not a missing'
    + ' capability, is what has to be fixed first.'
  );
  process.exit(1);
}
show(before);

if ((before.capabilities || {}).card_payments === 'active') {
  console.log('');
  console.log('card_payments is already active - nothing to do.');
  process.exit(0);
}

if (!APPLY) {
  console.log('');
  console.log('Read-only. Re-run with --apply to request card_payments.');
  process.exit(0);
}

console.log('');
console.log('Requesting card_payments ...');
try {
  const after = await stripe.accounts.update(ACCOUNT, {
    capabilities: { card_payments: { requested: true } },
  });
  console.log('');
  console.log('AFTER');
  show(after);
  const state = (after.capabilities || {}).card_payments;
  console.log('');
  console.log(
    state === 'active'
      ? 'Done - card_payments is ACTIVE. zai is the merchant of record on the next purchase.'
      : 'card_payments is now "' + state + '". Stripe is collecting the requirements listed'
        + ' above; it goes active once they are satisfied.'
  );
} catch (e) {
  console.error('');
  console.error('Request refused:', e && e.message ? e.message : e);
  console.error(
    'If this says capabilities cannot be requested on this account, then Stripe - not the'
    + ' platform - collects its requirements, and the account holder enables card payments'
    + ' from their own dashboard.'
  );
  process.exit(1);
}
