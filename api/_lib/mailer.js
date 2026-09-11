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

const ADMIN_INBOX = process.env.ZAI_ORDERS_INBOX || 'info@zai.ch';
// Sender address. Configurable because it is the lever that fixes deliverability
// without a code change: zai.ch's SPF record authorises Microsoft 365 and ends in
// -all, so mail sent through Google claiming to be From: no-reply@zai.ch fails SPF
// at any external receiver — including zai.ch's own Hornetsecurity gateway. Either
// send through M365, or send as a domain whose SPF covers the relay in use.
const FROM = process.env.MAIL_FROM || '"zai Experience Club" <no-reply@zai.ch>';

const RED = '#7A222E';
const BLACK = '#0a0a0a';
const GRAY = '#6a6a6a';
const BORDER = '#e0ddd6';

let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
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
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[notify] SMTP not configured — skipping:', subject);
    return Promise.resolve(false);
  }
  return getTransporter()
    .sendMail({ from: FROM, to: ADMIN_INBOX, subject, html: wrap(title, rows, footNote) })
    .then(() => { console.log('[notify] sent:', subject); return true; })
    .catch((e) => { console.error('[notify] FAILED:', subject, e.message); return false; });
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
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const user = process.env.SMTP_USER || '';
  const configured = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const base = {
    configured,
    host,
    // Enough to tell which mailbox is in use without printing it in full.
    user: user ? user.replace(/^(.).*(@.*)$/, '$1***$2') : null,
    inbox: ADMIN_INBOX,
    // The From domain is what receivers run SPF against, so it belongs in any
    // report about why mail is or is not arriving.
    from: FROM,
  };
  if (!configured) {
    return { ...base, verified: false, error: 'SMTP_USER and SMTP_PASS are not set in this environment' };
  }
  try {
    await getTransporter().verify();
    return { ...base, verified: true, error: null };
  } catch (e) {
    return { ...base, verified: false, error: e.message || 'SMTP verification failed' };
  }
}

export { ADMIN_INBOX };
