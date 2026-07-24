import nodemailer from 'nodemailer';

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
      },
    });
  }
  return _transporter;
}

const FROM = '"zai Experience Club" <no-reply@zai.ch>';
const APP = () => process.env.VITE_API_URL || 'https://zai-chi.vercel.app';

const RED = '#7A222E';
const BLACK = '#0a0a0a';
const GRAY = '#6a6a6a';
const BG = '#f5f4f0';
const SURFACE = '#f0ede6';

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:28px;font-weight:300;letter-spacing:0.15em;color:${BLACK};">zai</div>
      <div style="font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${GRAY};margin-top:2px;">Experience Club</div>
    </div>
    <div style="background:#ffffff;border-radius:8px;padding:32px 28px;border:1px solid #e0ddd6;">
      <h1 style="font-size:20px;font-weight:400;color:${BLACK};margin:0 0 20px;">${title}</h1>
      ${body}
    </div>
    <div style="text-align:center;margin-top:28px;font-size:11px;color:${GRAY};">
      <p style="margin:0;">&copy; ${new Date().getFullYear()} zai Experience Club</p>
      <p style="margin:4px 0 0;">This is an automated notification &mdash; please do not reply.</p>
    </div>
  </div>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${GRAY};white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:13px;color:${BLACK};">${value}</td>
  </tr>`;
}

function table(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;background:${SURFACE};border-radius:6px;margin:16px 0;">
    ${rows.map(([l, v]) => row(l, v)).join('')}
  </table>`;
}

function btn(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0 8px;">
    <a href="${url}" style="display:inline-block;padding:14px 28px;background:${RED};color:#fff;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;border-radius:4px;">${text}</a>
  </div>`;
}

function p(text: string): string {
  return `<p style="font-size:14px;color:${BLACK};line-height:1.6;margin:0 0 14px;">${text}</p>`;
}

async function send(to: string, subject: string, html: string) {
  try {
    await getTransporter().sendMail({ from: FROM, to, subject, html });
    console.log(`[email] ✓ "${subject}" → ${to}`);
  } catch (err) {
    console.error(`[email] ✗ "${subject}" → ${to}:`, err);
  }
}

// ─── User notifications ────────────────────────────────────────

interface UserInfo {
  email: string;
  name: string;
}

interface ClaimInfo {
  productName: string;
  adminNote?: string;
}

/** User submitted a claim → confirmation email */
export async function emailClaimReceived(user: UserInfo, claim: ClaimInfo) {
  const body =
    p(`Hi ${user.name},`) +
    p(`We've received your claim for <strong>${claim.productName || 'your product'}</strong>. Our team will review your proof of purchase and get back to you shortly.`) +
    table([
      ['Product', claim.productName || 'Not specified'],
      ['Status', '<span style="color:#e6a817;font-weight:600;">Pending Review</span>'],
    ]) +
    p(`<span style="color:${GRAY};font-size:13px;">You'll receive another email once your claim has been reviewed.</span>`);

  await send(user.email, `Claim received — ${claim.productName || 'your product'}`, wrap('Claim Received', body));
}

/** Admin validated the claim → notify user */
export async function emailClaimValidated(user: UserInfo, claim: ClaimInfo) {
  const isCard = /experience.*card/i.test(claim.productName || '');
  const body =
    p(`Hi ${user.name},`) +
    p(`Great news — your claim for <strong>${claim.productName}</strong> has been approved! Your ${isCard ? 'Experience Card is now active' : 'product has been added to your collection'}.`) +
    table([
      ['Product', claim.productName],
      ['Status', '<span style="color:#4caf7d;font-weight:600;">Validated ✓</span>'],
    ]) +
    btn(isCard ? 'View Your Card' : 'View Your Collection', `${APP()}/${isCard ? 'dashboard' : 'products'}`);

  await send(user.email, `Claim approved — ${claim.productName}`, wrap('Claim Approved!', body));
}

/** Admin rejected the claim → notify user */
export async function emailClaimRejected(user: UserInfo, claim: ClaimInfo) {
  const body =
    p(`Hi ${user.name},`) +
    p(`Unfortunately, your claim for <strong>${claim.productName || 'your product'}</strong> could not be validated.`) +
    table([
      ['Product', claim.productName || 'Not specified'],
      ['Status', `<span style="color:${RED};font-weight:600;">Rejected</span>`],
      ...(claim.adminNote ? [['Reason', claim.adminNote] as [string, string]] : []),
    ]) +
    p(`<span style="color:${GRAY};font-size:13px;">If you believe this was a mistake, please submit again with a clearer proof of purchase image.</span>`);

  await send(user.email, `Claim update — ${claim.productName || 'your product'}`, wrap('Claim Not Approved', body));
}

/** NFT minted → notify user */
export async function emailMintComplete(user: UserInfo, claim: ClaimInfo) {
  const body =
    p(`Hi ${user.name},`) +
    p(`Your digital certificate for <strong>${claim.productName}</strong> has been minted and is now in your wallet.`) +
    table([
      ['Product', claim.productName],
      ['Status', '<span style="color:#4caf7d;font-weight:600;">Minted ✓</span>'],
    ]) +
    btn('View in Collection', `${APP()}/products`);

  await send(user.email, `${claim.productName} — NFT minted`, wrap('Your Digital Certificate is Ready', body));
}
