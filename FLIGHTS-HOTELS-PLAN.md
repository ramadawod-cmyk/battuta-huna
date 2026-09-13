# Flights & Hotels — Search, Compare, Book Elsewhere — Scoping & Execution Plan

Status: **scoped, not started**. Same format and rules as `MULTI-DESTINATION-PLAN.md` and
`ACTIVITIES-PLAN.md`: each phase is independently shippable and leaves the app working; execute in
order, verify (tests + manual check) before moving on.

## Goal

Add two more things Battuta can help with after building an itinerary: **getting there** (flights)
and **where to stay** (hotels). Both are *search & compare only* — real prices shown in our UI, the
actual booking and payment happen on a third party's site, and we earn affiliate revenue. No
booking, payment, or reservation record ever passes through this app's code or database.

## What was verified before writing this (September 2026)

This section exists because the obvious options mostly turned out to be closed, and the plan only
makes sense against what's actually accessible to a pre-launch app with no traffic history.

| Option | Status | Why it matters |
|---|---|---|
| Booking.com Demand API | **Gated** — signed contract + Account Manager approval since Jul 2026; usage terms on price comparison are contradictory | Out for v1 |
| Amadeus self-service | **Discontinued** Jul 2026 (Enterprise-only now) | Out |
| Kiwi/Tequila, Expedia Rapid | Partner-approval only | Out |
| Duffel (flights) | Self-serve, real bookings — but it *is* a booking API; you'd be the one taking the booking | Wrong shape for "book elsewhere" |
| Travelpayouts **real-time** Flight Search API | **Gated: 50,000 monthly active users** + application + conversion minimums | Out |
| Travelpayouts / Aviasales **Data API** (cached prices, ~48h fresh) | **Open** to any registered partner, token only, no volume gate, server-side only | ✅ Flights price data |
| Aviasales affiliate deep links | Plain URL + your `marker`, no API needed | ✅ Flights "book" primitive |
| Travelpayouts White Label (flights) | Hosted real-time search on a subdomain or as an embedded widget, 30% share of their reward, no gate | Alternative UI, see decision 3 |
| Travelpayouts hotel data (Hotellook) | **Shut down** (Oct 2025); "no other hotel brand offers an API to partners" | No hotel *data* via Travelpayouts |
| Travelpayouts hotel affiliate links/widgets (Booking.com 4%, Agoda, Expedia, Hotels.com…) | Open; links only, no price data | Fallback only |
| LiteAPI (Nuitée) hotel search/rates API | **Open, self-serve, free sandbox**, core rates/prebook/book endpoints free under fair look-to-book; places lookups $0.01/req | ✅ Hotels price data |
| LiteAPI **Whitelabel Booking Site** | Hosted on `yourbrand.liteapi.travel` or a custom domain. **Nuitée handles guest payment and post-booking support**; you set your own margin; weekly payouts after checkout; deep-linkable by plain URL | ✅ Hotels "book" primitive |

Sources are in the commit that introduced this doc; the load-bearing ones are Travelpayouts'
"Requirements for Aviasales Flight Search API access", "FAQ on the closure of Hotellook",
LiteAPI's "Whitelabel Booking Site", "Deeplinking to Whitelabel", "API Pricing & Usage Costs" and
"Revenue Management and Commission" pages.

## Key design decisions

### 1. Flights = Aviasales Data API for numbers, affiliate deep link for the click

The Data API is a **cache of recent searches, not live availability**: `prices_for_dates` returns
the cheapest recently-seen fares for a route and date (or whole month), with airline, departure
time, transfers, duration, a per-adult economy price, an `expires_at`, and a ready-made
`booking_link` into Aviasales carrying our `marker`. That is exactly enough for a "flights from
~$X, direct options from ~$Y, cheaper on the 14th" comparison panel — and honest about what it is
("recent prices", not "book this seat").

The click always goes to an Aviasales search page with the route/dates/passengers prefilled and
our marker attached. If the cache is empty for a route (common for thin MENA routes — an empty
result means *no recent searches*, not *no flights*), we still show the CTA as a plain deep link
built from IATA codes + `DDMM` dates. **The flights panel is never a dead end.**

Everything talking to the Data API runs in a Netlify function: the token is passed unencrypted, so
browser calls are explicitly forbidden by their terms.

### 2. Hotels = LiteAPI rates API for numbers, LiteAPI Whitelabel for the click

LiteAPI's search returns real rates for real rooms. Rather than build any booking step, the
"Book now" on a hotel card deep-links into **our LiteAPI Whitelabel site** — a plain URL,
`https://<wl-domain>/hotels/{hotelId}?checkin&checkout&occupancies` (or `/booking?offerId=` to land
on the exact rate we showed). Nuitée is the merchant of record, collects payment, and provides
post-booking guest support; we configure a default margin once in their dashboard and it applies to
whitelabel bookings automatically.

Nuance to be aware of: the whitelabel carries *your* logo and (optionally) domain, so from the
guest's point of view they're booking "with Battuta" even though Nuitée runs the transaction.
That satisfies "I don't want bookings to go through me" operationally (no payment, no PCI, no
support queue on our side) — read Nuitée's partner terms once to confirm you're comfortable with
the branding/liability split. If you'd rather it be visibly a third-party OTA, the fallback in
decision 4 is available at any time with a one-line switch.

### 3. Build our own UI (not the Travelpayouts White Label)

The White Label widget would give *live* flight search on-page with zero API work, but it's their
UI, their CNAME on your domain, and 30% of *their* reward rather than the full affiliate rate. It
doesn't fit the rest of the app (every other surface is our own cards). Decision: our UI on the Data
API for v1; revisit the widget only if the cached-price panel underperforms in click-through.

### 4. Fallback for hotels when LiteAPI has nothing: a Viator-style affiliate link

For a city/date range where LiteAPI returns no rates (or the call fails), show a single
"Find hotels in {city}" button that deep-links to a Travelpayouts-networked OTA (Booking.com or
Agoda — see open questions) with dates prefilled. Same "never a dead end" rule as flights.

### 5. No schema changes, no new tables

Everything needed already exists on a saved trip: destinations (`tripDestinations`), a `dates`
label we generate ourselves (`"Sep 13 – Sep 16, 2026"` or `"September 2026 (flexible)"` — see
`PlanDatePicker`), `duration`, `group_type`, and per-leg day ranges (`legsFromDays`). Flights and
hotels are fetched live per page view (their caches, not ours) — nothing to persist. `dates` is
parsed back to ISO by a small pure helper; a "flexible month" maps onto the Data API's month
granularity naturally. If trips later store ISO dates, the helper becomes a no-op.

### 6. Origin airport for flights

The itinerary flow never asks where the traveller is flying *from*. v1 default: the detected
current city (`CityContext`, already cached in `localStorage`) resolved to an IATA city code via
the Data API's cities reference dataset; editable inline in the flights panel (a city text input
that resolves to a code). No new question in the Plan chat. Passenger count derives from
`group_type` (Solo 1, Couple 2, Family 2 adults, Friends 2) and only affects the deep link — the
Data API prices are always per adult.

### 7. Multi-destination trips

Flights: origin → first destination, and last destination → origin (an open-jaw pair shown as two
one-ways). Inter-leg flights (Rome → Florence) are **out of scope** for v1. Hotels: one "Where to
stay" block per leg, dates derived from that leg's day range + the trip start date.

### 8. Secrets and config

- `TRAVELPAYOUTS_TOKEN` — server-only (Netlify function).
- `VITE_TRAVELPAYOUTS_MARKER` — public, appears in links (same treatment as `VITE_VIATOR_PID`).
- `LITEAPI_KEY` — server-only; sandbox key locally, production key on Netlify.
- `VITE_LITEAPI_WHITELABEL_DOMAIN` — public, the whitelabel host the "Book now" links point at.

All four go on **both** Netlify sites (staging and production) — see `NOTES.md` on the two-sites
gotcha. `.env.example` and `src/vite-env.d.ts` get the new entries.

## Execution phases

### Phase 0 — Accounts, keys, pure helpers (zero behavior change)

**You (can't be done from the codebase):**
1. Travelpayouts: create a project for battutahuna.com → note the **API token** (Profile → API
   token) and the **marker** (partner ID). Since April 2026 projects auto-connect to relevant
   programs; confirm Aviasales (and WayAway, see open questions) show as connected.
2. LiteAPI: create an account → note the **sandbox** and **production** API keys → create a
   **Whitelabel site** (start on `<brand>.liteapi.travel`; custom domain later) → set a **default
   margin** in the Commission section → note the whitelabel domain.
3. Netlify (both sites): add the four env vars from decision 8.

**Me:**
- `src/lib/tripDates.ts`: `parseTripDates(label) → { start: ISO, end: ISO } | { month: "YYYY-MM" } | null`,
  plus `legDateRange(trip, leg)` for per-leg hotel check-in/out. **Tests**: both label formats,
  year rollover (Dec → Jan), a leg's range from day numbers, garbage input → null.
- `src/lib/travelParty.ts`: `passengersForGroupType()`. **Tests**: the four group types + unknown.
- `.env.example`, `vite-env.d.ts` entries. Nothing calls any of this yet.

### Phase 1 — Flights data (not surfaced yet)
- `netlify/functions/flights-proxy.js`: actions `resolveCity` (city name → IATA via the cities
  reference dataset, cached in module scope across warm invocations) and `pricesForDates`
  (v3 `prices_for_dates`, passing `currency`, `market`, `direct`, `sorting`, `limit`). Token only
  ever lives here. Mirrors `supabase-proxy.js`'s one-action-per-block shape.
- `src/lib/flights.ts`: typed client for those two actions; `buildAviasalesDeepLink({origin,
  destination, depart, return?, adults, marker})` as a **pure function**; `summarizeFares()`
  (cheapest overall, cheapest direct, cheapest nearby date) as a **pure function**.
- **Tests**: deep-link formatting (DDMM zero-padding, one-way vs return, passenger digit, marker
  present/absent), `summarizeFares` on fixture data incl. empty input.
- Manual: hit the function for DXB→BEY, RUH→AMM, and a thin route; confirm `booking_link` opens
  Aviasales with our marker visible in the URL; confirm an empty-cache route still yields a
  constructed deep link. Watch the `market` parameter — the cache differs per market and defaults
  to `ru`; pick the one with the best MENA coverage empirically.

### Phase 2 — Flights UI on Trip Detail
- New "Getting there" section on `TripDetail` (above the Itinerary/Travel Guide tabs, or as a
  third tab — decide in Figma first if you want a design pass, otherwise a simple section): origin
  chip (auto-filled, editable), 2–3 fare cards (cheapest / direct / cheaper date), a
  "recent prices, not live" caption, and a single "See flights on Aviasales" CTA that uses the
  API's `booking_link` when present, else the constructed deep link.
- Loading / empty / error states; `track("Flight Link Clicked", …)` mirroring the Viator event.
- Manual: single-city trip, two-leg trip (open-jaw pair), flexible-month trip, and a trip whose
  origin can't be resolved (input stays editable, CTA still works). Mobile widths.

### Phase 3 — Hotels data (not surfaced yet)
- `netlify/functions/hotels-proxy.js`: `searchRates` (LiteAPI rates search by the leg city's
  coordinates + radius, check-in/out, occupancy; sandbox key locally) and `hotelDetails` (names,
  stars, images for the cards). Must return inside Netlify's 10s function cap — use a small
  `limit`, and measure.
- `src/lib/hotels.ts`: typed client; `buildWhitelabelHotelUrl({domain, hotelId, checkin, checkout,
  occupancies})` and `buildOtaFallbackUrl({city, checkin, checkout, marker})` as pure functions;
  `encodeOccupancies()` (LiteAPI expects a base64 rooms/guests blob — pin the exact format in the
  sandbox and lock it with a test).
- **Tests**: both URL builders, occupancy encoding, per-leg date derivation feeding check-in/out.
- Manual: sandbox search for Beirut and Amman on real dates; then one production search; confirm
  the whitelabel hotel URL lands on the right hotel with dates prefilled and the margin shows in
  the price.

### Phase 4 — Hotels UI on Trip Detail
- "Where to stay" block per leg: 3–4 hotel cards (image, name, stars, from-price/night), each with
  "Book now" → whitelabel link. Empty/error → the OTA fallback button. `track("Hotel Link
  Clicked", …)`.
- Manual: old single-city trip, new multi-leg trip (two blocks, correct per-leg dates), flexible-
  month trip (no exact dates → show the fallback button only, with a "pick dates to see prices"
  nudge), mobile widths.

### Phase 5 — Docs and measurement
- `NOTES.md` entry (what was gated and why the shape is what it is — future-you will otherwise
  re-research this), README "Trip data model" addendum, analytics sanity-check that the two new
  click events flow through.

## Not in scope for v1 (say it now so it doesn't creep in)
- Any booking, payment, or reservation handling in this app.
- Inter-leg flights, multi-city flight itineraries, price alerts, seat/cabin selection.
- Live flight availability (would need the gated Search API or the White Label widget).
- Hotel filters beyond stars/price, hotel map view, reviews.
- Asking for the departure city inside the Plan chat (inline edit in the panel is enough for v1).

## Risks & open questions

- **Cache coverage on MENA routes.** The Data API only knows routes people recently searched on
  Aviasales, and coverage varies by `market`. If DXB→BEY-class routes come back empty too often,
  the panel degrades to CTA-only (still fine) but the "compare" value is lost — this is the main
  thing Phase 1's manual check exists to measure before any UI is built.
- **Brand: Aviasales vs WayAway.** Same network, same marker, same Data API. Aviasales' default
  market is Russia; WayAway is Travelpayouts' international-facing flight brand with its own deep
  links. For a MENA-first product the landing brand matters for trust. Open question — decide
  before Phase 2 (it's one URL template).
- **Whitelabel branding/liability.** See decision 2. Open question: are you comfortable with
  "Battuta"-branded checkout run by Nuitée, or do you want the visibly-third-party OTA fallback as
  the *primary* hotel CTA (losing price comparison)?
- **Hotel fallback OTA.** Booking.com (4%) vs Agoda (stronger in price-sensitive/Asian markets)
  via Travelpayouts. Open question; trivially switchable.
- **Currency.** Show USD everywhere, or per-destination? Both APIs take a currency parameter.
  Proposal: USD for v1.
- **Netlify 10s cap on hotel search.** Measured in Phase 3 before UI work; mitigations are a
  smaller radius/limit, or a two-step (ids first, details after).
- **Cost.** Travelpayouts Data API: free. LiteAPI: rates/details free under fair use; only
  `places` ($0.01) and price-index ($0.05) endpoints cost money — the plan avoids both (we search
  by coordinates we already have). Netlify function invocations scale with Trip Detail views.

## Manual QA checklist (run at Phase 2 and Phase 4)

1. Single-city trip with exact dates → flights panel shows fares + CTA; hotels block shows cards;
   both links open with marker / whitelabel domain visible in the URL.
2. Two-leg trip → two one-way flight cards (origin→first, last→origin); two hotel blocks with
   per-leg dates that add up to the trip.
3. Flexible-month trip → flights use month granularity; hotels show fallback + "pick dates" nudge.
4. Thin route / small city → flights CTA still present (constructed link); hotels fallback button.
5. Origin unresolvable (odd current-city name) → editable origin, CTA works after typing a city.
6. Old trips created before this feature render both sections without errors.
7. Every external link opens in a new tab with `noopener,noreferrer`; no API token appears in any
   client bundle (`grep` the built JS for the token string — must be zero hits).
