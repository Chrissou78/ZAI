/**
 * Which environment variables this deployment actually has.
 *
 * Reports names and presence only — never a value. The point is to answer
 * "is it configured on the box that is serving this request?", which matters
 * because the app runs in two places (Vercel serverless and the Express
 * server behind Traefik) with separate environments. A variable set on one is
 * invisible to the other, and "the variables have been declared" is easy to
 * believe about the wrong one.
 *
 * `empty` is called out separately from missing: a variable declared as "" is
 * present in process.env and passes a truthiness check in some places but not
 * others, which is a genuinely confusing failure and worth naming.
 */

// Grouped so a report reads as something rather than an alphabetical wall.
// Every name here is read somewhere in api/ or server.js — keep it that way.
const GROUPS = [
  {
    group: 'Core',
    vars: [
      { name: 'DATABASE_URL', required: true },
      { name: 'JWT_SECRET', required: true },
      { name: 'DATABASE_SSL' },
      { name: 'PORT', note: 'set by the host' },
      { name: 'PUBLIC_APP_URL' },
      { name: 'ALLOWED_ORIGINS', note: 'overrides the CORS allowlist when set' },
    ],
  },
  {
    group: 'Mail',
    vars: [
      { name: 'SMTP_HOST', required: true },
      { name: 'SMTP_PORT', required: true },
      // Not marked required: a relay that authenticates by source IP takes no
      // login at all, so absent credentials can be correct. Whether mail
      // actually works is answered by the live check, not by this list.
      { name: 'SMTP_USER', note: 'unused when relaying by IP' },
      { name: 'SMTP_PASS', note: 'unused when relaying by IP' },
      { name: 'SMTP_ALLOW_NO_AUTH', note: "'true' to send with no login (IP-authenticated relay)" },
      { name: 'SMTP_IPV6', note: "'true' to allow IPv6; otherwise connections are pinned to IPv4" },
      { name: 'MAIL_FROM' },
      { name: 'ZAI_ORDERS_INBOX' },
    ],
  },
  {
    group: 'Auth / WalletTwo',
    vars: [
      { name: 'WALLETTWO_API_KEY', required: true },
      { name: 'VITE_WALLETTWO_URL' },
      { name: 'ZAI_ADMIN_EMAILS' },
      { name: 'ZAI_OWNER_USER_ID' },
    ],
  },
  {
    group: 'Stripe',
    vars: [
      { name: 'STRIPE_SECRET_KEY', required: true },
      { name: 'STRIPE_WEBHOOK_SECRET', required: true },
      { name: 'STRIPE_CONNECTED_ACCOUNT_ID', note: 'payout destination for zai' },
      { name: 'STRIPE_ON_BEHALF_OF', note: "zai is merchant of record by default; set to 'false' only to fall back to the platform" },
      { name: 'PLATFORM_FEE_PERCENT' },
      { name: 'EVENT_CANCELLATION_FEE_PERCENT' },
    ],
  },
  {
    group: 'Insurance (SAS)',
    vars: [
      { name: 'SAS_API_URL' },
      { name: 'SAS_PARTNER_ID' },
      { name: 'SAS_USERNAME' },
      { name: 'SAS_PASSWORD' },
    ],
  },
  {
    group: 'Media / chain',
    vars: [
      { name: 'PINATA_JWT' },
      { name: 'PINATA_GATEWAY' },
      { name: 'MINT_WEBHOOK_SECRET' },
      { name: 'CHAIN_ID' },
      { name: 'VITE_APP_URL' },
    ],
  },
];

/**
 * Which of the two deployments answered. This is the first thing to establish
 * when something works in one place and not the other — a report that does not
 * say who produced it invites the same confusion it is meant to end.
 */
export function runtimeInfo() {
  const onVercel = !!process.env.VERCEL || !!process.env.VERCEL_ENV;
  return {
    platform: onVercel ? 'vercel' : 'server',
    // os.hostname() would need an import for little gain; Vercel sets neither,
    // so the region/env pair is the useful identifier there.
    vercelEnv: process.env.VERCEL_ENV || null,
    node: process.version,
    os: process.platform,
    nodeEnv: process.env.NODE_ENV || null,
    now: new Date().toISOString(),
  };
}

export function envReport() {
  let missingRequired = 0;
  let empty = 0;

  const groups = GROUPS.map(({ group, vars }) => ({
    group,
    vars: vars.map(({ name, required = false, note }) => {
      const raw = process.env[name];
      const present = raw !== undefined;
      const isEmpty = present && String(raw).trim() === '';
      const ok = present && !isEmpty;
      if (!ok && required) missingRequired += 1;
      if (isEmpty) empty += 1;
      return {
        name,
        ok,
        // Distinguishes "never declared" from "declared as an empty string".
        status: ok ? 'set' : isEmpty ? 'empty' : 'missing',
        required,
        ...(note ? { note } : {}),
      };
    }),
  }));

  return {
    ...runtimeInfo(),
    summary: {
      total: groups.reduce((n, g) => n + g.vars.length, 0),
      set: groups.reduce((n, g) => n + g.vars.filter(v => v.ok).length, 0),
      missingRequired,
      empty,
    },
    groups,
  };
}
