// ══════════════════════════════════════════════════════════════════════
// Loyalty economics — single source of truth for the BACKEND.
//
// Mirrored on the frontend in apps/frontend/src/config/rewards.ts.
// Keep the two in sync; if you change a number here, change it there.
//
// The scheme replaces an earlier "2.7 points per CHF" model:
//   • EARN:   1 point per 1 unit of currency spent — 1 CHF, 1 EUR and
//             1 USD all award 1 point. No FX conversion, by design.
//   • REDEEM: 1 point is worth 1 centime, i.e. CHF 0.01.
// Net effective rate is therefore 1% (1 point per unit × CHF 0.01). The
// old scheme earned 2.7 points per CHF and redeemed at CHF 0.01, i.e. 2.7%
// — so the redemption rate is unchanged and only the earn rate moved.
// ══════════════════════════════════════════════════════════════════════

/** Points awarded per unit of currency spent (currency-agnostic). */
export const POINTS_PER_CURRENCY_UNIT = 1;

/** Monetary value of a single point when redeemed, in CHF (1 centime). */
export const CHF_PER_POINT = 0.01;

// ── Which purchases earn points ───────────────────────────────────────
// Only physical zai goods earn points. Events, services and digital
// collectibles explicitly do NOT, per the client's decision — so this is
// an allowlist, not a denylist: a new category added later earns nothing
// until it is deliberately listed here.
export const EARNING_CATEGORIES = ['skis', 'apparel', 'accessories', 'equipment'];

/** True if a purchase in this category should award points. */
export function categoryEarnsPoints(category) {
  if (!category) return false;
  return EARNING_CATEGORIES.includes(String(category).trim().toLowerCase());
}

/** Points earned for an amount spent, in any supported currency. */
export function pointsForAmount(amount) {
  const n = parseFloat(amount || 0);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * POINTS_PER_CURRENCY_UNIT);
}

/**
 * Points needed to cover a given CHF amount outright.
 *
 * Points may cover 100% of a deal's price, so the redemption cap is always
 * derivable from the price and is computed rather than stored. The deals
 * table still has a max_points_discount column, but its values drifted into
 * nonsense (1,000 points — CHF 10 — against a CHF 1,950 ski) precisely
 * because they were maintained by hand. Deriving it means the cap cannot go
 * stale when a price changes.
 */
export function pointsToCoverCHF(priceCHF) {
  const n = parseFloat(priceCHF || 0);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n / CHF_PER_POINT);
}

/** CHF discount that a given number of points is worth. */
export function chfForPoints(points) {
  const n = parseInt(points, 10);
  if (!isFinite(n) || n <= 0) return 0;
  // round to rappen so the charged amount is always a valid money value
  return Math.round(n * CHF_PER_POINT * 100) / 100;
}

// ── Tiers ─────────────────────────────────────────────────────────────
// `min` is the inclusive lower bound. Below the first tier's min the
// member simply has no tier yet. `voucherCHF` is the one-time event
// voucher unlocked on reaching the tier; `voucherValidYears` is how long
// a generated code stays usable.
export const TIERS = [
  { key: 'white',   name: 'White',   min: 500,   voucherCHF: 25  },
  { key: 'blue',    name: 'Blue',    min: 2500,  voucherCHF: 50  },
  { key: 'red',     name: 'Red',     min: 5000,  voucherCHF: 100 },
  { key: 'black',   name: 'Black',   min: 10000, voucherCHF: 200 },
  { key: 'diamond', name: 'Diamond', min: 15000, voucherCHF: 300 },
];

export const VOUCHER_VALID_YEARS = 2;

/** Highest tier reached for a balance, or null if below the first tier. */
export function tierForPoints(points) {
  const n = parseInt(points, 10) || 0;
  let reached = null;
  for (const t of TIERS) if (n >= t.min) reached = t;
  return reached;
}

/** Every tier whose threshold the balance has reached. */
export function unlockedTiers(points) {
  const n = parseInt(points, 10) || 0;
  return TIERS.filter((t) => n >= t.min);
}
