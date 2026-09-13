# Arabic Localization — Scoping & Execution Plan

Status: **scoped, not started**. Same format as the other `*-PLAN.md` docs — phases are
independently shippable, verify (tests + manual check) before moving on.

**Scope, as decided up front**: static UI (nav, buttons, labels, page copy) gets translated and the
whole layout mirrors to RTL. AI-generated content — site/activity descriptions, travel guide tips,
day titles, and the Battuta chat agent itself — **stays English for v1**. This is a real, visible
tradeoff worth restating: an Arabic-speaking user gets Arabic buttons and navigation around an
itinerary whose descriptions and travel guide are in English, and the planning chat still replies
in English even once the person's browsed the whole rest of the site in Arabic. Not hidden, not
accidental — full bilingual AI content is a large, separate follow-up (see "Not in scope").

This is meaningfully the largest single feature scoped in this repo's `*-PLAN.md` history — every
page has strings to extract, and RTL touches layout, not just text. Expect this to run across
several sessions, not one. Phases 0–1 are the foundation; Phases 2–6 are mechanical repetitions of
the same translate-and-flip pattern across the rest of the app, batched by page group so each is
independently reviewable and shippable.

## What exists today (constraints this works within)

| Piece | Today | Why it matters |
|---|---|---|
| `index.html` | `<html lang="en">`, no `dir` attribute | Where the language/direction toggle actually gets applied |
| Tailwind v4 | Already in use, has native `rtl:`/`ltr:` variants keyed off an ancestor's `dir` attribute | The mechanism for flipping layout — no new dependency needed for RTL itself |
| No existing i18n | Every string is hardcoded English JSX text across 15 pages, 16 components | The bulk of the work is mechanical: find every string, extract it, translate it |
| Literal `"← Back to ..."` text | 4 files, 7 occurrences (`TripDetail`, `TripMapBuilder`, `CustomiseTrip`, `BlogPost`) | A raw arrow character baked into a text string can't be flipped by CSS the way an icon can — needs a small direction-aware component |
| `PlanDatePicker`'s `ChevronIcon` | Already takes a `flip` boolean prop for its prev/next month chevrons | Existing precedent for direction-aware icons — the pattern to extend, not invent |
| `CityContext` (`src/lib/CityContext.tsx`) | Detects + persists city to `localStorage` (`bh_current_city`), same shape this needs for language | Direct template for a new `LanguageContext` |
| `PlanDatePicker`, `publicDateLabel` (`src/lib/tripSharing.ts`) | `toLocaleDateString("en-US", ...)` hardcoded | Needs a locale-aware variant, not a rewrite — `toLocaleDateString` already supports an `"ar"` locale argument |
| Battuta chat, `ensureCitySites`/`ensureCityActivities`/`ensureCityTips` prompts | All English, all out of scope per the decision above | Nothing here changes in this plan |

## Key design decisions

### 1. A lightweight custom i18n layer, not a library

`react-i18next` is the standard choice, but this app's own pattern throughout (`db()` instead of
the Supabase SDK, a hand-rolled `track()` instead of an analytics SDK wrapper) favors a small,
purpose-built solution over a general-purpose library for a bounded string count. New
`src/lib/i18n/`:
- `en.ts` / `ar.ts` — flat, namespaced dictionaries (`"sidebar.explore"`, `"plan.buildButton"`).
- `useTranslation()` — returns `t(key, vars?)` with simple `{placeholder}` interpolation
  (`t("plan.planningCity", { city })`), `language`, and `dir`.
- `LanguageProvider` (`LanguageContext.tsx`) — detects `navigator.language` on first visit,
  persists the choice to `localStorage` (`bh_language`, mirroring `bh_current_city`), and sets
  `document.documentElement.lang`/`dir` in an effect. Wraps the app once in `App.tsx`.
- A language switcher: an entry in `Settings`, plus a small toggle in `Sidebar`/`MobileHeader` for
  quick access (exact placement decided when Phase 1 touches those files).

### 2. RTL via Tailwind's native variants, not a mirrored stylesheet

Set `dir="rtl"` on `<html>` when Arabic is active; Tailwind v4's `rtl:`/`ltr:` variants key off
that automatically (`ml-4 rtl:ml-0 rtl:mr-4`). No separate RTL stylesheet, no CSS-in-JS direction
logic — every component that uses a directional utility (`ml-*`/`mr-*`, `pl-*`/`pr-*`, `left-*`/
`right-*`, `text-left`/`text-right`, asymmetric `rounded-*` corners like the chat bubbles' `rounded-
bl`/`rounded-br`) gets an `rtl:` counterpart added as it's translated, page by page.

### 3. Direction-aware icons, one small component

Extend `PlanDatePicker`'s existing `flip` prop pattern into a shared `<DirectionIcon>` (or extend
lucide icons directly with `className="rtl:scale-x-[-1]"` where a single flip suffices — decide
per-icon in Phase 1). The 7 literal `"← Back to ..."` strings become
`<BackLink to={...} labelKey="..." />`, rendering an actual (flippable) chevron plus a translated
label, instead of a Unicode arrow baked into text.

### 4. Numerals stay Western (0–9), calendar stays Gregorian

Two decisions made now rather than left ambiguous mid-implementation:
- **Numerals**: Western Arabic numerals (`0–9`), not Eastern Arabic-Indic (`٠–٩`) — the more common
  convention on Gulf-region travel/tech products and universally read by every Arabic-speaking
  market, avoiding a second regional-variant decision.
- **Calendar**: Gregorian, with Arabic month/day names via `toLocaleDateString("ar", ...)` — not a
  Hijri calendar. Travel booking dates are Gregorian everywhere regardless of UI language; Hijri
  display is a distinct, separately-scoped feature if ever wanted.

### 5. No URL-based language routing in v1

Language is a client-side toggle (`localStorage`, no `/ar/...` path prefix or subdomain). Simpler,
ships faster, but means Arabic content isn't independently indexable by Google and a shared link
doesn't carry language context (a shared trip link, or the site itself, always opens in whatever
language the *recipient's* browser/stored preference resolves to). Given the organic/SEO-leaning
growth strategy, proper URL-based i18n (`/ar/plan`, etc.) is a real, valuable follow-up once the
base translation exists — deliberately deferred so this doesn't block on a routing redesign.

### 6. Not in scope for v1

- Any AI-generated content in Arabic (site/activity descriptions, travel guide, day titles, the
  chat agent's replies) — see the framing at the top of this document.
- Hijri calendar, Eastern Arabic-Indic numerals.
- URL-based language routing (`/ar/...`) — see decision 5.
- Per-account persisted language preference (server-side) — `localStorage` only, matching how
  `bh_current_city` already works for guests and logged-in users alike.
- Right-to-left support for any third-party embedded content (none currently exists).

## Execution phases

Each phase: translate the page/component group's strings into `en.ts`/`ar.ts`, replace hardcoded
text with `t()` calls, add `rtl:` variants to every directional class touched, manual QA in both
languages before moving on.

### Phase 0 — i18n infrastructure (foundation, not yet visible)
- `src/lib/i18n/en.ts`, `ar.ts`, `useTranslation.ts`, `LanguageContext.tsx`.
- Wire `LanguageProvider` into `App.tsx`; set `lang`/`dir` on `<html>` reactively.
- Language switcher in `Settings`.
- **Tests**: `t()` interpolation (placeholder substitution, missing-key fallback to the key
  itself rather than throwing), language detection logic (a pure function taking
  `navigator.language` and returning `"en" | "ar"`).
- Manual: switch language in Settings, confirm `<html dir>` flips, confirm the choice survives a
  reload (localStorage).

### Phase 1 — RTL foundation: Layout, Sidebar, direction-aware icons
- Translate + RTL-fix `Layout.tsx`, `Sidebar.tsx` (desktop sidebar + mobile header) — the two
  components present on every page, so this is the highest-leverage single phase.
- Build the shared back-link/chevron pattern from decision 3; migrate all 7 literal arrow strings
  to it.
- **Manual**: full RTL sanity pass on the sidebar/nav alone — this is where most real RTL bugs
  (flexbox order, icon flipping, spacing) will surface first, before repeating the pattern
  everywhere else.

### Phase 2 — Landing, Auth
First-touch pages; small string count, good second RTL rep before the bigger pages.

### Phase 3 — Plan flow (`Plan.tsx`)
The single largest page in terms of strings (every chat prompt's UI chrome, all the step
questions' static wrapper text — not the AI's own replies, which stay English per scope — button
labels, placeholders, mode-choice copy). Flag explicitly during manual QA: the chat surface will
visibly mix Arabic UI chrome with English AI replies — confirm that reads as acceptable rather
than broken before shipping this phase.

### Phase 4 — Explore, AllSites, SiteDetailModal, PoiCard, TagPill
Category names (`CATEGORIES`, `ACTIVITY_TYPES`) get Arabic display labels here too — the
underlying English strings stay as-is everywhere they're used as data keys (Supabase category
values, `normalizeCategory` matching, analytics); only what's *rendered* to the user changes.

### Phase 5 — Trip pages (`TripDetail`, `TripContent`, `TripMapBuilder`, `CustomiseTrip`,
`SwapPanel`, `SharedTrip`)
Largest single group after Plan. Note `SharedTrip` specifically: a stranger opening a share link
should see the page in *their* detected/stored language, independent of the language the trip's
owner used — confirm this during manual QA, don't assume it inherits anything from the owner.

### Phase 6 — MyTrips, remaining pages (`About`, `Blog`, `BlogPost`), docs
Closes out the remaining pages, then `NOTES.md` entry + README addendum covering the i18n
conventions (key naming, where to add a new string, the RTL variant pattern) so future features
don't accidentally ship English-only.

## Manual QA checklist (run after every phase, not just at the end)

1. Toggle to Arabic → the whole page mirrors (not just text: flex/grid order, icon direction,
   text alignment) with no leftover LTR-only spacing that now reads backwards.
2. Toggle back to English → nothing about the English experience changed from before this project
   started (a real regression risk once directional classes start growing `rtl:` siblings).
3. Every icon that implies direction (chevrons, the back arrow, carousel arrows) points the
   correct way in RTL.
4. No raw English string leaks into the Arabic UI (a missed `t()` call) and vice versa.
5. Numbers and dates render in Western numerals / Gregorian-with-Arabic-month-names as decided,
   not Eastern Arabic-Indic or a mixed muddle.
6. Mobile width in both languages, both directions.
7. A fresh visitor with an Arabic browser locale lands in Arabic automatically; an existing
   visitor's manually-chosen language survives a reload and doesn't get silently overridden by
   detection on a later visit.

## Risks & open questions

- **Scale of the mechanical work.** Realistically 150–300+ distinct strings across the app plus a
  directional-class audit on every page that has one. This is the actual bottleneck, not any
  single hard technical problem — budget the time accordingly rather than expecting a fast pass.
- **Mixed-language chat UX (Phase 3).** Explicitly flagged above — worth a real look with fresh
  eyes once it's in front of you, not just assumed fine because it was decided in the abstract.
- **RTL regressions in components not yet touched.** Because this ships phase by phase, a shared
  component fixed for RTL in an earlier phase could still be used un-fixed in a later page before
  its own phase lands — the QA checklist's item 2 (English regression check) partially covers
  this, but watch for it specifically when a component appears in multiple phases.
- **Open question**: should Arabic ever be auto-selected by *detected city* (MENA IP → Arabic)
  rather than only by browser language? Proposal: browser language only for v1 — simpler, and a
  MENA-based user with an English-set browser very plausibly wants the English UI anyway.
- **Open question**: once this ships, is full bilingual AI content (the explicitly-deferred
  follow-up) actually worth prioritizing next, or does UI-only satisfy the real need? Worth
  revisiting with real usage data once this is live rather than deciding now.
