/**
 * What to call a member on screen.
 *
 * WalletTwo returns the member's email address in BOTH the given-name and
 * family-name fields until they fill in a profile, so "the name" for a fresh
 * account is routinely a full address — twice. Printed as-is that reads as
 * `agentmelihcarter@gmail.com agentmelihcarter@gmail.com`, which overflows the
 * sidebar, the dashboard greeting and the profile card.
 *
 * So no value that looks like an email is ever treated as a name: it is
 * reduced to the part before the @, which is short and reads as the temporary
 * placeholder it is. The returned `display` is guaranteed not to contain an @.
 *
 * Previously this lived twice, byte-identical, in Sidebar.tsx and
 * Dashboard.tsx — while a third place did its own thing with
 * `user.givenName || user.email`. One copy now, so the greeting, the sidebar
 * and the header avatar cannot disagree about who someone is.
 */

export interface DisplayName {
  /** First name, or the derived placeholder. Safe for initials. */
  first: string;
  /** Family name, empty when only a placeholder is known. */
  last: string;
  /** What to print. Never contains an email address. */
  display: string;
}

const clean = (v: unknown): string => String(v ?? '').trim();

const looksLikeEmail = (v: string): boolean => /\S+@\S+/.test(v);

/** `agent.melih@gmail.com` → `agent.melih` */
const localPart = (v: string): string => {
  const at = v.indexOf('@');
  return at > 0 ? v.slice(0, at) : v;
};

const capitalise = (w: string): string =>
  w ? w[0].toUpperCase() + w.slice(1) : '';

/**
 * Turn an address into the best name it can offer. `first.last@…` yields a
 * plausible first and last; a single run of characters yields one word, which
 * is still far better than printing the address.
 */
function fromEmail(value: string): DisplayName {
  const parts = localPart(value)
    .replace(/[._\-+]+/g, ' ')
    // Trailing digits are almost always disambiguation, not part of a name.
    .replace(/\d+\s*$/, '')
    .split(' ')
    .filter(Boolean);

  const first = capitalise(parts[0] || '');
  const last = capitalise(parts[1] || '');
  return {
    first,
    last,
    display: [first, last].filter(Boolean).join(' ') || 'Member',
  };
}

export function getDisplayName(user: any): DisplayName {
  const rawFirst = clean(user?.givenName ?? user?.firstName);
  const rawLast = clean(user?.familyName ?? user?.lastName);

  // An email sitting in a name field is not a name — discard it rather than
  // print it, and fall through to deriving something readable below.
  const first = looksLikeEmail(rawFirst) ? '' : rawFirst;
  const last = looksLikeEmail(rawLast) ? '' : rawLast;

  if (first || last) {
    return { first, last, display: [first, last].filter(Boolean).join(' ') };
  }

  // Nothing real to show. Derive from whichever address we have — the name
  // fields often hold it before `email` itself is populated.
  const source = [rawFirst, rawLast, clean(user?.email)].find(Boolean) || '';
  return source ? fromEmail(source) : { first: '', last: '', display: 'Member' };
}

export default getDisplayName;
