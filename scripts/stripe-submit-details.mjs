/**
 * Supply zai's verification details directly, so the capability request has
 * nothing left to ask for.
 *
 *     node scripts/stripe-submit-details.mjs            # write/check the details file
 *     node scripts/stripe-submit-details.mjs --submit   # send them to Stripe
 *
 * ── Why this and not the onboarding link ──
 * The hosted link only ever shows what is CURRENTLY due. Requesting the
 * capability makes the requirements due but also disables the account, so the
 * link is only useful during an outage; withdraw the request to keep selling
 * and the link goes blank. We walked into both halves of that.
 *
 * The account is platform-controlled (requirement_collection: application), so
 * we can submit the details over the API at any time — with the account
 * healthy and the shop open. Stripe keeps them. Request the capability
 * afterwards and it activates without the account ever going down.
 *
 * Nothing here is a credential: a company phone, the CHE number, and a
 * director's name. It still stays out of git.
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';

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
const ACCOUNT = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
const SUBMIT = process.argv.includes('--submit');
const DETAILS_FILE = 'stripe-kyc.json';

const TEMPLATE = {
  _comment: 'Fill in from zai, run with --submit, then delete this file.',
  company_phone: '+41...',
  company_tax_id: 'CHE-...',
  owner_first_name: '',
  owner_last_name: '',
  owner_phone: '+41...',
  owner_title: 'Director',
};
const REQUIRED = ['company_phone', 'company_tax_id', 'owner_first_name', 'owner_last_name', 'owner_phone', 'owner_title'];

if (!KEY || !ACCOUNT) {
  console.error('STRIPE_SECRET_KEY and STRIPE_CONNECTED_ACCOUNT_ID are both required.');
  process.exit(1);
}

const Stripe = (await import('stripe')).default;
const stripe = new Stripe(KEY);

const acct = await stripe.accounts.retrieve(ACCOUNT);
console.log('');
console.log('ACCOUNT ' + ACCOUNT);
console.log('  capabilities   :', Object.entries(acct.capabilities || {}).map(([k, v]) => k + '=' + v).join(' ') || '(none)');
console.log('  charges/payouts:', acct.charges_enabled ? 'ON' : 'OFF', '/', acct.payouts_enabled ? 'ON' : 'OFF');
console.log('  currently_due  :', (acct.requirements?.currently_due || []).join(', ') || '-');

if (!existsSync(DETAILS_FILE)) {
  writeFileSync(DETAILS_FILE, JSON.stringify(TEMPLATE, null, 2) + '\n');
  console.log('');
  console.log('Wrote ' + DETAILS_FILE + '. Ask zai for:');
  console.log('  - company phone');
  console.log('  - CHE / UID number');
  console.log('  - a director: first name, last name, phone, job title');
  console.log('Then re-run with --submit.');
  process.exit(0);
}

const d = JSON.parse(readFileSync(DETAILS_FILE, 'utf8'));
const blank = REQUIRED.filter(k => !d[k] || String(d[k]).includes('...'));
if (blank.length) {
  console.log('');
  console.log('Still blank in ' + DETAILS_FILE + ': ' + blank.join(', '));
  process.exit(1);
}

if (!SUBMIT) {
  console.log('');
  console.log(DETAILS_FILE + ' is complete. Re-run with --submit to send it.');
  process.exit(0);
}

console.log('');
console.log('Submitting company details ...');
await stripe.accounts.update(ACCOUNT, {
  company: { phone: d.company_phone, tax_id: d.company_tax_id },
});

// The director is a separate object. Update the person already on the account
// rather than adding a second, or Stripe asks about both.
const persons = await stripe.accounts.listPersons(ACCOUNT, { limit: 10 });
const person = persons.data[0];
if (!person) {
  console.error('No person on the account — Stripe expects a director/owner record.');
  process.exit(1);
}
console.log('Updating person ' + person.id + ' ...');
await stripe.accounts.updatePerson(ACCOUNT, person.id, {
  first_name: d.owner_first_name,
  last_name: d.owner_last_name,
  phone: d.owner_phone,
  relationship: { title: d.owner_title },
});

const after = await stripe.accounts.retrieve(ACCOUNT);
console.log('');
console.log('Submitted.');
console.log('  currently_due  :', (after.requirements?.currently_due || []).join(', ') || '-');
console.log('  eventually_due :', (after.requirements?.eventually_due || []).join(', ') || '-');
console.log('  charges/payouts:', after.charges_enabled ? 'ON' : 'OFF', '/', after.payouts_enabled ? 'ON' : 'OFF');
console.log('');
console.log('Delete ' + DETAILS_FILE + ' now. Then request the capability:');
console.log('  node scripts/request-card-payments.mjs --apply');
