# Trip Sharing — Scoping & Execution Plan

Status: **scoped, not started**. Same format as the other `*-PLAN.md` docs in this repo — phases
are independently shippable, verify (tests + manual check) before moving on.

## Goal

The lightweight version of "social," scoped down from full voting/discovery per the business
discussion: let a traveller make one trip **read-only public** and get a link to send to anyone —
a travel companion, a group chat, an Instagram story. No accounts needed to view it, no voting, no
public feed of everyone's trips. The growth mechanic is simple: a link goes out, whoever opens it
sees a real, polished itinerary and a way to plan their own.

Voting and a browsable public feed are explicitly **not** in this plan — cold-start problem (empty
feed pre-launch), ongoing moderation burden for a solo founder, and no evidence yet that people
want to browse strangers' trips. Revisit after launch once there's real shared-trip volume to look
at.

## What exists today (constraints this works within)

| Piece | Today | Why it matters |
|---|---|---|
| `trips` table | `id, user_id (device id), auth_user_id (nullable), city, dates, duration, group_type, pace, days (JSON), status` | `id` is already an unguessable UUID — no separate share token needed, just a visibility flag |
| `getTrips` / `updateTripStatus` (`supabase-proxy.js`) | Scoped by `user_id=eq.{deviceId}` (mutations) or `auth_user_id`/`user_id` (reads) — **mutations don't check `auth_user_id` at all**, only the device id that created the trip | Pre-existing gap, not introduced here — the new visibility toggle mirrors this exact same scoping for consistency, not perfection |
| `dates` field | A free-text label from `PlanDatePicker` — `"Sep 13 – Sep 16, 2026"` or `"September 2026 (flexible)"` | Contains an exact date range in the common case — see privacy decision below |
| `TripDetail.tsx` | Owner-only view: full itinerary, swap, customise link, map, travel guide | The shared view reuses its rendering logic but strips every owner-only action |
| Router (`src/App.tsx`) | `/` and `/auth` render standalone (no `<Layout>` sidebar); everything else wraps in `<Layout>` | The shared page should be standalone too — a stranger opening a share link doesn't need "My Trips" in a sidebar, and a bare page reads more like a shareable web page than an app screen |
| No migration tooling, two separate Supabase projects (staging + prod) | Confirmed during the Activities work | Same manual-SQL-on-both-databases step as before |

## Key design decisions

### 1. A boolean flag, not a separate share token

`trips.id` is already a UUID — unguessable by construction. Add `is_public boolean not null
default false` rather than inventing a second opaque token: one column, one owner-facing toggle,
the existing ID becomes the share URL (`/shared/{tripId}`) once flipped on. Turning sharing back
off is just flipping the same flag — the old link immediately stops resolving.

```sql
alter table trips add column is_public boolean not null default false;
```

### 2. Hide exact travel dates in the public view

This is the concrete version of the privacy point from scoping: an exact date range on a public
page is a "this home is empty on these dates" signal. The public view shows **duration and
month/season only** (`"4 days · September"`), never the literal range the owner sees on their own
`TripDetail`. A small pure helper (`publicDateLabel(trip)`) derives this from the existing `dates`
string — regex out a month/year if present, fall back to just `"{duration} days"` if the label
doesn't parse (e.g. it was already a flexible "(flexible)" label).

Everything else on the trip (destinations, itinerary, stop names, travel guide) is already public
information about places, not the traveller — no other redactions needed.

### 3. Standalone page, not wrapped in the app `Layout`

`/shared/:tripId` renders without the sidebar/nav `Layout` — same pattern already used by `/` and
`/auth`. Its own minimal header: Battuta logo + a single "Plan your own trip" button linking to
`/plan`. That CTA *is* the growth mechanic; without it this is just a nice page with no funnel back
into the product.

### 4. Reuse `TripDetail`'s rendering, strip owner actions

The shared page is not a new design — it's `TripDetail`'s itinerary + travel guide tabs with every
owner-only affordance removed: no "EDIT TRIP" link, no swap icon on itinerary rows (no
`SwapPanel`), no "Map view" link changes needed (harmless to keep, it's just a map of public
places), `SiteDetailModal` stays available on "view details" since it's already read-only public
content. Concretely: extract the shared bits (`ItinerarySlotRow` minus the swap button, the guide
grid, the destinations/day-heading logic already in `legsFromDays`/`tripDestinations`) so
`TripDetail` and the new `SharedTrip` page both call the same rendering, rather than forking a
second copy that drifts from the first.

### 5. Ownership check mirrors the existing (imperfect) pattern

`setTripVisibility` is scoped `id=eq.{tripId}&user_id=eq.{deviceId}`, exactly like
`updateTripStatus` already is. This inherits the same known limitation (a logged-in user can't
toggle sharing on a trip from a different device than the one that created it) rather than fixing
a pre-existing gap as a side effect of this feature — call that out as a separate future fix if it
ever actually bites someone, not bundled in here.

### 6. Not in scope for v1

- Voting, likes, comments, any public "browse trips" feed.
- Cloning a shared trip into your own account/plan flow ("start from this itinerary") — a strong
  follow-up growth idea, deliberately deferred so this phase stays small enough to ship fast.
- Per-viewer analytics beyond a simple view-count event.
- Un-sharing warning ("are you sure?") — flipping the toggle off is enough friction on its own.

## Execution phases

### Phase 0 — Schema + types (zero behavior change)
- Give you the `alter table trips add column is_public ...` SQL to run on **both** Supabase
  projects (staging and production).
- Add `is_public?: boolean` to the `Trip` type (`src/lib/types.ts`).
- `src/lib/tripSharing.ts`: `publicDateLabel(trip): string` (pure, the date-redaction helper from
  decision 2), `shareUrl(tripId): string` (pure, `${window.location.origin}/shared/${tripId}`).
- **Tests**: `publicDateLabel` against a real range label, a flexible-month label, and garbage
  input; `shareUrl` format.

### Phase 1 — Backend: visibility toggle + public read
- `supabase-proxy.js`: `setTripVisibility` (`{tripId, isPublic}` → `PATCH ...&user_id=eq.deviceId`,
  mirroring `updateTripStatus`'s scoping) and `getPublicTrip` (`{tripId}` → `GET
  ...&is_public=eq.true` — returns nothing for a private or nonexistent trip, so probing random
  UUIDs against this endpoint reveals nothing beyond "not shared").
- **Manual**: toggle a real trip on, confirm `getPublicTrip` returns it; toggle off, confirm it
  goes back to returning nothing; confirm a trip that was never shared returns nothing from the
  start.

### Phase 2 — Extract shared rendering, build the public page
- Pull the itinerary-row and travel-guide-grid rendering out of `TripDetail.tsx` into presentational
  pieces both pages call (no behavior change to `TripDetail` itself — this is a refactor, verify
  it's pixel-identical before adding the new page on top).
- New `src/pages/SharedTrip.tsx`, route `/shared/:tripId` (standalone, no `<Layout>`): fetches via
  `getPublicTrip`, shows hero, `destinationsLabel`, `publicDateLabel`, itinerary, travel guide, a
  "Plan your own trip" CTA to `/plan`, and a not-found state (private/missing trip) that doesn't
  distinguish "doesn't exist" from "exists but private."
- `track("Shared Trip Viewed", { trip_id })` on load.
- **Manual**: open a shared link signed out, on mobile width, for a single-city and a multi-city
  trip; confirm no edit/swap affordances appear anywhere; confirm the not-found state for a
  made-up UUID and for a real-but-private trip look identical.

### Phase 3 — Share toggle on Trip Detail
- A "Share" control next to "EDIT TRIP" on `TripDetail`'s header: off state → button flips
  `is_public` on, copies the share link to the clipboard, shows a brief confirmation; on state →
  shows the link (copy again) and an "unshare" action that flips it back off.
- `track("Trip Shared", { trip_id })` / `track("Trip Unshared", { trip_id })`.
- **Manual**: share a trip, open the copied link in a private/incognito window, confirm it loads;
  unshare it, refresh that same tab, confirm it now shows not-found.

### Phase 4 — Docs
- `NOTES.md` entry, README "Trip data model" addendum (the `is_public` flag and the date-redaction
  rule, so a future change to the `dates` format doesn't quietly leak exact dates on shared trips).

## Manual QA checklist (run at Phase 2 and again at Phase 3)

1. Share a single-city trip → link opens signed out, shows itinerary + guide, no owner actions,
   month-only date label, "Plan your own trip" CTA present.
2. Share a multi-city trip → per-leg city headings render the same as the owner's own view.
3. Unshare → the same link now 404s (indistinguishable from a link that never existed).
4. A trip built before this feature shipped (`is_public` absent/null) → treated as private, not an
   error.
5. Mobile width end to end.
6. The exact date range never appears anywhere in the page source of a shared trip — grep the
   rendered HTML for the literal date string from the owner's private view.

## Risks & open questions

- **Cross-device toggle limitation** — see decision 5. Low likelihood of anyone hitting it before
  cross-device trip sync is a thing at all; not blocking.
- **Open question**: should the public page eventually offer "use this itinerary as a starting
  point" (clones it into the viewer's own plan)? Strong follow-up growth idea, explicitly deferred
  (decision 6) to keep this phase shippable fast — revisit once basic sharing is live and you can
  see whether links actually get clicked.
- **Open question**: is a plain view-count enough, or do you want to know *where* shares are being
  opened from (referrer) to see which channels the mechanic actually works through? Easy to add
  later from the same `track()` call if you decide you want it.
