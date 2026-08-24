import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getPool, initDB } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const API_KEY = process.env.WALLETTWO_API_KEY;
const EVENTS_BASE = 'https://api.wallettwo.com/event/v1/api';
const EVENT_CANCELLATION_FEE_PERCENT = parseFloat(process.env.EVENT_CANCELLATION_FEE_PERCENT || '20');

/* ── helpers ─────────────────────────────────────────────── */

function authenticate(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), JWT_SECRET);
  } catch {
    return null;
  }
}

function parsePath(url) {
  const clean = url.split('?')[0].replace(/\/api\/events\/?/, '');
  return clean.split('/').filter(Boolean);
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  return Object.fromEntries(new URLSearchParams(url.slice(idx)));
}

async function w2Fetch(path, opts = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${EVENTS_BASE}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        ...(opts.headers || {}),
      },
    });
    clearTimeout(timeout);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  } catch (err) {
    clearTimeout(timeout);
    console.error(`w2Fetch ${path} failed:`, err.message);
    return { status: 503, data: null };
  }
}

/* ── parse BlockNote JSON → plain text lines (for program) ── */

function parseProgramBlocks(raw) {
  if (!raw) return [];
  try {
    const blocks = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(blocks)) {
      return typeof raw === 'string' ? raw.split('\n').filter(Boolean) : [];
    }
    return blocks
      .map(block => {
        if (block.content && Array.isArray(block.content)) {
          return block.content.map(c => c.text || '').join('');
        }
        return '';
      })
      .filter(line => line.trim() !== '');
  } catch {
    return String(raw).split('\n').filter(Boolean);
  }
}

/* ── parse BlockNote JSON → simple HTML (for description) ── */

function blockNoteToHtml(raw) {
  if (!raw) return '';
  if (typeof raw === 'string' && !raw.trim().startsWith('[')) return raw;

  try {
    const blocks = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(blocks)) return typeof raw === 'string' ? raw : '';

    const lines = [];

    blocks.forEach(block => {
      const text = (block.content && Array.isArray(block.content))
        ? block.content.map(c => {
            let t = c.text || '';
            if (!t) return '';
            // Convert inline newlines to <br/>
            t = t.replace(/\n+/g, '<br/>');
            if (c.styles?.bold) t = `<strong>${t}</strong>`;
            if (c.styles?.italic) t = `<em>${t}</em>`;
            if (c.styles?.underline) t = `<u>${t}</u>`;
            if (c.styles?.strikethrough) t = `<s>${t}</s>`;
            if (c.styles?.code) t = `<code>${t}</code>`;
            if (c.type === 'link' && c.href) t = `<a href="${c.href}" target="_blank" rel="noopener">${t}</a>`;
            return t;
          }).join('')
        : '';

      // Empty block = skip entirely
      if (!text.trim()) return;

      switch (block.type) {
        case 'heading': {
          const level = block.props?.level || 3;
          lines.push(`<h${level}>${text}</h${level}>`);
          break;
        }
        case 'bulletListItem':
          lines.push(`• ${text}`);
          break;
        case 'numberedListItem':
          lines.push(`${text}`);
          break;
        case 'checkListItem': {
          const checked = block.props?.checked ? '☑' : '☐';
          lines.push(`${checked} ${text}`);
          break;
        }
        default:
          lines.push(text);
          break;
      }
    });

    // Collapse any consecutive <br/> into one
    return lines.join('<br/>').replace(/(<br\s*\/?>){2,}/gi, '<br/>');
  } catch {
    return typeof raw === 'string' ? raw : '';
  }
}

/* ── map WalletTwo event → frontend shape ────────────────── */

function mapEvent(evt, userId, attendees) {
  const now = new Date();
  const start = new Date(evt.startDate);
  const status = start > now ? 'upcoming' : 'past';

  let registered = false;
  if (attendees && userId) {
    registered = attendees.some((a) => a.attendeeId === userId);
  }

  const programLines = parseProgramBlocks(evt.program);
  const descriptionHtml = blockNoteToHtml(evt.description);

  return {
    id: evt.id,
    title: evt.name || '',
    name: evt.name || '',
    description: descriptionHtml,
    program: programLines,
    location: evt.location || '',
    date: evt.startDate,
    startDate: evt.startDate,
    endDate: evt.endDate,
    status,
    tag: 'community',
    coverImage: evt.coverImage || null,
    galleryImages: evt.galleryImages || [],
    maxAttendees: evt.maxAttendees || null,
    totalAttendees: evt.totalAttendees || 0,
    price: evt.price || 0,
    currency: evt.currency || 'CHF',
    discountPrice: evt.discountPrice || null,
    discountPercentage: evt.discountPercentage || null,
    contractRequiredToAttend: evt.contractRequiredToAttend || [],
    contractRequiredToDiscount: evt.contractRequiredToDiscount || [],
    chainId: evt.chainId || null,
    registered,
  };
}

/* ── register/unregister an attendee with WalletTwo ─────── */

async function registerAttendee(eventId, userId) {
  return w2Fetch(`/event/${eventId}/attendees`, {
    method: 'POST',
    body: JSON.stringify({ attendeeId: userId }),
  });
}

async function unregisterAttendee(eventId, userId) {
  return w2Fetch(`/event/${eventId}/attendees`, {
    method: 'DELETE',
    body: JSON.stringify({ attendeeId: userId }),
  });
}

/* ── main handler ────────────────────────────────────────── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try { await initDB(); } catch (e) {
    console.error('[events] DB init failed:', e.message);
    return res.status(500).json({ success: false, error: 'DB init failed' });
  }

  const segments = parsePath(req.url);
  const query = parseQuery(req.url);

  try {
    /* ─── GET /api/events ─── list all events ─── */
    if (req.method === 'GET' && segments.length === 0) {
      const decoded = authenticate(req);
      const userId = decoded?.userId || decoded?.id || null;

      const { data } = await w2Fetch('/event');

      if (!data || !data.events) {
        return res.status(200).json({
          success: true,
          data: [],
          stats: { total: 0, upcoming: 0, past: 0 },
          _providerOffline: true,
        });
      }

      let events = data.events.map((evt) => mapEvent(evt, userId, null));

      if (userId) {
        const withRegistration = await Promise.all(
          events.map(async (evt) => {
            try {
              const { data: attData } = await w2Fetch(`/event/${evt.id}/attendees`);
              const attendees = attData?.attendees || [];
              const registered = attendees.some((a) => a.attendeeId === userId);
              return { ...evt, registered, totalAttendees: attendees.length };
            } catch {
              return evt;
            }
          })
        );
        events = withRegistration;
      }

      if (query.status && query.status !== 'all') {
        events = events.filter((e) => e.status === query.status);
      }

      if (query.type && query.type !== 'all') {
        events = events.filter((e) => e.tag === query.type);
      }

      events.sort((a, b) => {
        if (a.status === 'upcoming' && b.status === 'upcoming') return new Date(a.date) - new Date(b.date);
        if (a.status === 'past' && b.status === 'past') return new Date(b.date) - new Date(a.date);
        return a.status === 'upcoming' ? -1 : 1;
      });

      return res.status(200).json({
        success: true,
        data: events,
        stats: {
          total: events.length,
          upcoming: events.filter((e) => e.status === 'upcoming').length,
          past: events.filter((e) => e.status === 'past').length,
        },
      });
    }

    /* ─── GET /api/events/:eventId ─── single event ─── */
    if (req.method === 'GET' && segments.length === 1) {
      const eventId = segments[0];
      const decoded = authenticate(req);
      const userId = decoded?.userId || decoded?.id || null;

      const { status, data } = await w2Fetch(`/event/${eventId}`);
      if (status === 404 || !data) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }

      const evtRaw = data.event || data;

      let attendees = [];
      try {
        const { data: attData } = await w2Fetch(`/event/${eventId}/attendees`);
        attendees = attData?.attendees || [];
      } catch {}

      const event = mapEvent(evtRaw, userId, attendees);
      event.totalAttendees = attendees.length;
      if (userId) {
        event.registered = attendees.some((a) => a.attendeeId === userId);
      }

      return res.status(200).json({ success: true, data: event });
    }

    /* ─── POST /api/events/:eventId/register ─── (free events only) */
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'register') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const eventId = segments[0];
      const userId = decoded.userId || decoded.id;

      // Payable events must go through /payment-intent + /payments/:id/confirm —
      // re-check price server-side so a paid event can't be registered for free
      // by calling this endpoint directly.
      const { data: evtData } = await w2Fetch(`/event/${eventId}`);
      const evtRaw = evtData?.event || evtData;
      const amount = parseFloat(evtRaw?.discountPrice ?? evtRaw?.price ?? 0) || 0;
      if (amount > 0) {
        return res.status(400).json({ success: false, error: 'This event requires payment. Use the checkout flow.' });
      }

      const { status, data } = await registerAttendee(eventId, userId);

      if (status >= 400) {
        const msg = data?.message || data?.error || 'Registration failed';
        return res.status(status).json({ success: false, error: msg });
      }

      return res.status(200).json({ success: true, message: 'Registered successfully', data });
    }

    /* ─── POST /api/events/:eventId/payment-intent ─── (payable events) */
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'payment-intent') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const eventId = segments[0];
      const userId = decoded.userId || decoded.id;

      const { status: evtStatus, data: evtData } = await w2Fetch(`/event/${eventId}`);
      if (evtStatus === 404 || !evtData) {
        return res.status(404).json({ success: false, error: 'Event not found' });
      }
      const evtRaw = evtData.event || evtData;

      const listAmount = parseFloat(evtRaw.discountPrice ?? evtRaw.price ?? 0) || 0;
      if (listAmount <= 0) {
        return res.status(400).json({ success: false, error: 'This event is free — register directly.' });
      }
      const currency = (evtRaw.currency || 'CHF').toLowerCase();

      // ── Optional tier event voucher ──
      // Validated here (not trusted from the client) but NOT marked used —
      // that happens on confirm, so abandoning checkout doesn't burn it.
      // Scoped to this user so a valid code belonging to someone else is
      // indistinguishable from one that doesn't exist.
      let voucherCode = null;
      let voucherDiscount = 0;
      const rawVoucher = req.body && req.body.voucherCode;
      if (rawVoucher) {
        const code = String(rawVoucher).trim().toUpperCase();
        const v = (await getPool().query(
          `SELECT amount_chf, expires_at, redeemed_at FROM tier_vouchers
            WHERE user_id = $1 AND code = $2`,
          [userId, code]
        )).rows[0];
        if (!v) return res.status(404).json({ success: false, error: 'Voucher code not found' });
        if (v.redeemed_at) return res.status(409).json({ success: false, error: 'Voucher has already been used' });
        if (v.expires_at && new Date(v.expires_at) < new Date()) {
          return res.status(410).json({ success: false, error: 'Voucher has expired' });
        }
        voucherCode = code;
        // Never discount below zero; a CHF 300 voucher on a CHF 200 event
        // covers the event and the remainder is simply not carried over.
        voucherDiscount = Math.min(Number(v.amount_chf) || 0, listAmount);
      }

      const amount = Math.max(0, listAmount - voucherDiscount);

      // A voucher worth at least the full price leaves nothing to charge, and
      // Stripe rejects a zero-amount PaymentIntent. Redeem the voucher now and
      // tell the client to register via the free path instead.
      if (amount <= 0) {
        const burn = await getPool().query(
          `UPDATE tier_vouchers SET redeemed_at = NOW(), redeemed_event_id = $3
            WHERE user_id = $1 AND code = $2 AND redeemed_at IS NULL`,
          [userId, voucherCode, eventId]
        );
        if (burn.rowCount === 0) {
          return res.status(409).json({ success: false, error: 'Voucher has already been used' });
        }
        return res.status(200).json({
          success: true,
          data: {
            clientSecret: null, paymentId: null, amount: 0, currency,
            listAmount, voucherCode, voucherDiscount, fullyCoveredByVoucher: true,
          },
        });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5');

      const paymentId = randomUUID();

      const piConfig = {
        amount: Math.round(amount * 100),
        currency,
        automatic_payment_methods: { enabled: true },
        metadata: { paymentId, eventId, userId },
      };

      if (process.env.STRIPE_CONNECTED_ACCOUNT_ID) {
        piConfig.application_fee_amount = Math.round(amount * 100 * PLATFORM_FEE_PERCENT / 100);
        piConfig.transfer_data = { destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID };
      }

      const paymentIntent = await stripe.paymentIntents.create(piConfig);

      await getPool().query(
        `INSERT INTO event_payments (id, event_id, user_id, event_title, amount_chf, currency, stripe_payment_intent, status, voucher_code, voucher_discount_chf)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9)`,
        [paymentId, eventId, userId, evtRaw.name || '', amount, currency, paymentIntent.id, voucherCode, voucherDiscount]
      );

      return res.status(200).json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret, paymentId, amount, currency,
          listAmount, voucherCode, voucherDiscount,
        },
      });
    }

    /* ─── POST /api/events/payments/:paymentId/confirm ─── */
    if (req.method === 'POST' && segments.length === 3 && segments[0] === 'payments' && segments[2] === 'confirm') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const paymentId = segments[1];
      const userId = decoded.userId || decoded.id;

      const pr = await getPool().query('SELECT * FROM event_payments WHERE id = $1', [paymentId]);
      if (!pr.rows.length) return res.status(404).json({ success: false, error: 'Payment not found' });
      const payment = pr.rows[0];

      if (payment.user_id !== userId) {
        return res.status(403).json({ success: false, error: 'Not your payment' });
      }

      if (payment.status === 'paid') {
        return res.status(200).json({ success: true, data: { alreadyProcessed: true } });
      }

      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      let pi;
      try {
        pi = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent);
      } catch (e) {
        return res.status(502).json({ success: false, error: 'Could not verify payment with Stripe' });
      }

      if (pi.status !== 'succeeded') {
        return res.status(400).json({ success: false, error: `Payment not completed yet (status: ${pi.status})` });
      }

      // Burn the voucher now that the payment has actually succeeded. The
      // conditional `redeemed_at IS NULL` is what makes this safe against a
      // voucher being applied to two checkouts at once: only one UPDATE can
      // match. A lost race is logged rather than failing the confirm — the
      // member has already paid the discounted amount, so refusing to
      // register them here would be the worse outcome.
      if (payment.voucher_code) {
        const burn = await getPool().query(
          `UPDATE tier_vouchers SET redeemed_at = NOW(), redeemed_event_id = $3
            WHERE user_id = $1 AND code = $2 AND redeemed_at IS NULL`,
          [userId, payment.voucher_code, payment.event_id]
        );
        if (burn.rowCount === 0) {
          console.error(
            `[events] Voucher ${payment.voucher_code} was already redeemed when confirming payment ${paymentId} — ` +
            `the discount was granted twice and needs manual review.`
          );
        }
      }

      const { status: regStatus, data: regData } = await registerAttendee(payment.event_id, userId);

      await getPool().query(
        `UPDATE event_payments SET status = 'paid', updated_at = NOW() WHERE id = $1`,
        [paymentId]
      );

      if (regStatus >= 400) {
        console.error(`[events] Payment ${paymentId} succeeded but WalletTwo registration failed:`, regData);
        return res.status(502).json({
          success: false,
          error: 'Payment succeeded but we could not finalize your registration. Please contact support — your payment is safe.',
        });
      }

      return res.status(200).json({ success: true, message: 'Registered successfully', data: regData });
    }

    /* ─── DELETE /api/events/:eventId/register ─── */
    if (req.method === 'DELETE' && segments.length === 2 && segments[1] === 'register') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const eventId = segments[0];
      const userId = decoded.userId || decoded.id;

      // If this registration was paid, refund (minus a cancellation fee) before unregistering.
      const pr = await getPool().query(
        `SELECT * FROM event_payments WHERE event_id = $1 AND user_id = $2 AND status = 'paid'
         ORDER BY created_at DESC LIMIT 1`,
        [eventId, userId]
      );
      if (pr.rows.length) {
        const payment = pr.rows[0];
        const refundAmount = Math.round(parseFloat(payment.amount_chf) * (1 - EVENT_CANCELLATION_FEE_PERCENT / 100) * 100) / 100;
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
          await stripe.refunds.create({
            payment_intent: payment.stripe_payment_intent,
            amount: Math.round(refundAmount * 100),
          });
          await getPool().query(
            `UPDATE event_payments SET status = 'refunded', refund_amount_chf = $2, updated_at = NOW() WHERE id = $1`,
            [payment.id, refundAmount]
          );
        } catch (e) {
          console.error(`[events] Refund failed for payment ${payment.id}:`, e.message);
          await getPool().query(
            `UPDATE event_payments SET status = 'refund_failed', updated_at = NOW() WHERE id = $1`,
            [payment.id]
          );
        }
      }

      const { status, data } = await unregisterAttendee(eventId, userId);

      if (status >= 400) {
        const msg = data?.message || data?.error || 'Unregistration failed';
        return res.status(status).json({ success: false, error: msg });
      }

      return res.status(200).json({ success: true, message: 'Unregistered successfully', data });
    }

    return res.status(404).json({ success: false, error: 'Endpoint not found' });

  } catch (err) {
    console.error('Events API error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error', details: err.message });
  }
}
