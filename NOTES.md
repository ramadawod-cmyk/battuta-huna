# Working Notes

A running log of decisions, gotchas, and context from working sessions on this repo —
kept so we can trace back *why* something is the way it is, or find a point to return
to, without having to dig through commit messages or chat history.

Newest entries at the top. Each entry should be self-contained enough to make sense on
its own later.

---

## 2026-09-13 — Mobile: use `dvh`, not `vh`, for any full-height layout (`62b9976`)

Reported: on mobile, the Plan chat's message input was hidden under the browser's address bar.
Root cause: `100vh` on mobile browsers is computed as if the address bar is permanently collapsed
(the "large viewport"), but the actually-visible area right after page load is smaller since the
bar is showing — so anything sized with a fixed `h-[calc(100vh-...)]` renders taller than what's
on screen, pushing whatever's at the bottom (here, the chat input) below the fold.

Fixed by switching to the `dvh` (dynamic viewport height) unit everywhere `100vh` was driving an
exact height, not just a `min-height`: Plan.tsx's chat container, and the `SwapPanel`/
`SiteDetailModal` modal overlays. `dvh` tracks the real visible viewport as the address bar
shows/hides, and is supported by every mobile browser in active use today. **Rule of thumb for
future full-height layouts: `min-h-screen` (i.e. `min-height: 100vh`) is fine — a taller-than-
expected element just causes normal page scroll. An exact `height: 100vh` on anything with
content pinned to its bottom edge is the risky pattern on mobile; use `dvh` there instead.**

Couldn't fully verify on-device in this session — headless Chrome has no real collapsing address
bar, so `vh` and `dvh` compute identically there, and a screenshot can only confirm the fix causes
no regression, not that it fixes the original symptom. Confirmed instead via DOM measurement (chat
input's bounding box fully within the viewport) and a broader overflow sweep (Explore, Plan, My
Trips, About at 375/390/360px widths, no horizontal overflow, hamburger menu works). Worth a quick
check on an actual phone to close the loop.

---

## 2026-09-13 — Activities (shipped, iterating)

Full plan in `ACTIVITIES-PLAN.md`. Adds a second AI-generated content type alongside sites —
"go to the beach" / "go out for drinks" style experiences, not landmarks — in their own
`activities` table (separate from `sites` on purpose: different taxonomy, different generation
cadence, `is_area`/`area_name` fields sites don't need). Designed to normalize into a
`Site`-shaped candidate at fetch time so the existing scheduler, place-selection ranking, and map
need zero changes (same "wrap, don't rewrite" call as multi-destination).

There are **two separate Supabase projects** for this app (staging and production) — every schema
change has to be run on both by hand, there's no migration tooling in this repo. Forgetting the
second one means staging works and production silently 404s/500s on activities.

Progress:
- ✅ Phase 0 (`e0190b2`) — `Activity` type, `kind?: "site"|"activity"` on `Site`/`TripSlot`,
  `src/lib/activityTypes.ts` (`ACTIVITY_TYPES`, accents, `normalizeActivityType`).
- ✅ Phase 1 (`5da2395`) — `ensureCityActivities` (`src/lib/activities.ts`), `getActivities`/
  `upsertActivities` proxy actions. **Real gotcha hit and fixed**: the new `activities` table came
  up with Row-Level Security enabled and zero policies, which silently denies all anon-key access
  — inserts failed with a `42501` error, reads came back an empty array instead of erroring (easy
  to misread as "generation produced nothing" rather than "everything is blocked"). Fixed with
  `alter table activities disable row level security;` on both databases, matching whatever
  `sites`/`cities` already have. **If a future new table's inserts fail with a `42501` Postgres
  error code, check RLS before assuming the code is wrong.** Verified live against the staging DB
  after the fix: generated real, distinct Beirut beaches and nightlife districts (Gemmayzeh, Mar
  Mikhael) with correct `is_area`/`area_name`, and correctly returned zero Beach & Swim results
  for landlocked Amman rather than hallucinating one — all 6 rows persisted and were readable back.
- ✅ Phase 2 (`1a08190`) — `Plan.tsx`'s `loadSites` fans `ensureCityActivities` out per leg in
  parallel with `ensureCitySites`, normalizing each `Activity` into a `Site`-shaped candidate
  (`activityToCandidate`) before merging into the same pool. Verified live: a Beirut trip's
  place-selection grid showed all 6 previously-generated activities alongside regular sites, with
  zero scheduler/UI changes needed.
- ✅ Phase 3 (`2518bb6`) — `INTEREST_TAGS` now spans `CATEGORIES` + `ACTIVITY_TYPES`; the
  place-selection filter pills (previously hardcoded to just `CATEGORIES`) use the same combined
  list so activities don't disappear under a filter; `PlaceCard` shows an `ACTIVITY` badge.
  Verified live: picking "Nightlife & Drinks" as an interest correctly widened the default
  selection to include matching activities (23 places, up from the unbiased baseline).
- ✅ Phase 4 (`4a199b5`) — `siteToSlot()` carries `kind` through onto `TripSlot` so an
  activity-sourced stop stays tagged all the way into the built itinerary; `TripDetail`'s itinerary
  rows and `SwapPanel`'s alternatives list (extended to also fetch activities for the day's city)
  both show the same badge. Verified live end to end: built a Beirut trip with "Nightlife & Drinks"
  as an interest, got 5 activity-sourced stops in the finished itinerary (Souks of Beirut, Jeita
  Grotto, Mar Mikhael Nightlife District, etc), all correctly badged on Trip Detail and in the swap
  panel.
- ✅ Phase 5 — docs. README's "Trip data model" section gets an activities paragraph. This entry
  is the closing note.

All 6 phases shipped to staging and then `main` (`0c6449e`).

**Follow-up (`5a414fa`) — evening scheduling.** The v1 plan explicitly deferred time-of-day
awareness, and it showed immediately in practice: a nightlife activity competed for a slot on pure
geography, so it could land at 11am or lose out to a closer museum and never get scheduled at all.
Fixed in `planItinerary` (`src/lib/itineraryPlanner.ts`): activities whose category is
unambiguously evening-only (`Nightlife & Drinks`, `Live Entertainment` — a small hardcoded set,
*not* every activity type; things like Food Experience or Beach & Swim are left "any time" on
purpose, since guessing a specific time-of-day for those would misfire as often as it'd help) are
held out of the normal daytime proximity walk and assigned separately, one per day, always
appended after dinner (8:30pm+) regardless of geography. Must-see evening activities get first
pick of their closest day; the rest spread across whichever days are still unclaimed, so several
real nightlife options in a city cover several different evenings instead of one day claiming
them all. Verified live: a 4-day Beirut trip landed 3 different nightlife/entertainment activities
at 8:30pm across 3 different days, with every non-evening activity type scheduling exactly as
before.

**Deliberately still left out**: teaching the conversational agent to extract activity intent from
free text ("I want a beach day") — it stays scoped to destinations/duration; activities are only
ever surfaced via the interests step and place-selection grid. Per-item time-of-day (e.g. a
specific "Food Experience" being breakfast-only) also isn't modeled — only the two unambiguous
evening categories get special treatment; expanding that mapping is a natural next step if a
particular category's default placement turns out to be wrong often enough to matter.

---

## 2026-09-13 — Multi-destination trips (in progress)

Full plan in `MULTI-DESTINATION-PLAN.md`. The two decisions that shape everything else:
carry `city`/`cityId`/`country` on each `TripDay` inside the existing JSON `days` column
(**no DB migration**, old trips keep working because `trips.city` stays the first city), and
wrap the existing single-city scheduler per leg instead of rewriting it. Six phases, each
shippable on its own; the prompt (Phase 3) can ship before the flow uses legs (Phase 4)
because the parser accepts both the old and new `[PARTIAL]` shapes.

Progress (update this line as phases land, don't add a new dated entry per phase --
it's one continuous effort):
- ✅ Phase 0 (`e488984`) — `TripDay.city/cityId/country`, `src/lib/trips.ts` helpers.
- ✅ Phase 1 (`63656d3`) — `planMultiCityItinerary`/`splitDaysAcrossLegs` in
  `itineraryPlanner.ts`, not called from anywhere yet.
- ✅ Phase 2 (`084d9f4`) — `PlanPartial` is now `{legs, duration, dates}`; `parsePartial`
  accepts both the legacy single-city shape and the new legs shape. `Plan.tsx` reads
  `partial.legs[0]` everywhere it read `partial.city` -- pure refactor, verified live against
  a real model response, no behavior change (the prompt still only ever emits one leg).
- ✅ Phase 3 — `GATHER_SYSTEM_PROMPT` constant became `buildGatherSystemPrompt(today: Date)`
  in `planFlow.ts`, called as `buildGatherSystemPrompt(new Date())` from `Plan.tsx`. Verified
  live against the real model (not unit-testable — it's a prompt) with a Puppeteer script that
  intercepts the `plan-agent` response: single city (Amman) unchanged, country → base-city
  suggestion (Jordan → Amman + Wadi Musa), multi-city split that sums correctly (Rome+Florence,
  Jordan+Egypt), vague/seasonal request → concrete named cities (warm+cheap December). **One
  round of prompt tightening needed**: the first draft only told the agent to propose cities for
  a *country* name, so "Bali" (a region, not a country) slipped through and just asked for
  duration instead of naming Seminyak/Ubud/Canggu. Added an explicit region/island rule with a
  worked example — re-tested and fixed. Lesson: when a prompt rule is scoped to one noun
  category (here "country"), explicitly test the adjacent categories (region, island, area) too,
  don't assume they're covered by the same wording.
- ✅ Phase 4 — `Plan.tsx` now builds real multi-leg trips: `loadSites` fans `ensureCitySites` out
  across every leg in parallel (a failed leg contributes no sites rather than failing the whole
  trip); place selection is grouped per leg with `pickDefaultPlacesForLegs` (each leg gets its
  own cap sized to its own day count, extracted to `src/lib/placeSelection.ts` so it's unit
  tested); `buildTrip` now always calls `planMultiCityItinerary` (even for one leg — the wrapper
  degrades to exactly `planItinerary`'s old behavior, verified by an "identical to direct call"
  test), so every saved day now carries `city`/`cityId`/`country`, not just multi-leg ones. Day
  titles (`buildDayLabelsSystemPrompt`) get each day's city so titles fit a leg the trip has
  moved on to. `trips.city` stays the first leg's city, per the plan's data-model decision.
  Verified end-to-end with a Puppeteer script driving the full chat flow (city → dates → party →
  interests → pace → build) and inspecting the actual `updateTripStatus` payload: a single-city
  Amman trip built 4 correctly-tagged days with no regression, and "Rome and Florence, 6 days"
  built 6 days split 3/3 with the right city on each and no empty days. Trip Detail renders both
  without errors — still as one flat day list with the first leg's city as the hero (that's
  Phase 5's job, not touched yet).
- ✅ Phase 5 — Trip Detail, map, cards, and customise all show multiple destinations now, using
  the Phase 0 helpers (`tripDestinations`, `destinationsLabel`, `legsFromDays`): hero title,
  map hero, `MyTrips` cards, and `CustomiseTrip`'s subtitle all show "Rome · Florence" instead of
  just the first city; the itinerary gets a city heading wherever the destination changes
  (`legsFromDays` groups the already-filtered day list); the Travel Guide tab now fetches and
  renders tips **per destination** (`ensureCityTips` called once per leg, kept in a
  `Record<cityId, CityTips>`) with a section heading per city; map day tabs read "Day 4 ·
  Florence". All of this is gated on `tripDestinations(trip).length > 1` so a single-city trip
  renders with zero extra headings -- verified byte-for-byte via Puppeteer (hero shows just
  "Amman", zero itinerary headings, exactly 8 guide cards, same as before this phase).
  **Real bug caught and fixed**: `SwapPanel` and `SiteDetailModal` were still scoped to
  `trip.city` (the first leg) — swapping or viewing details on a *later* leg's stop would have
  offered Rome alternatives for a Florence stop, and shown "Rome" as the city on a Florence site's
  detail modal. Fixed by resolving the specific day's `city`/`cityId` (falling back to `trip.city`
  when the day has none, i.e. every pre-multi-destination trip) and threading that through instead
  of the trip-wide value. Also fixed a subtler one: `selectedSiteName` only stored the clicked
  site's *name*, so two legs with a same-named stop would collide; now stores `{day, slotName}`
  like `swapTarget` already did, and resolves the city from that specific day.
  Verified live: built a fresh Rome+Florence trip and confirmed swapping "Ponte Vecchio" (a
  Florence stop) offered only Florence alternatives (Uffizi, Piazzale Michelangelo, etc, zero Rome
  places), and its site-detail modal showed "Florence", not "Rome".
- ✅ Phase 6 — docs. Added a "Trip data model" section to `README.md` explaining the
  `TripDay.city/cityId/country` shape, `trips.city` = first leg, the `src/lib/trips.ts`
  helpers, and the day-scoping gotcha Phase 5 caught (resolve *that day's* city, not
  `trip.city`, for any day-level UI). This entry is the closing note for the effort.

**Done.** All 6 phases shipped to staging (`c2493ca` → `e488984` → `63656d3` → `084d9f4` →
`bd69a1a` → `c605e7d` → `fd37ae8`). Not pushed to `main` yet — do that the same
tree-replacement way as the 2026-09-12 launch below if `main` has diverged again, otherwise
a normal merge is fine since both branches share history this time.

**Deliberately left out of v1** (call these out before extending this further): editing
the day split between legs in the UI; travel time/transport between legs; per-leg dates;
mixing an existing trip's legs after creation; more than 4 legs. Also open per the plan
doc: whether the agent should ever be allowed to pre-fill `dates` from chat text instead of
always deferring to the calendar — left as "no" for v1.

---

## 2026-09-12 — Added an automated test suite as a deploy gate

Set up [Vitest](https://vitest.dev) for unit tests, scoped to pure logic only (no
DOM/browser tests yet — see the tradeoff note below). Wired into `package.json`'s
`build` script as `vitest run && tsc -b && vite build`, so a failing test blocks the
build — and since Netlify's build command *is* `npm run build`, a failing test blocks
deploy too, with no separate CI system needed.

- Config: `vitest.config.ts` (kept separate from `vite.config.ts` on purpose — these
  tests don't need the React/Tailwind/PWA plugins).
- First tests: `src/lib/geo.test.ts`, `src/lib/categories.test.ts` — covering
  `slugify`, `haversineMeters`, `describeGeolocationError`, `normalizeCategory`,
  `getDurationMinutes`, `formatDuration`. Several of these are exactly the functions
  behind real bugs earlier this session (the non-Latin `slugify` fallback, category
  normalization mismatches), which is why they were the starting point.
- **Verified the gate actually works**, not just that tests pass: deliberately broke
  one assertion and confirmed `npm run build` failed before ever reaching `tsc`/`vite
  build`, then restored it and confirmed a clean build.
- Scripts: `npm test` (run once), `npm run test:watch` (re-run on change).
- See the README's "Testing" section for how to add more.

**Deliberately out of scope for now**: end-to-end/browser tests (e.g. Playwright
driving Explore → open a trip → swap a stop). Would catch more, but this app leans on
real external services (Supabase, Anthropic, Wikipedia) that would need mocking to
test reliably without flakiness or cost — worth layering on later, not a blocker for
having *some* automated safety net now.

---

## 2026-09-12 — Trip Detail / Explore redesign, staging → main launch

### Repo state going into this session
- `staging` had ~2 weeks of itinerary-generation work but no design pass on the trip
  inner page or Explore.
- `main` had been reverted (Aug 17, commit `5ccb853`) all the way back to the legacy
  static PWA — no `src/`, no `package.json`, 11 files total. This wasn't obvious until
  we tried to merge staging into main and got dozens of delete/modify conflicts.

### Trip Detail page
- Redesigned from a two-column layout (itinerary + travel-guide sidebar always both
  visible) into **Itinerary / Travel Guide tabs** — the guide can auto-generate up to 8
  tip categories now, which made the old sidebar column much taller than the itinerary.
- Travel guide cards: emoji → `lucide-react` icons in colored pastel badges (purple/
  orange/coral/teal, cycled across categories — see `src/lib/guideMeta.ts`). Long tips
  clamp to 2 lines with a "Read more" toggle.
- Itinerary rows: added a 56px place thumbnail per stop (`useWikiThumbnail`).
- **Swap flow**: was a full page (`/trip/:tripId/swap`) that re-fetched everything and
  felt like a full reload. Replaced with `SwapPanel` — an in-page modal, reusing the
  already-loaded trip. `TripDetailSwapItem.tsx` deleted as dead code.
- **Site details**: same problem, same fix. `SiteDetailModal` (`src/components/`)
  replaces the standalone `/site/:siteName` page, opened from Explore's "View more",
  each trip itinerary stop, and AllSites. Takes `cityId`/`cityName` as **explicit
  props**, not from `useCity()` — a trip can be for a different city than the one
  currently detected for the user (e.g. viewing an old Amman trip while in Dubai).
  `SiteDetail.tsx` deleted as dead code once all three callers were converted.
  - Fixed a UX bug where the short cached description would visibly get replaced by a
    much longer AI-generated one a few seconds later ("text keeps expanding") — now
    shows a skeleton while generating instead of the short text.
  - Added prev/next chevron arrows on the photo carousel (dots alone were hard to
    target one at a time).
  - Removed the "Photo: {attribution}" credit line — not needed once the image source
    switches to Google.
- **Hero banner** (`bg-secondary-purple` image card): city name/meta/buttons used to
  be overlaid on the photo with a gradient scrim. On light photos the white text and
  one of the two buttons (which used *dark* text, inconsistently with the other) became
  unreadable. Fixed properly by moving all of it to a plain header row **above** the
  image instead of trying to guarantee contrast against an arbitrary photo. Same fix
  applied to Explore's city hero.
- **Map link**: was a single "MAP" button in the header (always opened day 1). Moved to
  a "Map view" link+icon next to each `DAY N` label, linking to
  `/trip/:tripId/map?day=N` — `TripMapBuilder` now reads that query param to pre-select
  the day.
- Sidebar: "Settings" moved from the main nav list to the bottom-left slot that used to
  hold a static "Exploring" status pill.

### Sidebar sticky-scroll bug
`overflow-x-hidden` on the `Layout` flex wrapper (parent of the sidebar) forced the
browser to compute `overflow-y: auto` on that same element (can't have hidden on one
axis and visible on the other) — which silently turned it into its own scroll
container. `position: sticky` then anchored to *that* container instead of the real
viewport, so the sidebar scrolled away with the page. Fix: moved `overflow-x-hidden`
onto `<main>` instead. **If a sticky/fixed element misbehaves again, check for stray
`overflow-x`/`overflow-y` on an ancestor before assuming the sticky CSS itself is wrong.**

### Explore page
- Same hero-contrast fix as above (moved text off the image).
- **Stale city bug**: the detected city is cached in `localStorage`
  (`bh_current_city`, see `CityContext.tsx`) so the app doesn't re-geolocate on every
  visit. It was never re-validated after the first save — a user who last opened the
  app in one city would keep seeing that city forever, even after actually traveling
  elsewhere (this is what caused "I'm in Dubai but it shows Jordan"). Fixed: the cached
  city still renders immediately, but a background check re-resolves from a fresh GPS
  position and self-corrects if it's changed.
- **Broken hero image**: Dubai's cached `hero_image_url` in the `cities` table was a
  raw Wikimedia thumb URL with a hand-built `/800px-` width segment — a pattern
  Wikimedia's thumbnailer rejects with a 400 for many source images (confirmed by
  fetching it directly and getting Wikimedia's error page back). Nothing in the current
  app ever refreshes that cached value once seeded. Fixed by retrying with a fresh
  title lookup when the cached image fails to load, instead of falling back to a flat
  gradient forever. **This is a data-layer problem, not fully fixed at the source** —
  other cities could have the same stale pattern; the retry just papers over it per-city
  as it's hit.
- POI cards: description clamps to 2 lines + "View more" link.
- Category filter pills each get a color (purple/orange/coral/teal cycled across the 8
  categories, same palette as the travel guide icons — see `CATEGORY_ACCENTS` in
  `src/lib/categories.ts`). **Decided against** coloring the whole POI card to match
  (tried it, felt like too many competing colors) — only the category *label text* on
  each card picks up the accent now; card border and "View more" stay purple.

### Staging → main (production launch)
main being reverted to the legacy PWA meant a normal `git merge origin/staging` was
producing dozens of delete/modify conflicts and, worse, silently auto-merging files
that exist on both branches with *completely unrelated* content (e.g. `index.html`,
`netlify.toml`) — a line-level 3-way merge doesn't know those aren't meant to be
reconciled, so an auto-resolved result could easily have been garbage without ever
showing as a conflict.

**What we did instead**, since the intent was "main should become exactly what's on
staging":
```
git checkout main
git merge --no-commit --strategy=ours origin/staging   # records both parents, keeps main's tree for now
git checkout origin/staging -- .                        # overwrite tracked paths with staging's content
git rm manifest.json sw.js                              # the only 2 files present on main but not staging
git diff --cached origin/staging -- .                   # MUST be empty before committing
git commit                                              # now a real merge commit, tree == staging exactly
```
Verified `git diff origin/main origin/staging` was empty *after* pushing too.

**Note for next time**: reverting a merge commit and later re-merging the same branch
is a known git trap — git's ancestry-based diff can conclude the previously-reverted
changes are "already in history" and silently omit them from a normal merge. We didn't
hit this because the approach above never relies on ancestry-based diffing (we force
the tree to match staging and verify with a literal `diff`, not a merge algorithm). If
a *future* promotion to main uses a plain `git merge origin/staging` instead of this
tree-replacement approach, re-verify with a zero-diff check before trusting it —
especially since main now has its own history again after this merge.
