# Arabic Localization — Scoping & Execution Plan

Status: **scoped, not started**. Same format as the other `*-PLAN.md` docs — phases are
independently shippable, verify (tests + manual check) before moving on.

**Full scope, as decided**: static UI (nav, buttons, labels, page copy) translated with a full RTL
layout mirror, **and** AI-generated content — site/activity descriptions, travel guide tips, day
titles — stored bilingually, **and** the Battuta chat itself converses natively in Arabic when the
UI language is Arabic. Nothing about the AI-driven experience stays English-only. This is
meaningfully the largest feature scoped in this repo's `*-PLAN.md` history: it's simultaneously a
full i18n/RTL project (mechanical, wide) and a content-generation redesign (every AI prompt in the
app gets a language dimension) and a data-model change (every content table needs an Arabic
column). Expect this across several sessions.

### The approved Arabic voice

Locked in with real examples before any content generation starts (see commit history for the
calibration round — worth reading if the tone ever needs re-deriving): **Modern Standard Arabic,
not colloquial/dialectal** (no Levantine/Gulf/Egyptian colloquialisms — pan-Arab, everyone should
read it as "proper" without it being stiff), **warm and direct, not bureaucratic** (second person,
natural rhythm, avoid the heavy formal register of news broadcasts or government documents), **a
little descriptive color, not travel-brochure purple prose** ("تنبض بالحياة" yes, exclamation-point
enthusiasm no). This single description is the source of truth — every generation prompt that
produces Arabic text references it, so the voice can't drift call-site to call-site. See decision
7 for where it actually lives in code.

## What exists today (constraints this works within)

| Piece | Today | Why it matters |
|---|---|---|
| `index.html` | `<html lang="en">`, no `dir` attribute | Where the language/direction toggle gets applied |
| Tailwind v4 | Already in use, native `rtl:`/`ltr:` variants keyed off an ancestor's `dir` | The mechanism for flipping layout — no new dependency for RTL itself |
| No existing i18n | Every UI string is hardcoded English JSX text across 15 pages, 16 components | The UI side is mechanical: find every string, extract it, translate it |
| Literal `"← Back to ..."` text | 4 files, 7 occurrences | A raw arrow character in a string can't be flipped by CSS the way an icon can |
| `PlanDatePicker`'s `ChevronIcon` | Already takes a `flip` boolean prop | Existing precedent for direction-aware icons |
| `CityContext` | Detects + persists to `localStorage` (`bh_current_city`) | Direct template for a new `LanguageContext` |
| `sites` table | `name, description, long_description` — English only | Needs `name_ar, description_ar, long_description_ar` |
| `activities` table | `name, description` — English only | Needs `name_ar, description_ar` |
| `cities.tips` (JSONB) | Flat keys per category, English values | No column change needed — just also write `{key}_ar` keys into the same JSON object |
| `generatePoiBatch`/`generateActivityBatch`/`generateTipCategory` | One AI call per batch, English-only JSON schema | Each gets `_ar` fields added to its existing JSON schema — **one call still produces both languages**, not two calls |
| `TripDay`/`TripSlot` (saved trip JSON) | Snapshots `name`/`description`/`category`/day `label` at build time, English only | Needs bilingual fields too, or an already-built trip (and any `/shared` link to it) can't render in Arabic regardless of the viewer's language |
| `buildGatherSystemPrompt`/`buildDayLabelsSystemPrompt` (`planFlow.ts`) | English-only prompts; the `[PARTIAL]` JSON block's `city`/`country` fields are read by `slugify()` and used as Supabase keys | The chat's *visible reply* becomes language-aware; the `[PARTIAL]` block's machine-readable fields **stay English** regardless — they're internal keys, never shown to the user, and everything downstream (site lookups, cityId generation) depends on them being stable |
| Existing cached content (many cities already generated this session — Amman, Beirut, Rome, Florence, etc.) | English only, already at/above the "enough cached" threshold | Won't get Arabic fields from the normal top-up path (`ensureCitySites` only generates more when a city is *under* its target count) — needs an explicit backfill pass, same shape as `backfillSiteMeta` |

## Key design decisions

### 1. A lightweight custom i18n layer for UI strings, not a library

Matches this app's existing preference for purpose-built solutions over general libraries (`db()`
instead of the Supabase SDK, a hand-rolled `track()`). New `src/lib/i18n/`: `en.ts`/`ar.ts` flat
namespaced dictionaries, `useTranslation()` returning `t(key, vars?)` with `{placeholder}`
interpolation, `LanguageProvider` detecting `navigator.language` and persisting to `localStorage`
(`bh_language`), setting `document.documentElement.lang`/`dir` reactively. A switcher in `Settings`
plus a quick-access toggle in `Sidebar`/`MobileHeader`.

### 2. RTL via Tailwind's native variants — logical utilities first, `rtl:` variant as fallback

`dir="rtl"` on `<html>` when Arabic is active. **Refined during Phase 1**: two mechanisms handle
almost everything, in this preference order:
1. **CSS flexbox's `row` direction is itself direction-aware** — a plain `flex`/`inline-flex`
   container's children reorder automatically under `dir="rtl"`, with zero extra classes. Confirmed
   live in Phase 1: the sidebar (a `flex` row: aside + main) flips to the right edge on its own.
2. **Tailwind's logical property utilities** (`ps-*`/`pe-*`, `ms-*`/`me-*`, `border-s`/`border-e`,
   `start-*`/`end-*`, `rounded-ss`/`rounded-ee` etc.) flip automatically based on `dir`, with no
   `rtl:` variant needed at all — swap the physical utility for its logical equivalent once,
   forever correct in both directions. Used for the sidebar's border (`border-r` → `border-e`).

Only fall back to an explicit `rtl:`/`ltr:` variant for things logical properties don't cover —
mainly a literal visual mirror like an icon (`rtl:scale-x-[-1]`, as `BackLink`'s chevron does) or
`text-left`/`text-right` where the intent is genuinely physical, not flow-relative. **Note**:
Tailwind v4's `scale-*` utilities emit a CSS `scale` property, not `transform` — check `.scale` in
DevTools/tests, not `.transform`, when verifying a flip.

### 3. Direction-aware icons, one small component

The 7 literal `"← Back to ..."` strings become a `<BackLink>` rendering a flippable chevron plus a
translated label. Other directional icons (carousel arrows, etc.) get `rtl:scale-x-[-1]` where a
straight flip is correct — decided per-icon in Phase 1.

### 4. Numerals stay Western, calendar stays Gregorian

Western Arabic numerals (`0–9`), not Eastern Arabic-Indic (`٠–٩`) — the more common convention on
Gulf-region travel/tech products, universally read everywhere. Gregorian calendar with Arabic
month names via `toLocaleDateString("ar", ...)`, not Hijri — travel dates are Gregorian everywhere
regardless of UI language.

### 5. No URL-based language routing in v1

Language is a client-side toggle (`localStorage`), no `/ar/...` prefix or subdomain. Means Arabic
content isn't independently indexable by Google yet and a shared link doesn't carry language
context — a real, valuable SEO follow-up given the organic-growth strategy, deliberately deferred
so this doesn't also become a routing redesign.

### 6. Bilingual content lives on the same row, generated in the same call

Per the table above: add `_ar` columns/keys rather than a second table, second set of rows, or a
`language` column that fragments one physical place into two records. And generate both languages
in the **same** AI call by extending the existing JSON schema (`{"name": ..., "name_ar": ...,
"description": ..., "description_ar": ...}`) rather than a separate translation pass afterward.
Reasoning: a second pass doubles AI calls (real cost at scale) and risks the Arabic describing a
subtly different "fact" than the English if generated independently; one call reasoning about both
at once stays consistent and costs only modestly more output tokens, not a second full request.

This applies to sites, activities, and city tips. It does **not** apply to the live chat (decision
8) or to day titles, which are generated fresh per trip build, not cached — day titles get their
own bilingual JSON schema in `buildDayLabelsSystemPrompt`, same one-call principle.

### 7. The tone lives in one shared prompt fragment, referenced everywhere

`src/lib/arabicVoice.ts` (or similar): one exported constant holding the calibrated voice
description from the top of this document, interpolated into every prompt that asks for Arabic
output — `generatePoiBatch`, `generateActivityBatch`, `generateTipCategory`,
`buildDayLabelsSystemPrompt`, `buildGatherSystemPrompt`'s Arabic branch, and the site
long-description generator in `SiteDetailModal.tsx`. One source of truth; a future tone tweak
means editing one file, not re-auditing six prompts for drift.

### 8. The chat: Arabic replies, English `[PARTIAL]` keys

`buildGatherSystemPrompt(today, language)` gets a language parameter. When `"ar"`: the system
prompt instructs Claude to write its natural-language reply in Arabic (referencing decision 7's
voice), while explicitly keeping the `[PARTIAL]{"legs":[{"city": "...", ...}]}` block's `city`/
`country`/`country_id` values in **English** — those are never rendered to the user (the app
already regex-strips the block from the visible reply), and everything downstream — `slugify()`,
Supabase site/activity lookups, cached content matching — depends on them staying the stable
English keys they are today. The model is entirely capable of writing an Arabic sentence and
emitting an English-keyed JSON block in the same response; this is a prompt-clarity concern, not a
technical limitation. `buildDayLabelsSystemPrompt` similarly takes a `language` and returns
bilingual day titles regardless (decision 6), since a trip's language can't be known permanently at
build time — the viewer's language might differ from the builder's, especially for `/shared` links.

### 9. Backfilling existing cached content

New Netlify actions mirroring `saveSiteMeta`: a batch job (fire-and-forget, same pattern as
`backfillSiteMeta`) that finds sites/activities/tips missing `_ar` fields for a city already being
viewed, translates them in the shared voice, and patches them in. Runs opportunistically whenever
`ensureCitySites`/`ensureCityActivities`/`ensureCityTips` are called for a city that already has
"enough" cached content (so it doesn't wait for a full cold-start regeneration) — same
non-blocking, best-effort shape as the existing must-see/duration backfill.

### 10. Not in scope for v1

- Hijri calendar, Eastern Arabic-Indic numerals.
- URL-based language routing (`/ar/...`) — see decision 5.
- Per-account persisted language preference (server-side) — `localStorage` only.
- Translating a trip's `dates` label itself beyond month names (see decision 4) — no change to
  `publicDateLabel`'s redaction logic, just its locale.
- Retroactively backfilling *every* already-cached city eagerly — decision 9's backfill runs
  opportunistically per city as it's visited, not as a one-time mass migration job.

## Execution phases

### Phase 0 — i18n infrastructure (foundation, not yet visible)
- `src/lib/i18n/en.ts`, `ar.ts`, `useTranslation.ts`, `LanguageContext.tsx`.
- Wire into `App.tsx`; set `lang`/`dir` on `<html>` reactively. Switcher in `Settings`.
- **Tests**: `t()` interpolation + missing-key fallback; language-detection pure function.
- Manual: switch language, confirm `<html dir>` flips and survives reload.

### Phase 1 — RTL foundation: Layout, Sidebar, direction-aware icons
- Translate + RTL-fix `Layout.tsx`, `Sidebar.tsx` (desktop + mobile) — present on every page.
- `<BackLink>` component (decision 3); migrate all 7 literal arrow strings.
- **Manual**: full RTL sanity pass on the sidebar/nav alone before repeating the pattern everywhere.

### Phase 2 — Bilingual content infrastructure (not surfaced in UI yet) — DONE
- SQL for `sites.name_ar/description_ar/long_description_ar`, `activities.name_ar/description_ar`
  on **both** Supabase projects. Run by the user on both.
- `src/lib/arabicVoice.ts` (decision 7).
- Extend `generatePoiBatch`, `generateActivityBatch`, `generateTipCategory` JSON schemas with `_ar`
  fields; extend `Site`/`Activity`/`CityTips` types.
- Backfill actions + fire-and-forget calls (decision 9).
- Extend `TripDay`/`TripSlot` types with bilingual fields; `siteToSlot()` carries them through;
  `SwapPanel`'s manually-constructed slot carries them through too.
- **Tests**: `needsArabicTranslation` (sites.ts, activities.ts), `arabicKey` (cityTips.ts),
  `activityToCandidate` carries `name_ar`/`description_ar` through. 104/104 passing.
- Manual (verified live on staging, commit `c6647cf`): called `plan-agent` directly with the real
  `generatePoiBatch` prompt for Sidon, Lebanon — real place names, correct JSON shape, calibrated
  MSA voice (not cheesy, not colloquial). Seeded a disposable `test-city-qa-arabic` row via
  `upsertSites` with one site missing `name_ar`/`description_ar`, confirmed `saveSiteTranslation`
  patches it in place (backfill path). Same round-trip confirmed for city tips: `_ar` sibling key
  missing → translated via `plan-agent` → merged and re-saved via `saveCityTips` → `getCityTips`
  shows both languages. One non-bug caught during verification: Arabic text passed as a raw shell
  `-d` argument through Git Bash/curl.exe on Windows gets mangled to `?` (a shell/codepage issue,
  not a Supabase or proxy bug) — fixed by writing the JSON payload to a file and using
  `--data-binary @file`, after which the Arabic round-tripped correctly end to end.

### Phase 3 — Bilingual chat — DONE
- `buildGatherSystemPrompt(today, language)`: adds the calibrated Arabic-voice instruction only
  when `language === "ar"`; the `[PARTIAL]` block's `city`/`country`/`country_id` are explicitly
  required to stay English in the prompt itself, regardless of reply language.
- `buildDayLabelsSystemPrompt`: always generates both `label` and `labelAr` in one call (same
  one-call-both-languages approach as Phase 2, decision 6) — day titles don't depend on which
  language the conversation happened in. `parseDayLabels` now returns `{label, labelAr}[]`.
  `Plan.tsx` composes `day.label`/`day.labelAr` (each with its own "Day N"/"اليوم N" prefix) from
  the parsed pair.
- `Plan.tsx` passes the current UI language (`useTranslation()`) into `buildGatherSystemPrompt`.
- **Tests**: `buildGatherSystemPrompt` language switch and the always-English `[PARTIAL]`
  instruction; `parseDayLabels`' bilingual shape validation (accepts `{label, labelAr}[]`, rejects
  the old plain-string-array shape and any item missing `labelAr`). 111/111 passing.
- Manual (verified live on staging, commit `822a10a`): called `plan-agent` directly with the real
  Arabic gather prompt for "أريد رحلة لمدة أربعة أيام إلى مراكش" — reply came back in natural,
  calibrated MSA, and the `[PARTIAL]` block correctly kept `"city":"Marrakech"`,
  `"country":"Morocco"`, `"country_id":"morocco"` in English. Called it again with the real
  day-labels prompt for a 2-day Marrakech itinerary — got back well-formed bilingual titles
  (`"Heart of the Medina"` / `"في قلب المدينة العتيقة"`, etc.), matching `parseDayLabels`' expected
  shape exactly.

### Phase 4 — Landing, Auth — DONE
First-touch pages; small string count, second RTL rep before the bigger pages.
- `landing.*`/`auth.*` keys added to `en.ts`/`ar.ts`; `Landing.tsx`'s nav items reuse the existing
  `sidebar.*` keys instead of duplicating them. `Battuta`/`Battuta Huna` brand text stays literal,
  matching the existing pattern in `Sidebar.tsx`/`Plan.tsx`.
- One physical-to-logical fix: the landing nav pill's `pl-6 pr-2` → `ps-6 pe-2`, so the asymmetric
  padding (more room around the nav links, less around the CTA button) stays on the correct side
  regardless of direction. `Auth.tsx` had no physical-direction utilities to fix — already
  direction-agnostic (centered flex column).
- Manual (verified live on staging, commit `72a49e4`): downloaded the deployed JS bundle and
  confirmed 6 sampled Arabic strings (`landing.getStarted`, `landing.toggleMenu`, `landing.quote`,
  `landing.statExplorers`, `auth.title`, `auth.sendError`) shipped byte-correct, ruling out any
  build-time mangling. Full in-browser RTL/toggle verification (already proven mechanically sound
  in Phase 1) deferred to a browser-driving tool not available this session.

### Phase 5 — Plan flow (`Plan.tsx`) — DONE
UI chrome translation + RTL for the largest single page, now that Phase 3 means the chat itself is
also fully Arabic when selected — no more "mixed language" caveat to test around.
- ~50 new `plan.*` keys: hero copy, suggestion chips, every hard-coded chat question/echo, mode/pace/
  party choices, error messages, and the selecting/building summary screen.
- `GROUP_TYPES`/`PACE_OPTIONS` (planFlow.ts) keep their canonical English values in Supabase
  (`trip.group_type`/`pace`) — only their pill/summary display labels are translated
  (`GROUP_LABEL_KEYS`/`PACE_LABEL_KEYS`), the same pattern Phase 6 uses for
  `CATEGORIES`/`ACTIVITY_TYPES`. Interest tag names stay English for now — explicitly Phase 6's job.
- RTL fixes beyond Phase 1's: input padding and absolutely-positioned send buttons (`pl/pr`/`right-`
  → `ps/pe`/`end-`), the hero illustration's `right-` → `end-`, message timestamp padding, and —
  the one non-obvious one — chat bubble tail corners. `rounded-bl`/`rounded-br` are physical and
  don't flip with `dir`, but the tail must always point toward the avatar (bot, inline-start) or the
  self-end side (user) regardless of direction, so they became logical `rounded-es`/`rounded-ee`.
  `text-left` → `text-start` on `PlaceCard` and `ModeChoice`'s buttons.
- Manual (verified live on staging, commit `f71a504`): downloaded the deployed bundle and confirmed
  10 sampled Arabic strings across hero copy, chat questions, pill labels, and error messages
  shipped byte-correct. One process note: the first two bundle-hash polls after this push actually
  caught an intermediate rebuild (triggered by the prior docs-only commit) that didn't yet contain
  Phase 5 strings — fixed by polling for a specific Phase-5 string's presence in the bundle instead
  of just any hash change, which is the more reliable check going forward.

### Phase 6 — Explore, AllSites, SiteDetailModal, PoiCard, TagPill — DONE
Renders the bilingual site/activity content from Phase 2 for the first time — confirm the language
toggle actually switches which field (`name` vs `name_ar`) gets displayed, not just the UI chrome
around it. Category names (`CATEGORIES`, `ACTIVITY_TYPES`) get Arabic display labels; the
underlying English strings stay as data keys (Supabase values, `normalizeCategory`, analytics).
- `CATEGORY_LABEL_KEYS`/`ACTIVITY_TYPE_LABEL_KEYS` (categories.ts/activityTypes.ts) map each
  canonical English value to a display-label key, same pattern as Plan.tsx's `GROUP_LABEL_KEYS`.
  Wired into Explore's/AllSites' category filter pills, `PoiCard`/`AllSitesListItem`'s category
  line, `SiteDetailModal`, and — closing a gap explicitly deferred from Phase 5 — Plan.tsx's
  interest-tag pickers and the selecting-phase summary line.
- `Explore`/`AllSites`/`PoiCard`/`AllSitesListItem` switch `name`/`description` to `name_ar`/
  `description_ar` when the UI language is Arabic and the field is populated, falling back to
  English otherwise (a site not yet backfilled stays readable, not blank).
- `SiteDetailModal`'s on-demand long-description generation now asks for both languages in the
  same call for a fresh site, and separately, opportunistically translates an already-cached
  English-only long description into Arabic alone on next view (its own backfill, same shape as
  Phase 2's) — without touching or re-generating the English a returning visitor already saw.
  `saveLongDescription` (supabase-proxy.js) now persists `long_description_ar`.
- RTL: `pr-`/`right-` → `pe-`/`end-` on the modal's close button, title, and the hero illustration;
  `text-left` → `text-start` on `PlaceCard`, `PoiCard`, `AllSitesListItem`, `ModeChoice`. The photo
  carousel's prev/next arrows stay physically left/right on purpose — a media scrubber follows
  universal prev/next convention rather than mirroring with the page (documented in the component
  as an intentional exception, not an oversight).
- **Tests**: `CATEGORY_LABEL_KEYS`/`ACTIVITY_TYPE_LABEL_KEYS` resolve to a truthy string in both
  `en`/`ar` for every canonical category/activity type. 113/113 passing.
- Manual (verified live on staging, commit `2acfbd9`): downloaded the deployed bundle and confirmed
  8 sampled Arabic strings shipped byte-correct. Directly exercised the extended
  `saveLongDescription` action against a disposable test site (`test-city-qa-arabic`), confirming
  `long_description_ar` persists and round-trips through `getSite` alongside the existing English
  `long_description`.

### Phase 7 — Trip pages (`TripDetail`, `TripContent`, `TripMapBuilder`, `CustomiseTrip`,
`SwapPanel`, `SharedTrip`) — DONE
Renders bilingual itinerary content end to end. `SharedTrip` specifically: a stranger should see
the page in *their* language, independent of the owner's — and since Phase 2 made day titles/slot
content bilingual regardless of build language, this should just work; confirm it actually does.
- `TripContent.tsx` (shared by `TripDetail` and the public `/shared` page): slot rows switch to
  `nameAr`/`descriptionAr`, day headers to `labelAr`, purely by reading the current UI language —
  independent of which language built the trip, confirming the decision-6/8 bet paid off.
- Found and fixed a real bug while wiring this up: `TripGuide` iterated `tipsByCity` with
  `Object.entries()`, which rendered every tip category **twice** — once under its real key, once
  under the untranslatable `<key>_ar` sibling Phase 2 introduced (no `GUIDE_META` entry, so it fell
  back to the raw key as an ugly title). Now iterates the fixed `TIP_CATEGORIES` taxonomy (exported
  from cityTips.ts for this) and picks the language-appropriate value directly — this bug existed
  since Phase 2 shipped but had no visible surface until this phase actually rendered the guide.
- `GROUP_LABEL_KEYS`/`PACE_LABEL_KEYS` moved out of `Plan.tsx` into `planFlow.ts` (exported) so
  `CustomiseTrip`/`TripDetail`/`TripMapBuilder`/`SharedTrip` reuse one map instead of duplicating.
- `categoryOrActivityLabelKey` (categories.ts): a trip slot's stored `category` can be a site
  category *or* a raw `activity_type` (activityToCandidate deliberately skips normalizeCategory,
  see the note there), so label lookup falls back through `normalizeActivityType` for anything not
  found verbatim in either canonical map — handles the general case Plan.tsx's narrower
  `interestLabelKey` didn't need to.
- `GUIDE_META` entries now carry a `labelKey` instead of a hardcoded English `title`.
- RTL: `pr-`/`right-` → `pe-`/`end-` across `TripDetail`/`SwapPanel`; `text-left` → `text-start` on
  `TripContent`'s slot rows and `TripMapBuilder`'s list items.
- **Tests**: `categoryOrActivityLabelKey` resolves categories, activity types, and a drifted
  non-canonical value; `GROUP_LABEL_KEYS`/`PACE_LABEL_KEYS` and `GUIDE_META`'s `labelKey`s resolve
  in both languages; `GUIDE_META` has an entry for every key `ensureCityTips` actually generates
  (the exact mismatch class that caused the bug above). 121/121 passing.
- Manual (verified live on staging, commit `02754b7`): downloaded the deployed bundle and confirmed
  10 sampled Arabic strings across TripDetail, TripMapBuilder, CustomiseTrip, and SwapPanel shipped
  byte-correct.

### Phase 8 — MyTrips, remaining pages (`About`, `Blog`, `BlogPost`), docs — DONE
Closes out remaining pages; `NOTES.md` entry + README addendum covering both the i18n/RTL
conventions and the bilingual-content conventions (where `_ar` fields live, how the shared voice
prompt is referenced) so future features don't ship English-only by default.
- `MyTrips.tsx`: trip cards' category tags now go through `categoryOrActivityLabelKey`; group/pace
  meta line reuses `GROUP_LABEL_KEYS`/`PACE_LABEL_KEYS`.
- `About.tsx`: full bilingual marketing copy — all 4 accordion sections (title + body) and the 3
  intro paragraphs, calibrated to the same warm-not-cheesy MSA voice as everywhere else, even
  though this is marketing prose rather than travel-guide content.
- `Blog.tsx`/`BlogPost.tsx`: bilingual `title`/`excerpt`/`tag`/`paragraphs` added directly to each
  `BLOG_POSTS` entry (3 posts × 4 paragraphs each, translated by hand, not AI-generated, since this
  is fixed marketing/editorial content rather than per-city generated data). Date formatting now
  uses `"ar-u-nu-latn"` in Arabic mode — Arabic month names with Western numerals, per the plan's
  QA convention (never Eastern Arabic-Indic digits, never Hijri).
- `TripCard.tsx`: `text-left` → `text-start`.
- Added the README.md conventions section and NOTES.md rollout entry (see both for the full
  write-up of what this effort settled on and why).
- **Tests**: every `BLOG_POSTS` entry has non-empty Arabic fields, with the same paragraph count in
  both languages. 123/123 passing.
- Manual (verified live on staging, commit `b2f57ce`): downloaded the deployed bundle and confirmed
  8 sampled strings — including full blog-post prose ("من هو ابن بطوطة", "في عام 1325...") and
  About's section copy ("سافر بفضول أكبر") — shipped byte-correct.

## Manual QA checklist (run after every phase, not just at the end)

1. Toggle to Arabic → the whole page mirrors (flex/grid order, icon direction, text alignment),
   not just text.
2. Toggle back to English → nothing about the English experience regressed.
3. Every directional icon points the correct way in RTL.
4. No raw English string leaks into the Arabic UI (a missed `t()` call) and vice versa.
5. Site/activity/tip content actually switches to `_ar` fields in Arabic mode, not just surrounding
   chrome (from Phase 6 onward).
6. The Battuta chat replies in the calibrated Arabic voice, and the `[PARTIAL]` block still parses
   (from Phase 3 onward) — check a single-city, a multi-leg, and a vague/suggestion-mode
   conversation.
7. Numbers/dates: Western numerals, Gregorian-with-Arabic-month-names.
8. Mobile width in both languages, both directions.
9. A fresh visitor with an Arabic browser locale lands in Arabic automatically; a manual choice
   survives reload and isn't silently overridden later.
10. A trip built while the UI was set to English still shows correctly if later viewed (or shared)
    in Arabic, and vice versa — bilingual snapshotting (decision 6/Phase 2) is what makes this
    possible; it's the one thing most likely to quietly regress if a future itinerary-building
    change forgets to populate both language fields.

## Risks & open questions

- **Scale.** Still the dominant risk — now compounded by a genuine content/data-model change on
  top of the UI/RTL mechanical work. Budget across several sessions.
- **AI generation cost.** Both languages in one call keeps this to roughly the same call *count*
  as today, but longer responses (more output tokens) per call — worth a quick before/after cost
  check once Phase 2 ships, not just an assumption.
- **Backfill coverage.** Decision 9's opportunistic backfill means a city nobody revisits keeps
  showing English-only content indefinitely. Acceptable for v1 (matches how `backfillSiteMeta`
  already works), but worth knowing this isn't a guarantee, just an eventual-consistency behavior.
- **RTL regressions in components not yet touched**, and **English-string leaks** as more of the
  app is migrated — both covered by the QA checklist, but worth specific attention whenever a
  shared component (already fixed in an earlier phase) shows up again in a later one.
- **Open question**: should Arabic ever be auto-selected by detected city/IP rather than only
  browser language? Proposal unchanged: browser language only for v1.
- **Open question**: once the whole thing ships, is a per-account (not just `localStorage`)
  language preference worth adding? Revisit with real usage rather than deciding now.
