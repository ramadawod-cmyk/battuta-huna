# Multi-Destination Trips — Scoping & Execution Plan

Status: **scoped, not started**. Each phase below is independently shippable and leaves the
app working; execute them in order, one at a time, verifying (tests + manual check) before
moving on.

## Goal

The conversational planner ("Battuta") currently does one thing: extract a single city and a
duration, in at most 2 questions. It should instead:

1. **Suggest destinations** when the traveller is vague ("somewhere relaxing in Southeast Asia
   for a week") — propose concrete options, let them pick.
2. **Understand a country** ("I want to see Jordan") by proposing the right city or cities to
   base the trip in.
3. **Support multi-city and multi-country trips** ("Rome and Florence", "Jordan then Egypt"),
   and actually build the itinerary across all of them — not just talk about it.
4. **Always know today's date**, so "next month", "this winter", "over Eid" mean something.

## What exists today (the constraints we're working within)

| Piece | Today | Why it matters |
|---|---|---|
| `GATHER_SYSTEM_PROMPT` (`src/lib/planFlow.ts`) | Single city + duration, ≤2 questions, emits `[PARTIAL]{city,country,country_id,dates,duration}[/PARTIAL]` | The only AI turn in the conversation; everything after is scripted UI |
| `PlanPartial` / `parsePartial` | Single `{city, country, country_id}` | Every downstream step reads `partial.city` |
| `Plan.tsx` flow | city → dates (calendar) → followup notes → party → interests → pace → browse/auto → build | `loadSites` fires once for the one city right after the city step |
| `ensureCitySites` (`src/lib/sites.ts`) | Per **one** city: cache-first, else AI-generates ~24 POIs in 12 parallel batches | Each batch is its own Netlify function call (10s hard cap) |
| `planItinerary` (`src/lib/itineraryPlanner.ts`) | Deterministic scheduler: `(sites, duration, pace) → TripDay[]` for one city | Pure function — easy to wrap for multiple legs |
| `Trip` type / `trips` table | `city: string` column; `days: TripDay[]` is a **JSON column**; `TripSlot` has no city | JSON `days` means we can add per-day city info with **no migration** |
| `TripDetail.tsx` | Hero = `trip.city`; itinerary is a flat day list; Travel Guide = tips for `slugify(trip.city)`; `SwapPanel`/`SiteDetailModal` take `cityId = slugify(trip.city)` | All single-city assumptions, but each is a small, local change |
| `TripMapBuilder.tsx` | Renders **one day at a time**, fits bounds to that day's slots | Already multi-city-safe — only the day tab labels need a city |
| `MyTrips.tsx` / `TripCard` / `CustomiseTrip.tsx` | Display `trip.city`; thumbnail via `useWikiThumbnail(trip.city)` | Need a "destinations label" instead of the raw city |
| `Explore` / `AllSites` | About the user's *current* city, not trips | **Unaffected** |

## Key design decisions

### 1. Data model: carry the city on each day, no schema change (recommended)

Add optional fields to `TripDay`:

```ts
export type TripDay = {
  day: number;
  label: string;
  slots: TripSlot[];
  city?: string;      // e.g. "Florence"   — new, optional
  cityId?: string;    // e.g. "florence"   — new, optional (slugify(city))
  country?: string;   // e.g. "Italy"      — new, optional
};
```

- `trips.city` (the DB column) keeps holding the **first** city. This keeps
  `useWikiThumbnail(trip.city)` (trip card + hero photo) and every existing single-city trip
  working untouched.
- A small helper derives the rest: `tripDestinations(trip): {city, cityId, country?}[]` —
  unique cities in day order from `days[].city`, falling back to `[{city: trip.city}]` when
  days carry no city (every trip created before this change).
- **Why not a `destinations` column?** It's cleaner on paper, but it needs a Supabase
  migration we can't run from the codebase, adds a second source of truth next to `days`,
  and nothing needs to *query* trips by destination yet. If that need appears, adding a
  JSONB column later is purely additive.

### 2. The `[PARTIAL]` contract becomes legs (backward compatible)

```json
[PARTIAL]{
  "legs": [
    {"city":"Rome","country":"Italy","country_id":"italy","days":3},
    {"city":"Florence","country":"Italy","country_id":"italy","days":2}
  ],
  "duration": 5,
  "dates": null
}[/PARTIAL]
```

`parsePartial` accepts **both** this and the old single-city shape (normalising the old one
into a one-leg `legs` array), so the prompt and the parser don't have to ship in the same
commit and old conversations in flight can't break anything.

Rules the parser enforces regardless of what the model says: every leg has a non-empty city
and a `days ≥ 1`; leg days sum to `duration` (if they don't, re-split proportionally);
cap legs at **4** (a 5-day trip across 5 cities isn't a trip we can schedule well).

### 3. Scheduling across legs: wrap, don't rewrite

`planMultiCityItinerary(legs: {sites, days, city, cityId, country}[], pace) → TripDay[]`:
run the existing `planItinerary(legSites, legDays, pace)` per leg, renumber days
consecutively, stamp each day with its leg's city. The proven single-city scheduler is
untouched.

Optional refinement (not v1): give the **first day of each non-first leg** a reduced time
budget (a "travel morning"), so the schedule doesn't assume you're sightseeing at 9am in a
city you haven't arrived in yet.

### 4. Day split between legs

The agent proposes the split (it's better at "Rome deserves more than Pisa" than a
formula). Fallback when it doesn't or can't: proportional even split, remainder to earlier
legs. The user can't yet edit the split in the UI — that's a follow-up.

### 5. The conversation

Replace the constant `GATHER_SYSTEM_PROMPT` with `buildGatherSystemPrompt(today: Date)`, so
the date is injected at call time. New rules, in spirit:

- **Persona/style unchanged**: warm, concise, 1-3 sentences, no markdown/emojis/em dashes.
- **Today is `{weekday, D Month YYYY}`.** Use it to interpret relative time ("next month",
  "this summer") and for seasonal advice; still don't ask for exact dates — the calendar
  handles that immediately after.
- **If the traveller names a city** (or cities): confirm and move on, as today.
- **If they name a country**: propose the best base city or two (e.g. Jordan → Amman +
  Wadi Musa for Petra), with one short reason each, and ask which they want — or accept an
  obvious single answer (a small country with one clear hub) without a round-trip.
- **If they're vague** ("somewhere relaxing", "good food, not too far"): suggest 2-3 concrete
  cities with a one-line reason each, then ask them to pick. Suggestions should respect what
  they said (budget, vibe, region, season given today's date).
- **Multiple cities/countries**: turn them into ordered legs with a sensible day split.
  Keep it to at most 4 legs; if they ask for more in a short trip, gently push back.
- **Duration**: still required; ask for it if missing, as today.
- Budget of questions rises from 2 to **about 4** — suggesting options costs a round-trip.
- End with the `[PARTIAL]` block only once city/cities *and* duration are settled.

The scripted follow-up that currently asks *"Will you only be exploring {city}, or are you
interested in nearby cities too?"* becomes redundant once the agent handles this; narrow
it to *"Anything specific you don't want to miss?"* (the notes still feed the day-title
prompt).

### 6. What the UI shows

- **Plan → place selection**: places grouped by city (a heading per leg, or leg tabs), each
  leg's default picks scaled to *that leg's* days (`pickDefaultPlaces(sites, interests,
  legDays)`).
- **Trip Detail**: hero title = destinations label ("Rome · Florence"); photo = first city;
  itinerary shows a city heading wherever the city changes between days; Travel Guide tab
  shows tips per leg (a tab or section per city — tips are already cached per city, so a
  2-city trip just calls `ensureCityTips` twice); `SwapPanel` and `SiteDetailModal` get the
  **day's** `cityId`, not the trip's.
- **My Trips card / Customise**: destinations label instead of `trip.city`.
- **Map**: day tab labels get the city ("Day 3 · Florence") — everything else already works.

## Execution phases

Each phase: implement → `npm test` (add the tests listed) → typecheck → manual check →
commit → push to staging. Later phases depend on earlier ones only where noted.

### Phase 0 — Types + helpers (additive, zero behaviour change)
- Add optional `city`/`cityId`/`country` to `TripDay`.
- Add `src/lib/trips.ts`: `tripDestinations(trip)`, `destinationsLabel(trip)`
  ("Rome · Florence"), `legsFromDays(days)` (groups consecutive days by city).
- **Tests**: old trips (no city on days) → single destination = `trip.city`; mixed days →
  correct unique ordered cities; label formatting.

### Phase 1 — Multi-leg scheduler (not wired yet)
- `planMultiCityItinerary` in `itineraryPlanner.ts` wrapping `planItinerary`; plus
  `splitDaysAcrossLegs(duration, legs)` (proportional fallback).
- **Tests**: day numbers consecutive across legs; every day carries the right city; per-leg
  day counts respected; split sums to duration and gives every leg ≥ 1 day; a leg with zero
  sites produces empty days rather than crashing.

### Phase 2 — Parser + partial shape (backward compatible)
- `PlanPartial` → `{ legs, duration, dates }` with a `legs` array; `parsePartial` normalises
  the legacy single-city shape; enforces the rules in decision 2.
- `Plan.tsx`: read `partial.legs[0]` wherever it read `partial.city` (**no** multi-city
  behaviour yet — this is a pure refactor to the new shape).
- **Tests**: legacy shape → one leg; new shape; legs not summing to duration → re-split;
  > 4 legs → truncated/re-split; malformed JSON → `null`.

### Phase 3 — The prompt
- `buildGatherSystemPrompt(today)` with the rules in decision 5; `Plan.tsx` passes
  `new Date()`. Narrow the "nearby cities" follow-up question.
- Verification is manual (it's an LLM): run through the scripted scenarios in the QA
  checklist below and confirm the `[PARTIAL]` block parses each time.
- Safe to ship alone: the parser already accepts legs; downstream still uses leg 0 until
  Phase 4.

### Phase 4 — Plan flow builds multi-leg trips
- `loadSites` → `ensureCitySites` per leg in parallel; sites tagged by leg.
- Place selection grouped by leg; default picks per leg.
- `buildTrip` → `planMultiCityItinerary`; day-title prompt gets each day's city; saved
  `days` carry city; `trips.city` = first leg's city.
- **Tests**: `pickDefaultPlaces` per-leg cap; the build assembles days in leg order.
- Manual: 2-city and 2-country trips end to end; confirm a single-city trip is byte-for-byte
  the same experience as before.

### Phase 5 — Trip Detail, cards, map, customise
- Hero label, per-leg city headings in the itinerary, per-leg Travel Guide, day-scoped
  `cityId` for swap/site modals, day tab labels on the map, card/customise labels.
- Manual: open an old single-city trip (must look identical), open a new multi-city trip.

### Phase 6 — Docs
- `NOTES.md` entry; README mention of the trip data shape.

## Risks & things to decide before starting

- **Cost/time of site generation** scales with legs: a 3-leg trip on cold cities = 3 × 12
  AI batches. Each batch is its own function call, so no single call gets slower, but the
  "gathering places" wait is longer and Anthropic spend triples. Acceptable for v1;
  worth watching in analytics (`Places Suggested` already logs count/duration).
- **Model reliability on the split**: legs may not sum to duration. The parser's re-split
  fallback makes this a non-issue functionally, but we should watch how often it triggers
  (add a `track` event).
- **"Country" ambiguity**: "Egypt" could mean Cairo, Luxor, or both. The prompt hands this to
  the model to propose; we should test a handful of countries and tune the prompt wording
  rather than hard-code city lists.
- **Not in scope for v1** (call these out so they don't creep in): editing the day split in
  the UI; travel time/transport between cities; per-leg dates; mixing an existing trip's
  legs after creation; Explore/AllSites (they're about the user's current location).
- **Open question**: max legs — 4 is a proposal. And whether the agent should be allowed to
  pre-fill `dates` when the user states them in chat ("Dec 20-27"), skipping the calendar.
  Proposal: not in v1; calendar stays the single source of dates.

## Manual QA checklist (run at Phase 3 and again at Phase 5)

Conversation scenarios — each must end in a parseable `[PARTIAL]` with sensible legs:
1. "Plan a 5-day trip to Amman" → one leg, 5 days, no suggestions offered.
2. "I want to see Jordan for a week" → proposes Amman (+ Wadi Musa), asks/decides, 7 days.
3. "Rome and Florence, 6 days" → two legs, split like 4/2 or 3/3.
4. "Somewhere warm and cheap in December for 10 days" → 2-3 suggestions using today's date
   for seasonality, then converges after the user picks.
5. "Jordan then Egypt, two weeks" → two countries, 2-3 legs, ≤ 4 legs total.
6. "Bali" → refuses region alone, proposes towns (existing rule still holds).
7. Vague + no duration → asks for duration before emitting the block.

App scenarios (Phase 5):
- An old single-city trip renders exactly as before (hero, tabs, swap, map, guide).
- A new 2-city trip: city headings appear between legs; swap suggests places from the
  right city; Travel Guide shows both cities; map day tabs show the city; card says
  "Rome · Florence".
