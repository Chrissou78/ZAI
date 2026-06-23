import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
const API_KEY = process.env.WALLETTWO_API_KEY;
const EVENTS_BASE = 'https://api.wallettwo.com/event/v1/api';

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

/* ── parse BlockNote program JSON → plain text lines ─────── */

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

  // Description may now be BlockNote JSON too — extract plain text
  let description = evt.description || '';
  if (typeof description === 'string' && description.trim().startsWith('[')) {
    const parsed = parseProgramBlocks(description);
    description = parsed.join('\n');
  }

  return {
    id: evt.id,
    title: evt.name || '',
    name: evt.name || '',
    description,
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

/* ── main handler ────────────────────────────────────────── */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

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

      // If user is logged in, check registration for each event
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

      // Single event response may be { event: {...} } or flat
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

    /* ─── POST /api/events/:eventId/register ─── */
    if (req.method === 'POST' && segments.length === 2 && segments[1] === 'register') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const eventId = segments[0];
      const userId = decoded.userId || decoded.id;

      const { status, data } = await w2Fetch(`/event/${eventId}/attendees`, {
        method: 'POST',
        body: JSON.stringify({ attendeeId: userId }),
      });

      if (status >= 400) {
        const msg = data?.message || data?.error || 'Registration failed';
        return res.status(status).json({ success: false, error: msg });
      }

      return res.status(200).json({ success: true, message: 'Registered successfully', data });
    }

    /* ─── DELETE /api/events/:eventId/register ─── */
    if (req.method === 'DELETE' && segments.length === 2 && segments[1] === 'register') {
      const decoded = authenticate(req);
      if (!decoded) return res.status(401).json({ success: false, error: 'Authentication required' });

      const eventId = segments[0];
      const userId = decoded.userId || decoded.id;

      const { status, data } = await w2Fetch(`/event/${eventId}/attendees`, {
        method: 'DELETE',
        body: JSON.stringify({ attendeeId: userId }),
      });

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
