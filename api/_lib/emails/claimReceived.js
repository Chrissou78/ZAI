/**
 * "Claim received" — the email a member gets right after submitting a claim.
 *
 * Markup is zai's own template (zai-claim-received-email_3.html), kept as
 * designed. Two changes from the file as supplied:
 *
 *  - The logos and the Inter font were embedded as base64. Gmail and Outlook
 *    do not display data: images, and the inlined font took the message past
 *    Gmail's ~102 KB clipping limit. They are served from the site instead
 *    (apps/frontend/public/email/). Clients that ignore web fonts — most of
 *    them — fall back to Helvetica/Arial, as the template's stack intends.
 *  - The two merge fields (first name, product) are filled here, escaped.
 */

import { cleanDisplayName } from '../displayName.js';

const FONT = "'Inter','Helvetica Neue',Helvetica,Arial,sans-serif";

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** "Melih Ergündogdu" or "melih.e@gmail.com" -> "Melih"; nothing usable -> ''. */
function firstNameOf(name) {
  const clean = cleanDisplayName(name);
  if (clean === 'Member') return '';
  return clean.split(/\s+/)[0] || '';
}

/**
 * @param {object} p
 * @param {string} p.name        Member's name as stored (may be an email address).
 * @param {string} p.productName Product as claimed.
 * @param {string} p.baseUrl     Public site origin, for the hosted logos and font.
 * @returns {{ subject: string, html: string }}
 */
export function claimReceivedEmail({ name, productName, baseUrl }) {
  const first = firstNameOf(name);
  const product = String(productName || '').trim();
  const base = String(baseUrl || '').replace(/\/+$/, '');

  const thanks = first ? `Thank you, ${esc(first)}.` : 'Thank you.';
  const productInline = product ? esc(product) : 'your product';
  const productCell = product ? esc(product) : '&mdash;';
  const preheader = `We've received your claim for ${productInline}. Our team will review your proof of purchase shortly.`;
  const year = new Date().getFullYear();

  const subject = product ? `Claim received — ${product}` : 'Claim received';

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Claim received – zai Experience Club</title>
<style>
  @font-face { font-family:'Inter'; font-style:normal; font-weight:300 600; src:url(${base}/email/inter.woff2) format('woff2'); }
  body { margin:0; padding:0; background:#f4f2ee; }
  table { border-collapse:collapse; }
  @media only screen and (max-width:620px) {
    .container { width:100% !important; }
    .pad { padding-left:24px !important; padding-right:24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f2ee;">

<!-- Preheader -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f2ee;font-size:1px;line-height:1px;">
  ${preheader}
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f2ee;">
  <tr>
    <td align="center" style="padding:40px 16px 48px;">

      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">

        <!-- Header -->
        <tr>
          <td align="center" class="pad" style="background:#111111;padding:28px 40px 24px;border-radius:12px 12px 0 0;">
            <img src="${base}/email/zai-logo.png" width="132" alt="zai" style="display:block;margin:0 auto;width:132px;max-width:100%;height:auto;border:0;outline:none;">
            <div style="font-family:${FONT};font-size:10px;font-weight:400;letter-spacing:0.42em;text-indent:0.42em;line-height:1;color:#9b958d;padding-top:14px;">EXPERIENCE CLUB</div>
          </td>
        </tr>

        <!-- Burgundy rule -->
        <tr>
          <td style="background:#7a222e;height:4px;line-height:4px;font-size:0;">&nbsp;</td>
        </tr>

        <!-- Body -->
        <tr>
          <td class="pad" style="background:#ffffff;padding:48px 48px 44px;border-radius:0 0 12px 12px;">

            <div style="font-family:${FONT};font-size:10px;letter-spacing:0.32em;color:#7a222e;padding-bottom:14px;">CLAIM RECEIVED</div>

            <div style="font-family:${FONT};font-size:34px;font-weight:300;letter-spacing:-0.01em;line-height:1.2;color:#111111;padding-bottom:28px;">
              ${thanks}
            </div>

            <div style="font-family:${FONT};font-size:15px;line-height:1.7;color:#3a3835;padding-bottom:32px;">
              We've received your claim for <strong style="color:#111111;font-weight:600;">${productInline}</strong>. Our team will review your proof of purchase and be in touch shortly.
            </div>

            <!-- Details: product + status -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0ede6;border:1px solid #e4e0d8;border-radius:8px;border-collapse:separate;border-spacing:0;">
              <tr>
                <td width="30%" valign="middle" style="padding:13px 0 13px 24px;border-bottom:1px solid #e4e0d8;font-family:${FONT};font-size:11px;letter-spacing:0.26em;color:#8a857d;">PRODUCT</td>
                <td valign="middle" style="padding:13px 24px 13px 0;border-bottom:1px solid #e4e0d8;font-family:${FONT};font-size:15px;font-weight:400;color:#3a3835;">${productCell}</td>
              </tr>
              <tr>
                <td width="30%" valign="middle" style="padding:13px 0 13px 24px;font-family:${FONT};font-size:11px;letter-spacing:0.26em;color:#8a857d;">STATUS</td>
                <td valign="middle" style="padding:13px 24px 13px 0;">
                  <span style="font-family:${FONT};font-size:15px;font-weight:600;color:#a65f00;">Pending Review</span>
                </td>
              </tr>
            </table>

            <div style="font-family:${FONT};font-size:12px;line-height:1.7;color:#8a857d;padding-top:28px;text-align:center;">
              You'll receive another email once your claim has been reviewed.
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" class="pad" style="padding:32px 40px 0;">
            <div style="font-family:${FONT};font-size:11px;letter-spacing:0.18em;color:#6f6a63;padding-bottom:10px;">&copy; ${year} ZAI EXPERIENCE CLUB</div>
            <div style="font-family:${FONT};font-size:11px;line-height:1.6;color:#8a857d;">This is an automated notification &mdash; please do not reply.</div>
            <div style="font-family:${FONT};font-size:9px;letter-spacing:0.32em;color:#9a958d;padding:24px 0 9px;">POWERED BY</div>
            <img src="${base}/email/onchainlabs-logo.png" width="88" alt="onchainlabs" style="display:block;margin:0 auto;width:88px;opacity:0.8;height:auto;border:0;">
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

  return { subject, html };
}

export default claimReceivedEmail;
