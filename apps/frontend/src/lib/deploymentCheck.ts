import { apiService } from '../services/api';

/**
 * Print a configuration report for whichever backend answered, to the browser
 * console, on admin login.
 *
 * The app runs in two places — Vercel serverless and the Express server behind
 * Traefik — each with its own environment. A variable set in one is invisible
 * to the other, so "it works locally and on Vercel but not on the server" is
 * usually one environment missing something rather than a code difference.
 * Reading that off a console beats guessing at which box is serving you.
 *
 * Variable NAMES and set/missing only. No values are sent by the API or
 * printed here, and the endpoint is admin-gated server side.
 */

type VarRow = { name: string; ok: boolean; status: string; required: boolean; note?: string };
type Group = { group: string; vars: VarRow[] };

interface StripeReport {
  configured: boolean;
  reason?: string;
  accountId?: string;
  merchantOfRecordRequested?: boolean;
  model?: string;
  buyerSeesThisAccount?: boolean;
  type?: string;
  controller?: {
    type?: string | null;
    requirementCollection?: string | null;
    stripeDashboard?: string | null;
    feesPayer?: string | null;
    lossesPayments?: string | null;
  };
  requirements?: {
    disabledReason?: string | null;
    currentlyDue?: string[];
    pastDue?: string[];
    pendingVerification?: string[];
  };
  capabilities?: Record<string, string>;
  businessName?: string | null;
  statementDescriptor?: string | null;
  country?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  notes?: string[];
}

interface Report {
  env: {
    platform: string;
    vercelEnv: string | null;
    node: string;
    os: string;
    nodeEnv: string | null;
    now: string;
    summary: { total: number; set: number; missingRequired: number; empty: number };
    groups: Group[];
  };
  mail: {
    configured: boolean;
    verified: boolean;
    host: string;
    port: number;
    platform: string;
    user: string | null;
    inbox: string;
    from: string;
    code?: string | null;
    error: string | null;
    hint?: string | null;
  };
  stripe?: StripeReport;
}

const mark = (ok: boolean) => (ok ? '✅' : '❌');

export async function logDeploymentCheck(): Promise<void> {
  let report: Report;
  try {
    const res = await apiService.get('/store/admin/diagnostics');
    if (!res.data?.success) return;
    report = res.data.data as Report;
  } catch {
    // Non-admins get a 403 here, which is the expected case for most people —
    // never turn that into noise in their console.
    return;
  }

  const { env, mail, stripe } = report;
  const s = env.summary;

  console.groupCollapsed(
    `%c zai config check %c ${env.platform.toUpperCase()} %c ${s.set}/${s.total} set` +
      (s.missingRequired ? ` — ${s.missingRequired} required missing` : ''),
    'background:#7A222E;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px',
    'background:#0a0a0a;color:#fff;padding:2px 6px',
    `background:${s.missingRequired ? '#7A222E' : '#2f6b4f'};color:#fff;padding:2px 6px;border-radius:0 3px 3px 0`
  );

  console.log(
    `Answered by: ${env.platform}${env.vercelEnv ? ` (${env.vercelEnv})` : ''} · ` +
      `node ${env.node} on ${env.os}${env.nodeEnv ? ` · NODE_ENV=${env.nodeEnv}` : ''}`
  );
  console.log('Values are never sent — names and set/missing only.');

  for (const g of env.groups) {
    const bad = g.vars.filter(v => !v.ok).length;
    console.groupCollapsed(`${mark(bad === 0)} ${g.group} (${g.vars.length - bad}/${g.vars.length})`);
    void 0;
    console.table(
      g.vars.map(v => ({
        variable: v.name,
        '': mark(v.ok),
        status: v.status,
        required: v.required ? 'yes' : '',
        note: v.note || '',
      }))
    );
    console.groupEnd();
  }

  // Mail gets its own section because it is the one thing here that is checked
  // live rather than just read: verify() opens the connection and authenticates.
  const openMail = mail.verified ? console.groupCollapsed : console.group;
  openMail(`${mark(mail.verified)} SMTP — ${mail.verified ? 'connected' : 'NOT working'}`);
  console.table({
    'answered by': mail.platform,
    host: mail.host,
    port: mail.port,
    secure: mail.port === 465 ? 'implicit TLS' : 'STARTTLS',
    user: mail.user || '(not set)',
    from: mail.from,
    'sends to': mail.inbox,
    configured: mail.configured ? 'yes' : 'no',
    verified: mail.verified ? 'yes' : 'no',
    ...(mail.code ? { code: mail.code } : {}),
    ...(mail.error ? { error: mail.error } : {}),
  });
  if (mail.hint) console.warn('→ ' + mail.hint);
  console.groupEnd();

  // Whose name the buyer actually sees on a receipt or bank statement. Read
  // live from Stripe, because the two reasons it can be wrong — the account
  // cannot charge, or it has no name set — are indistinguishable from outside.
  if (stripe) {
    const ok = !!stripe.buyerSeesThisAccount;
    const openStripe = ok ? console.groupCollapsed : console.group;
    openStripe(
      `${mark(ok)} Stripe — buyer sees ${ok ? (stripe.businessName || 'the connected account') : 'the PLATFORM name'}`
    );
    if (!stripe.configured) {
      console.warn('→ ' + (stripe.reason || 'Connected account could not be read.'));
    } else {
      console.table({
        'account': stripe.accountId || '—',
        'account type': stripe.type || '—',
        'controlled by': stripe.controller?.requirementCollection === 'application' ? 'the platform (we request capabilities)'
          : stripe.controller?.requirementCollection === 'stripe' ? 'Stripe (zai enables it themselves)'
          : stripe.controller?.requirementCollection || '—',
        'model': stripe.model || '—',
        'merchant of record requested': stripe.merchantOfRecordRequested ? 'zai' : 'platform (switched off)',
        'card_payments': stripe.capabilities?.card_payments || '—',
        'transfers': stripe.capabilities?.transfers || '—',
        'disabled reason': stripe.requirements?.disabledReason || '—',
        'Stripe waiting on': (stripe.requirements?.currentlyDue || []).join(', ') || '—',
        'charges enabled': stripe.chargesEnabled ? 'yes' : 'no',
        'payouts enabled': stripe.payoutsEnabled ? 'yes' : 'no',
        'business name': stripe.businessName || '(not set)',
        'statement descriptor': stripe.statementDescriptor || '(not set)',
        'country': stripe.country || '—',
      });
      // Every capability on the account — a payment method that never shows
      // up at checkout is usually one that is simply not listed here.
      const caps = stripe.capabilities || {};
      if (Object.keys(caps).length) {
        console.groupCollapsed(`all capabilities (${Object.keys(caps).length})`);
        console.table(caps);
        console.groupEnd();
      }
      (stripe.notes || []).forEach(n => console.warn('→ ' + n));
    }
    console.groupEnd();
  }

  console.groupEnd();

  // ── One copyable block ──
  // Console groups have to be expanded one at a time before their contents can
  // be selected, so the facts that matter are also printed flat.
  const missing = env.groups
    .flatMap(g => g.vars)
    .filter(v => !v.ok && v.required)
    .map(v => v.name);
  const cap = stripe?.capabilities || {};
  const lines = [
    '───────── zai config — copy from here ─────────',
    `deployment   : ${env.platform} · node ${env.node} · ${env.nodeEnv || 'no NODE_ENV'}`,
    `env set      : ${s.set}/${s.total}` + (missing.length ? `  · MISSING REQUIRED: ${missing.join(', ')}` : ''),
    '',
    `SMTP         : ${mail.verified ? 'CONNECTED' : 'NOT WORKING'}`,
    `  host       : ${mail.host}:${mail.port}`,
    `  auth       : ${(mail as any).auth ?? (mail.configured ? 'configured' : 'none')}`,
    `  user       : ${mail.user || '(none)'}`,
    `  from       : ${mail.from}`,
    `  sends to   : ${mail.inbox}`,
    ...(mail.code ? [`  code       : ${mail.code}`] : []),
    ...(mail.error ? [`  error      : ${mail.error}`] : []),
    ...(mail.hint ? [`  hint       : ${mail.hint}`] : []),
    '',
    `Stripe       : buyer sees ${stripe?.buyerSeesThisAccount ? (stripe.businessName || 'the connected account') : 'the PLATFORM name'}`,
    ...(stripe?.configured
      ? [
          `  account    : ${stripe.accountId}  (type: ${stripe.type || 'unknown'})`,
          `  model      : ${stripe.model || '—'}`,
          `  caps       : ${Object.entries(cap).map(([k, v]) => `${k}=${v}`).join(' ') || '(none)'}`,
          `  disabled   : ${stripe.requirements?.disabledReason || '—'}`,
          `  due now    : ${(stripe.requirements?.currentlyDue || []).join(', ') || '—'}`,
          `  name/descr : ${stripe.businessName || '(not set)'} / ${stripe.statementDescriptor || '(not set)'}`,
          ...(stripe.notes || []).map(n => `  ! ${n}`),
        ]
      : [`  ${stripe?.reason || 'not configured'}`]),
    '───────── to here ─────────',
  ];
  console.log(lines.join(String.fromCharCode(10)));
}

/**
 * Also expose it manually, so the report can be re-run from the console at any
 * time without logging out and back in.
 */
export function installDeploymentCheck(): void {
  (window as any).zaiCheck = logDeploymentCheck;
}
