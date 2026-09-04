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
const FROM = '"zai Experience Club" <no-reply@zai.ch>';

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

export { ADMIN_INBOX };
