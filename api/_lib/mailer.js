import nodemailer from 'nodemailer';

/**
 * Outbound mail for the store routes.
 *
 * The products route has its own copy of this (claim received / approved /
 * rejected). That one is left alone deliberately: those emails work, and
 * rewiring them to share this module risks breaking notifications that are
 * already in production for no user-visible gain. If products is ever touched
 * for another reason, migrating it here is the tidy-up.
 */

// The shared mailbox zai created for this. It is never read by a person or
// by us — notifications land there and that is the whole contract.
const ADMIN_INBOX = process.env.ZAI_ORDERS_INBOX || 'experience-club@zai.ch';
// Sender address. Configurable because it is the lever that fixes deliverability
// without a code change: zai.ch's SPF record authorises Microsoft 365 and ends in
// -all, so mail sent through Google claiming to be From: no-reply@zai.ch fails SPF
// at any external receiver — including zai.ch's own Hornetsecurity gateway. Either
// send through M365, or send as a domain whose SPF covers the relay in use.
const FROM = process.env.MAIL_FROM || '"zai Experience Club" <experience-club@zai.ch>';

/**
 * The bare address out of MAIL_FROM. XOAUTH2 needs the mailbox on its own —
 * the display-name form that MAIL_FROM carries is rejected as a username.
 */
function senderAddress() {
  const m = /<([^>]+)>/.exec(FROM);
  return (m ? m[1] : FROM).trim();
}

const RED = '#7A222E';
const BLACK = '#0a0a0a';
const GRAY = '#6a6a6a';
const BORDER = '#e0ddd6';

/**
 * Google Workspace SMTP relay authenticates by source IP, not by password:
 * with "Only accept mail from the specified IP addresses" there is no account
 * to log in as, and offering credentials is wrong rather than merely
 * unnecessary. So an empty SMTP_USER/SMTP_PASS has to mean "send anyway" in
 * that setup — but it must not mean that by accident when someone simply
 * forgot to set the password, which would silently start sending
 * unauthenticated. Hence an explicit opt-in.
 */

/**
 * Microsoft 365 OAuth 2.0, client-credentials flow.
 *
 * experience-club@zai.ch is a SHARED mailbox: no licence, no password, nothing
 * to log in as. Password SMTP AUTH therefore cannot be used against it at all,
 * and Microsoft is retiring Basic auth for SMTP regardless — it is the last
 * protocol still standing after EAS, POP, IMAP, EWS and Autodiscover lost it.
 *
 * So the app authenticates as itself and is granted access to that one mailbox.
 * On the tenant side that means an Entra app registration with the
 * SMTP.SendAsApp application permission, registered as an Exchange service
 * principal and given rights on the mailbox alone. Nothing here can reach any
 * other mailbox.
 *
 * Tokens last about an hour, so one is cached and renewed a minute early
 * rather than fetched per message.
 */
const OAUTH_SCOPE = 'https://outlook.office365.com/.default';
const MS_TENANT = process.env.MS_TENANT_ID;
const MS_CLIENT = process.env.MS_CLIENT_ID;
const MS_SECRET = process.env.MS_CLIENT_SECRET;
const USE_OAUTH = !!(MS_TENANT && MS_CLIENT && MS_SECRET);

let _token = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(MS_TENANT)}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT,
        client_secret: MS_SECRET,
        scope: OAUTH_SCOPE,
        grant_type: 'client_credentials',
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // Surfaced rather than swallowed: a tenant misconfiguration otherwise
    // reads as a generic SMTP failure, which sends people to the wrong place.
    throw new Error(
      `Microsoft token request failed (${res.status}): `
      + `${data.error_description || data.error || 'no access_token returned'}`
    );
  }
  _token = data.access_token;
  _tokenExpiry = Date.now() + Math.max(0, (data.expires_in || 3600) - 60) * 1000;
  return _token;
}

const NO_AUTH = process.env.SMTP_ALLOW_NO_AUTH === 'true';
const HAS_CREDS = !!(process.env.SMTP_USER && process.env.SMTP_PASS);

export function mailConfigured() {
  return USE_OAUTH || HAS_CREDS || (NO_AUTH && !!process.env.SMTP_HOST);
}

let _transporter = null;
let _transporterToken = null;

async function getTransporter() {
  // With OAuth the credential expires, so the cached transport is rebuilt
  // whenever the token behind it has been renewed.
  if (USE_OAUTH) {
    const accessToken = await getAccessToken();
    if (!_transporter || _transporterToken !== accessToken) {
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      _transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.office365.com',
        port,
        secure: port === 465,
        ...(process.env.SMTP_IPV6 === 'true' ? {} : { family: 4 }),
        auth: {
          type: 'OAuth2',
          user: process.env.SMTP_USER || senderAddress(),
          accessToken,
        },
      });
      _transporterToken = accessToken;
    }
    return _transporter;
  }
  if (!_transporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    _transporter = nodemailer.createTransport({
      // zai.ch is on Microsoft 365. The old Gmail default cannot work here
      // twice over: Google refuses this server's IP at EHLO (421 4.7.0), and
      // zai.ch's SPF authorises Outlook and ends in -all, so Gmail-relayed
      // mail claiming to be zai.ch fails SPF at the recipient anyway.
      host: process.env.SMTP_HOST || 'smtp.office365.com',
      port,
      // Node prefers IPv6 where it can, and a relay allowlist written for the
      // v4 address alone then rejects the connection for a reason that looks
      // nothing like the cause. Pin to IPv4 unless told otherwise.
      ...(process.env.SMTP_IPV6 === 'true' ? {} : { family: 4 }),
      // Port 465 is implicit TLS and must be `secure`; 587 and 25 start plain
      // and upgrade via STARTTLS. This was hardcoded false, so configuring
      // 465 — the obvious choice when a provider blocks other ports — could
      // only ever hang or fail the handshake.
      secure: port === 465,
      // On 25 and 587 nodemailer will STARTTLS if offered but fall back to
      // cleartext if not, which is a silent downgrade. Order details and a
      // mailbox password are not worth sending in the clear, so require it:
      // no TLS now means a visible failure rather than an invisible leak.
      ...(port === 465 ? {} : { requireTLS: true }),
      // Omitted entirely, not left blank: nodemailer attempts AUTH if the key
      // is present at all, and the relay rejects an unexpected login.
      ...(HAS_CREDS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    });
  }
  return _transporter;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function wrap(title, rows, footNote) {
  const body = rows.map(([k, v]) => `
    <tr>
      <td style="padding:8px 0;color:${GRAY};font-size:12px;letter-spacing:.06em;
                 text-transform:uppercase;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td style="padding:8px 0 8px 20px;color:${BLACK};font-size:14px;">${esc(v)}</td>
    </tr>`).join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f4f0;
      font-family:Helvetica,Arial,sans-serif;padding:28px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid ${BORDER};">
      <div style="background:${RED};padding:18px 24px;color:#fff;font-size:13px;
                  letter-spacing:.22em;text-transform:uppercase;">zai experience club</div>
      <div style="padding:24px;">
        <h1 style="margin:0 0 18px;font-size:19px;font-weight:400;color:${BLACK};">${esc(title)}</h1>
        <table style="width:100%;border-collapse:collapse;">${body}</table>
        ${footNote ? `<p style="margin:20px 0 0;font-size:12px;color:${GRAY};
            border-top:1px solid ${BORDER};padding-top:14px;">${esc(footNote)}</p>` : ''}
      </div>
    </div></body></html>`;
}

/**
 * Fire-and-forget: a failed notification must never fail the purchase that
 * triggered it. Callers are not expected to await this.
 */
export function notifyOrder({ title, rows, footNote, subject }) {
  if (!mailConfigured()) {
    console.warn('[notify] SMTP not configured — skipping:', subject);
    return Promise.resolve(false);
  }
  return Promise.resolve()
    .then(() => getTransporter())
    .then(t => t.sendMail({ from: FROM, to: ADMIN_INBOX, subject, html: wrap(title, rows, footNote) }))
    .then(() => { console.log('[notify] sent:', subject); return true; })
    .catch((e) => { console.error('[notify] FAILED:', subject, e.message); return false; });
}

/**
 * Turn a nodemailer failure into the one sentence that says what to do.
 *
 * The same "SMTP verification failed" covers a blocked port, a wrong password
 * and a bad hostname, and those need completely different fixes. Outbound
 * port blocking in particular is the classic reason mail works locally and on
 * Vercel but not from a rented server — the provider blocks 25 (and sometimes
 * 465/587) on new accounts until you ask them to unblock it.
 */
function explain(err, host, port) {
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNREFUSED') {
    return `This server cannot open a connection to ${host}:${port} (${code}). `
      + 'That is a network block, not a credentials problem — the same settings will '
      + 'work from a laptop or from Vercel. Hosting providers commonly block outbound '
      + 'SMTP ports on new accounts; ask the provider to unblock it, or send over a '
      + 'port they permit.';
  }
  // Checked before EAUTH: Google answers 421 4.7.0 at EHLO, i.e. it refuses the
  // session before any credentials are offered. 4.7.x is policy/security, so
  // this is the relay declining to talk to THIS host — not a bad password. It
  // is the signature failure of sending Gmail from a datacentre IP, and it is
  // exactly why the same settings work from a laptop and from Vercel.
  if (/421/.test(msg) || /4\.7\.0/.test(msg) || /try again later, closing connection/i.test(msg)) {
    return `${host} accepted the connection and then closed it on policy grounds `
      + '(421 4.7.0, at EHLO — before any password was sent). The relay is refusing '
      + 'the IP address of this server, so no change to SMTP_USER or SMTP_PASS will help. '
      + 'Send through a relay that authorises this host instead: for zai.ch that means '
      + 'Microsoft 365, whose SPF record the domain already authorises — mail relayed '
      + 'through Gmail as no-reply@zai.ch fails SPF at the recipient even when it does go out.';
  }
  if (code === 'EAUTH' || /invalid login|username and password|authentication/i.test(msg)) {
    // Office 365 answers 535 5.7.3 both for a wrong password and for a mailbox
    // where client SMTP submission is switched off — and the second is far more
    // common than the first, because Microsoft disables it by default. Sending
    // someone to re-check a password that was correct all along wastes a day.
    if (/office365|outlook|protection\.outlook/i.test(host) || /5\.7\.3/.test(msg)) {
      return 'Microsoft accepted the connection and refused the login (535 5.7.3). '
        + 'That is usually not a wrong password: SMTP AUTH is disabled by default on '
        + 'Microsoft 365 mailboxes. Ask the tenant admin to run '
        + '`Set-CASMailbox -Identity <mailbox> -SmtpClientAuthenticationDisabled $false`, '
        + 'and to confirm it is not disabled tenant-wide or blocked by a conditional '
        + 'access / security-defaults policy. An unlicensed shared mailbox cannot use '
        + 'password auth at all — that case needs the OAuth app registration instead '
        + '(MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET).';
    }
    return 'The connection works but the credentials were rejected. Check SMTP_USER / '
      + 'SMTP_PASS on THIS deployment — for Gmail this must be an app password, not '
      + 'the account password.';
  }
  if (code === 'EDNS' || /getaddrinfo|ENOTFOUND/i.test(msg)) {
    return `The hostname ${host} does not resolve from this server — check SMTP_HOST for a typo.`;
  }
  if (/certificate|self.signed|TLS|SSL/i.test(msg)) {
    return `TLS negotiation failed against ${host}:${port}. Port 465 needs an implicit-TLS `
      + 'connection while 587 upgrades with STARTTLS — a mismatch between the two looks like this.';
  }
  return null;
}

/**
 * Is outbound mail actually usable right now?
 *
 * notifyOrder() skips with nothing but a console warning when SMTP is not
 * configured, which is invisible from the outside — the first anyone knows is
 * that an inbox stayed empty. This lets an admin screen say so instead.
 *
 * `verify` opens a connection and authenticates; it sends no mail.
 */
export async function mailStatus() {
  const host = process.env.SMTP_HOST || 'smtp.office365.com';
  const user = process.env.SMTP_USER || '';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const configured = mailConfigured();
  const base = {
    configured,
    host,
    port,
    // Which deployment answered. Mail working in one place and not the other is
    // the whole reason this report exists, so it has to say who is speaking.
    platform: process.env.VERCEL || process.env.VERCEL_ENV ? 'vercel' : 'server',
    // Enough to tell which mailbox is in use without printing it in full.
    user: user ? user.replace(/^(.).*(@.*)$/, '$1***$2') : null,
    // Says which of the two shapes is in play, so "no user" reads as a choice
    // rather than as something missing.
    auth: USE_OAUTH ? 'OAuth2 (Microsoft 365 app)' : HAS_CREDS ? 'password' : NO_AUTH ? 'by IP (no login)' : 'none',
    inbox: ADMIN_INBOX,
    // The From domain is what receivers run SPF against, so it belongs in any
    // report about why mail is or is not arriving.
    from: FROM,
  };
  if (!configured) {
    return {
      ...base,
      verified: false,
      error: 'SMTP_USER and SMTP_PASS are not set in this environment',
      hint: 'Set them on this deployment specifically — Vercel and the server keep separate environments. '
        + 'If this is a relay that authenticates by IP instead of by password, set SMTP_ALLOW_NO_AUTH=true.',
    };
  }
  try {
    await (await getTransporter()).verify();
    return { ...base, verified: true, error: null, hint: null };
  } catch (e) {
    return {
      ...base,
      verified: false,
      code: e?.code || null,
      error: e.message || 'SMTP verification failed',
      hint: explain(e, host, port),
    };
  }
}

export { ADMIN_INBOX };
