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

  const { env, mail } = report;
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
  console.groupCollapsed(`${mark(mail.verified)} SMTP — ${mail.verified ? 'connected' : 'NOT working'}`);
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

  console.groupEnd();
}

/**
 * Also expose it manually, so the report can be re-run from the console at any
 * time without logging out and back in.
 */
export function installDeploymentCheck(): void {
  (window as any).zaiCheck = logDeploymentCheck;
}
