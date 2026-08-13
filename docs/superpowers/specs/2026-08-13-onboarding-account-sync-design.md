# Onboarding state: move from localStorage-only to account-linked

## Problem

`OnboardingWidget.tsx` currently tracks three pieces of state entirely in
`localStorage`:

- `zai_onboarding_completed` — which of the 4 "Getting Started" checklist
  steps are done (array of step ids).
- `zai_onboarding_dismissed` — whether the user closed the widget.
- `zai_page_tours_seen` — which per-page tour tooltips have already been
  shown (array of route paths).

None of this is tied to the account. Clearing browser cache, using
incognito, or switching devices makes it look like progress was lost —
because it genuinely never existed anywhere but that one browser's storage.

## Goals

- Checklist progress, dismissed state, and tours-seen all persist per
  account, not per browser.
- Changes made in one tab/device become visible in another without a full
  page reload (live sync), on a "soon" cadence — not necessarily
  sub-second, but not requiring a manual refresh either.
- Do not reintroduce the "resend every field or it gets silently blanked"
  bug class already found (and fixed twice) in `PUT /api/users/me` this
  session (profile picture wiped by the language switcher; same bug
  independently present in the mobile app's own profile save). Onboarding
  state writes constantly (every step completion is its own write), so it
  must not share that endpoint's blank-on-omit behavior.

## Non-goals

- True real-time push (WebSockets/SSE). No such infrastructure exists in
  this app today; introducing it for a low-stakes checklist widget is not
  proportionate. Polling + refetch-on-focus is "live enough" for this
  feature and matches the one sync pattern that already exists in this
  codebase (see below).
- Migrating the *page tour content* itself, or changing which steps exist.
  Only where the three state values live changes.

## Existing pattern this reuses

`zai_experience_card` is already a "shared, kept-in-sync" value in this
codebase:
- `Sidebar.tsx` reads it on mount, then listens for a custom
  `zai:experience-card-updated` window event, the native `storage` event
  (for same-browser cross-tab updates), and additionally polls every 3s as
  a fallback in case an event was missed.
- `Dashboard.tsx`/`Products.tsx`/`Home.tsx` write to it after confirming
  the real state from the server, and dispatch the custom event so other
  mounted components refresh immediately.

This design applies the same shape, just backed by the server as the
source of truth instead of `localStorage` alone.

## Data model

Three new columns on `user_profiles` (same table `language`, `image`,
`is_public` etc. already live on):

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_steps JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_dismissed BOOLEAN DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_tours_seen JSONB DEFAULT '[]'::jsonb;
```

- `onboarding_steps`: JSON array of completed step ids, e.g. `[0, 2]`.
- `onboarding_dismissed`: whether the floating widget has been closed.
- `onboarding_tours_seen`: JSON array of route paths whose tour has
  already been shown, e.g. `["/profile", "/products"]`.

Added via the same `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` /
`DO $$ ... EXCEPTION WHEN duplicate_column ...` pattern `api/db.js` already
uses elsewhere (e.g. `user_sessions.ip_address`), so it's a no-op on a
database that already has the column.

## API

A **dedicated** pair of endpoints, deliberately separate from the general
profile endpoint:

- `GET /api/users/me/onboarding` → `{ success: true, data: { steps: number[], dismissed: boolean, toursSeen: string[] } }`
- `PUT /api/users/me/onboarding` → accepts a **partial** body, e.g.
  `{ steps: [0, 1, 2] }` or `{ dismissed: true }` or `{ toursSeen: [...] }`.
  Each field is optional and independently updatable — only the columns
  present in the request body are written; omitted fields are left
  untouched in the DB (this is the key difference from `PUT /api/users/me`,
  and the whole point of not reusing it).

Both routes follow the existing file's conventions: `authenticate(req)`,
`applyRateLimit`, `ensureProfile` before querying, mounted in
`api/users/[...path].js` alongside the existing `me/avatar` and
`me/settings` sub-routes.

## Frontend sync design

In `OnboardingWidget.tsx`:

1. **Initial paint**: keep the existing `localStorage`-seeded `useState`
   initializers exactly as they are today — this avoids a flash of
   "no progress" while the network request is in flight. `localStorage`
   becomes a *cache* of the last-known server state, not the source of
   truth.
2. **On mount**: fetch `GET /me/onboarding`. If the account has data,
   overwrite local state and `localStorage` with it (server wins).
3. **On every local change** (a step completes, dismissed, a tour is
   marked seen): update local state + `localStorage` immediately
   (optimistic), then `PUT /me/onboarding` with just the changed field.
   If the write fails, leave local state as-is and retry on the next
   change — this is a low-stakes checklist, not a financial transaction;
   silently retrying on the next natural write is enough, no dedicated
   retry/backoff machinery.
4. **Staying in sync with other tabs/devices**:
   - Same-browser tabs: listen for the native `storage` event (fires when
     another tab's `localStorage` write happens), same as the existing
     `zai_experience_card` listeners.
   - Other devices/sessions: poll `GET /me/onboarding` every 15s while the
     widget is mounted, and also refetch immediately on `window.focus` (so
     switching back to the tab picks up anything that changed elsewhere
     without waiting for the next poll tick).
   - When a poll/focus fetch returns data newer than local state, merge by
     taking the union of completed steps / tours-seen (a step or tour
     marked done anywhere should stay done) and the most recently written
     `dismissed` value.

## Error handling

- If `GET /me/onboarding` fails (network error, 401, etc.), fall back
  silently to whatever is already in `localStorage` — same graceful
  degradation the rest of this widget already uses (e.g. its existing
  `try { JSON.parse(...) } catch { return [] }` initializers).
- If `PUT /me/onboarding` fails, local UI state is not rolled back (the
  user already saw their step complete; don't un-complete it in front of
  them for a transient network blip) — just let the next successful write
  carry the correct state to the server.

## Testing

No test framework exists in this repo for either the API layer or React
components (confirmed earlier this session). Verification will be:
- Backend: `node --check` on the modified file, plus a manual `curl`
  round-trip against a local/staging DB if available.
- Frontend: `tsc --noEmit` and `vite build` clean, plus a manual
  logged-in browser check (complete a step, reload, confirm it persisted;
  open a second tab, confirm the `storage` listener picks it up).

## Files touched

- `api/db.js` — add the three columns to the `user_profiles` migration
  block.
- `api/users/[...path].js` — add `GET`/`PUT /me/onboarding`.
- `apps/frontend/src/components/Onboarding/OnboardingWidget.tsx` — fetch
  on mount, write-through on change, poll + focus-refetch + storage-event
  sync.
- `apps/frontend/src/types/index.ts` — no change expected; onboarding
  state is not part of the `User` object, it's fetched/written
  independently by the widget itself.
