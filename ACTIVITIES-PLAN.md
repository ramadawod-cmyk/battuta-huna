# Activities — Scoping & Execution Plan

Status: **scoped, not started**. Each phase below is independently shippable and leaves the
app working; execute them in order, one at a time, verifying (tests + manual check) before
moving on. Mirrors the approach and format of `MULTI-DESTINATION-PLAN.md`, which shipped
cleanly this way.

## Goal

Today the AI only generates static points of interest ("sites" — museums, landmarks, viewpoints)
via `ensureCitySites`. The traveller can't ask for an *experience* and get a real suggestion:
"I want a beach day" or "somewhere good to go out for drinks" has no path to an answer beyond
whatever a "Nature" or "Neighbourhood" category site happens to be.

Add a second, parallel content type — **activities** — that the AI generates per city, stored in
its own Supabase table, and made available at trip-creation time alongside sites: beaches,
nightlife districts, shopping streets, day trips, wellness spots, etc.

## What exists today (the constraints we're working within)

| Piece | Today | Why it matters |
|---|---|---|
| `sites` table / `Site` type (`src/lib/types.ts`) | `id, city_id, name, category, tags, description, lat, lng, map_url, image_url, must_see, duration_minutes, review_status, source` | The shape every downstream consumer (scheduler, cards, map) already knows how to handle |
| `ensureCitySites` (`src/lib/sites.ts`) | Cache-first: reuse cached sites if ≥24 exist, else AI-generates in 12 parallel batches (one per `CATEGORIES` entry, some repeated for "hidden gem" variety), dedupes by name + 150m proximity | The exact pattern to mirror for activities, scaled down (activities are inherently sparser — a city has dozens of real beaches at most, not hundreds) |
| `CATEGORIES` (`src/lib/categories.ts`) | 8 fixed strings (Sightseeing, History, Art & Culture, Spiritual, Food & Market, Nature, Neighbourhood, Architecture) | Sites already loosely cover "beach" (→ Nature) and "district" (→ Neighbourhood) by keyword, but as a *landmark*, not an *experience* — this plan adds a parallel taxonomy, not a replacement |
| `planItinerary` (`src/lib/itineraryPlanner.ts`) | `(sites: Site[], duration, pace) → TripDay[]`, needs only `lat/lng`, `duration_minutes`, and a few other `Site` fields per stop | If an activity is shaped like a `Site` by the time it reaches this function, **zero scheduler changes are needed** |
| `pickDefaultPlaces(sites, interests, duration)` (`src/lib/placeSelection.ts`) | Ranks by interest match + must-see, caps by trip length | Same story — works on anything shaped like a `Site[]` |
| `Plan.tsx` place-selection UI | One flat/per-leg grid of `PlaceCard`s built from `sites` state | Needs to render activities too, visually distinguished |
| `INTEREST_TAGS` (`src/lib/planFlow.ts`) | `= CATEGORIES` — same 8 tags used for the "any particular interests" step | Natural place to fold in activity types, so picking "Nightlife & Drinks" as an interest pulls matching activities in like any other interest |
| `netlify/functions/supabase-proxy.js` | Thin REST proxy: one `if (action === '...')` block per DB operation | Add `getActivities`/`upsertActivities`/`saveActivityMeta`, same shape as the `sites` ones |
| No migration tooling in this repo | Schema changes are run by hand in Supabase's SQL editor | Creating the `activities` table is a **manual, one-time step you run**, given to you as exact SQL in Phase 0 |

## Key design decisions

### 1. A real second table, not a `sites.kind` flag

You asked for this explicitly, and it's the right call: activities have fields sites don't need
(`is_area`, `area_name`), a different taxonomy, and a different generation cadence (sparser —
"batch of 2 per category" rather than sites' "batch of 2, 12 times"). Keeping them separate means
neither pipeline has to grow conditionals for the other's concerns.

```sql
create table activities (
  id text primary key,
  city_id text not null references cities(id),
  name text not null,
  activity_type text not null,
  description text,
  long_description text,
  tags text[],
  lat double precision not null,
  lng double precision not null,
  is_area boolean not null default false,
  area_name text,
  map_url text,
  image_url text,
  must_do boolean default false,
  duration_minutes integer,
  review_status text,
  source text
);
create index activities_city_id_idx on activities(city_id);
```
`is_area` + `area_name` is the field pair that makes "go out for a drink → Gemmayze" work: the
row's `lat`/`lng` is the district's centroid, `is_area = true`, `area_name = 'Gemmayze'`, so it's
still a schedulable point on the map even though it isn't one exact venue.

### 2. A parallel taxonomy: `ACTIVITY_TYPES`

New file `src/lib/activityTypes.ts` (mirrors `categories.ts`'s `CATEGORIES`/`CATEGORY_ACCENTS`):
```
"Beach & Swim", "Nightlife & Drinks", "Shopping", "Outdoor & Adventure",
"Food Experience", "Wellness & Relaxation", "Day Trip", "Live Entertainment"
```
8 types, same count as `CATEGORIES`, so it reuses the existing 4-color accent-cycling pattern and
slots into the same UI affordances (filter pills, interest pills) without inventing new visual
language.

### 3. Generation: mirror `ensureCitySites`, scaled down

`ensureCityActivities(cityId, cityName, countryId, countryName)` in a new `src/lib/activities.ts`:
cache-first (skip generation if enough cached rows exist), else one AI batch **per activity type**
(8 batches, not sites' 12 — no "hidden gem" repeat pass; a city realistically has few enough real
beaches/districts that doubling up on one type isn't needed), 2 items per batch, target ~16 total.
Dedup by name only — the 150m proximity check sites use makes less sense here, since two distinct
nightlife activities can legitimately centroid on the same district.

Prompt framing matters most here: ask for *experiences*, not places. "For Nightlife & Drinks, name
the actual bar district/street locals go out in (not a single bar) — set `is_area: true`,
`area_name` to that district's name, lat/lng to its centroid. For Beach & Swim, name real,
specific beaches — set `is_area: false` with that beach's exact coordinates."

### 4. Unify at the scheduler boundary, don't touch the scheduler

An `Activity` becomes a `Site`-shaped object the moment it's fetched — `category: activity.activity_type`,
`must_see: activity.must_do` — so `planItinerary`, `pickDefaultPlaces`, `PlaceCard`, and the map all
keep working completely unchanged. The only new thing both `Site` and `TripSlot` need is an
optional `kind?: "site" | "activity"` field purely for a UI badge — never read by any scheduling
logic. This is the same "wrap, don't rewrite" call that kept multi-destination low-risk.

### 5. Surfacing at trip-creation time

- **Place selection** (`Plan.tsx`): `loadSites` also calls `ensureCityActivities` per leg,
  in parallel with `ensureCitySites`; the combined pool renders in the same grid, each
  `PlaceCard` gets a small "ACTIVITY" badge when `kind === "activity"`.
- **Interests step**: `INTEREST_TAGS` becomes `[...CATEGORIES, ...ACTIVITY_TYPES]` (16 pills)
  so picking "Nightlife & Drinks" biases `pickDefaultPlaces` toward matching activities exactly
  like picking "History" already biases it toward matching sites — no new ranking logic needed.
- **Conversational agent**: not in v1. The gathering prompt (`buildGatherSystemPrompt`) stays
  about destinations/duration; teaching it to also extract activity intent from free text
  ("I want a beach day") is a real feature but a separate, riskier prompt change — call this out
  explicitly as future work, not bundled in here.

### 6. What's not in scope for v1

- Conversational activity-intent extraction (see above).
- Scheduling activities at a time-of-day-appropriate slot (nightlife in the evening, beach in the
  morning) — `planItinerary` has no time-of-day awareness for anything today; teaching it that is
  a scheduler change, not an activities change, and shouldn't ride along with this.
- A separate "Activities" tab/section on Trip Detail — v1 shows them inline in the itinerary like
  any other stop, badge and all.

## Execution phases

### Phase 0 — Schema + types (additive, zero behavior change)
- Give you the `create table activities` SQL above to run in Supabase's SQL editor (blocking —
  nothing in Phase 1 can persist without it).
- Add `Activity` type to `src/lib/types.ts`; add `kind?: "site" | "activity"` to `Site` and
  `TripSlot`.
- New `src/lib/activityTypes.ts`: `ACTIVITY_TYPES`, `ACTIVITY_TYPE_ACCENTS` (reuse the existing
  4-color cycle).
- **Tests**: none yet — pure types, nothing to assert.

### Phase 1 — Generation pipeline
- `netlify/functions/supabase-proxy.js`: add `getActivities`, `upsertActivities`,
  `saveActivityMeta` actions, identical shape to the `sites` ones.
- `src/lib/activities.ts`: `ensureCityActivities`, mirroring `ensureCitySites`/`generatePois` at
  smaller scale (8 batches × 2 items, name-only dedup, `TARGET_ACTIVITY_COUNT = 16`).
- **Tests**: dedup-by-name logic, batch-to-activity-type mapping — the same style of pure-function
  tests `sites.ts` doesn't have today (it's mostly network calls) but the small pure helpers
  (dedup, category assignment) are testable in isolation.
- Manual: run it once against a real city with the table created, confirm rows land in Supabase
  with sensible `is_area`/`area_name` values for nightlife/shopping and real coordinates for
  beaches.

### Phase 2 — Fetch integration (not surfaced in UI yet)
- `Plan.tsx`'s `loadSites` also fans `ensureCityActivities` out per leg, in parallel with
  `ensureCitySites`; normalize each `Activity` into a `Site`-shaped candidate with `kind:
  "activity"` before merging into the `sites` state array.
- **Tests**: the normalization function (`activityToCandidate` or similar) — pure, easy to test:
  correct field mapping, `is_area` centroid passthrough, `kind` tag set correctly.
- Safe to ship alone: activities flow into scheduling and selection identically to sites already,
  just not visually distinguished yet.

### Phase 3 — Place-selection & interests UI
- `INTEREST_TAGS` extended with `ACTIVITY_TYPES`.
- `PlaceCard` shows a small badge/accent when `kind === "activity"`.
- **Tests**: none new — this is presentation only, on top of already-tested selection logic.
- Manual: build a trip in a city with generated activities, confirm activity cards appear in
  place-selection, confirm picking an activity-type interest actually biases the default
  selection toward matching activities.

### Phase 4 — Itinerary / Trip Detail display
- Itinerary rows (`ItinerarySlotRow` in `TripDetail.tsx`) show the same badge for activity-sourced
  stops.
- Swap panel alternatives list also shows the badge (it already pulls from the same per-city
  candidate pool once Phase 2 lands, if `SwapPanel`'s `getSites` call is extended to also fetch
  activities — call this out explicitly as a needed change, easy to miss).
- Manual: swap a stop for an activity, confirm it displays correctly end to end (card, itinerary
  row, map pin).

### Phase 5 — Docs
- `NOTES.md` entry; README "Trip data model" section gets an activities paragraph.

## Manual QA checklist (run at Phase 1 and again at Phase 4)

1. Generate activities for a coastal city (e.g. Beirut, Barcelona) — Beach & Swim entries should
   be real, specific, distinct beaches with `is_area: false`.
2. Same city — Nightlife & Drinks entries should be real districts/streets, `is_area: true`,
   sensible `area_name`, centroid coordinates that land within the city.
3. A landlocked city (e.g. Amman) — Beach & Swim should either come back empty/sparse or
   reasonably redirect to a nearby option (e.g. Dead Sea) rather than inventing a beach that
   doesn't exist. Watch for hallucination here specifically.
4. Build a trip picking "Nightlife & Drinks" as an interest — confirm at least one activity makes
   it into the built itinerary, scheduled sensibly (not obviously colliding with the day's other
   stops on the map).
5. Regression: a trip built with **no** activity interests picked still looks and behaves exactly
   as it did before this feature (sites-only, no badges shown).

## Risks & things to decide before starting

- **Hallucination risk is higher than for sites**: "name a nightlife district" invites more
  invention than "name a museum" for cities the model knows less well. Worth an explicit prompt
  instruction to admit sparsity rather than invent (mirrors item 3 in the QA checklist).
- **Cost**: another 8 batches of AI calls per cold city, on top of sites' 12 — a first-time visit
  to a city now costs ~1.7x the generation calls. Acceptable for v1, worth watching in analytics
  the same way multi-destination's leg-count cost was flagged.
- **Open question**: should `must_do` activities (the equivalent of `must_see`) ever *force* an
  activity into the default selection the way must-see sites do today? Proposal: yes, same
  precedent, no reason to treat it differently.
- **Open question**: area-based activities on the map show as a single pin at a centroid — is that
  good enough for v1, or does a district deserve a different marker treatment (an area outline)?
  Proposal: single pin for v1, a marker-treatment upgrade is easy to layer on later without a data
  model change.
