/**
 * What to call a member, server side.
 *
 * WalletTwo returns the member's email address in the name fields until they
 * fill in a profile, so "the name" for a fresh account is routinely a full
 * address. Stored as-is on a photo or a reaction, it then appears in the
 * community feed for everyone else to read — which is both ugly and a small
 * privacy leak.
 *
 * Mirrors apps/frontend/src/lib/displayName.ts. Two copies rather than a
 * shared module because the API and the frontend have no build step in common;
 * they must stay in step, so change both together.
 */

const looksLikeEmail = (v) => /\S+@\S+/.test(v);

const capitalise = (w) => (w ? w[0].toUpperCase() + w.slice(1) : '');

/** `agent.melih@gmail.com` -> `Agent Melih` */
function fromEmail(value) {
  const at = value.indexOf('@');
  const local = at > 0 ? value.slice(0, at) : value;
  const parts = local
    .replace(/[._\-+]+/g, ' ')
    // Trailing digits are disambiguation, not part of a name.
    .replace(/\d+\s*$/, '')
    .split(' ')
    .filter(Boolean);
  const name = [capitalise(parts[0] || ''), capitalise(parts[1] || '')].filter(Boolean).join(' ');
  return name || 'Member';
}

/**
 * Never returns something containing an @. Falls back to 'Member' when there
 * is nothing usable at all.
 */
export function cleanDisplayName(value) {
  const v = String(value ?? '').trim();
  if (!v) return 'Member';
  return looksLikeEmail(v) ? fromEmail(v) : v;
}

export default cleanDisplayName;
