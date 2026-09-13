# Working Notes

A running log of decisions, gotchas, and context from working sessions on this repo —
kept so we can trace back *why* something is the way it is, or find a point to return
to, without having to dig through commit messages or chat history.

Newest entries at the top. Each entry should be self-contained enough to make sense on
its own later.

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
- ⬜ Phase 4 — Plan flow builds multi-leg trips.
- ⬜ Phase 5 — Trip Detail / cards / map / customise show multiple destinations.
- ⬜ Phase 6 — docs.

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
