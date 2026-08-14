# Battuta Huna — SEO & GEO Plan

A prioritized plan to make Battuta Huna discoverable in traditional search engines (SEO)
and in AI answer engines like ChatGPT, Claude, Perplexity, and Google AI Overviews
(GEO — Generative Engine Optimization). Grounded in an audit of the current codebase
and the live site (2026-08-14).

---

## 1. Current state audit

| Area | Status | Notes |
|---|---|---|
| Title tag | ⚠️ Minimal | `Battuta Huna` — no keywords, no value proposition |
| Meta description | ❌ Missing | Search snippets are auto-generated from whatever Google finds |
| Open Graph / Twitter cards | ❌ Missing | Shares on WhatsApp/X/Slack show no preview card |
| Canonical URL | ❌ Missing | No canonical; www vs apex not declared |
| robots.txt | ❌ 404 | Crawlers get no guidance; AI crawlers undeclared |
| sitemap.xml | ❌ 404 | Nothing tells crawlers what exists |
| Structured data (JSON-LD) | ❌ Missing | No entity understanding for Google or LLMs |
| Staging indexability | 🔴 **Actively harmful** | `staging.battutahuna.com` returns 200 with no noindex — it can outrank or duplicate production |
| Rendering | 🔴 Critical constraint | Single-page app; all city/site content is client-rendered from Supabase. Crawlers that don't execute JS see only the splash screen |
| Content depth | ✅ Hidden asset | Supabase holds AI-generated site descriptions, visit durations, city travel guides (8 tip sections per city) — none of it is on a crawlable URL |
| PWA manifest | ⚠️ Partial | Description exists; icons reference `/favicon.ico`, `/icon-192.png`, `/icon-72.png` which are **not in the repo** |
| `lang` attribute | ✅ | `lang="en"` set |
| Performance | ⚠️ | 200KB single HTML file, inline CSS/JS; fonts from Google CDN; images proxied through a Netlify function |

---

## 2. Phase 0 — Stop the bleeding (do immediately, < 1 hour)

### 2.1 Noindex staging
`staging.battutahuna.com` must never appear in search results. Netlify headers can't
vary by branch in a shared `netlify.toml`, so use a small **Netlify Edge Function**
that adds `X-Robots-Tag: noindex, nofollow` when `Host` starts with `staging.`.
This also covers deploy previews (`*--*.netlify.app`).

### 2.2 robots.txt
Serve at the root:

```
# Production robots.txt
User-agent: *
Allow: /
Disallow: /.netlify/

# AI / answer-engine crawlers — explicitly welcome (GEO)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: https://battutahuna.com/sitemap.xml
```

### 2.3 Canonical host
Pick one canonical host (recommend apex `battutahuna.com`), 301-redirect the other
in Netlify domain settings, and add `<link rel="canonical">` to the page.

---

## 3. Phase 1 — Head & metadata foundation (1–2 days)

### 3.1 Rewrite the `<head>`

```html
<title>Battuta Huna — Discover Cultural Sites Around You & Plan AI Trip Itineraries</title>
<meta name="description" content="Battuta Huna notifies you when you walk near significant cultural sites, and builds day-by-day trip itineraries with AI. Named after Ibn Battuta, the greatest traveler in history." />
<link rel="canonical" href="https://battutahuna.com/" />

<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Battuta Huna" />
<meta property="og:title" content="Battuta Huna — Cultural Discovery & AI Trip Planning" />
<meta property="og:description" content="Get notified near cultural sites. Build AI-powered itineraries for any city." />
<meta property="og:url" content="https://battutahuna.com/" />
<meta property="og:image" content="https://battutahuna.com/og-image.png" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Battuta Huna — Cultural Discovery & AI Trip Planning" />
<meta name="twitter:description" content="Get notified near cultural sites. Build AI-powered itineraries for any city." />
<meta name="twitter:image" content="https://battutahuna.com/og-image.png" />
```

Requires creating **og-image.png** (1200×630) — brand mark + tagline. This alone fixes
every social/messenger share preview.

### 3.2 Real icon files
Create and commit `favicon.ico`, `icon-192.png`, `icon-512.png` (referenced by
manifest and service worker but currently missing → 404s). Add `apple-touch-icon`.

### 3.3 JSON-LD structured data (in `index.html`)

- `WebApplication` — name, description, category (Travel), free pricing, screenshot.
- `Organization` — name, logo, sameAs links (social profiles when they exist).
- `FAQPage` — 4–6 questions ("What is Battuta Huna?", "How does the AI itinerary
  builder work?", "Is it free?", "Who was Ibn Battuta?"). FAQ markup is heavily
  quoted by AI Overviews and answer engines.

---

## 4. Phase 2 — The rendering problem & programmatic SEO (the big win)

### 4.1 Why this matters
The app's most valuable content — per-city cultural site lists, AI-written site
descriptions, visit durations, 8-section travel guides — lives in Supabase and only
renders client-side inside an app shell. **None of it has a URL.** Search engines rank
URLs; LLM crawlers cite URLs. This is the single biggest lever available.

### 4.2 Recommended approach: static city guide pages
Add a lightweight build step (Node script, runs on Netlify build) that reads Supabase
and emits static HTML pages:

```
/cities/                      → index of all covered cities
/cities/amman/                → "Cultural Sites in Amman — Guide & Itinerary Ideas"
/cities/amman/citadel-of-amman/   → per-site page (description, visit duration, best time, map)
```

Each city page includes, as real server-rendered HTML:
- H1: `Cultural Sites in {City} — What to Visit & How Long to Spend`
- The site list with descriptions, categories, `bestTime`, `visitDuration`
- The 8 travel-guide tip sections (getting around, culture, money, safety…)
- `TouristDestination` + `TouristAttraction` + `BreadcrumbList` JSON-LD
- A CTA into the app ("Build a {City} itinerary in 2 minutes")
- Internal links: city → sites → neighboring cities → home

This is classic **programmatic SEO** fed by data the product already generates —
every trip a user plans in a new city creates a new indexable page on the next build.
Target queries: *"cultural sites in amman"*, *"what to see in amman in 3 days"*,
*"how long to spend at the citadel of amman"*, *"amman itinerary"*.

### 4.3 Sitemap
Generate `sitemap.xml` in the same build step (home + all city + site pages,
`lastmod` from Supabase timestamps). Submit in Search Console and Bing Webmaster Tools.

### 4.4 Landing-page content in `index.html`
Even before the build step exists, add a crawlable content block to the app shell
(below the splash, or as a `<noscript>`-visible section): 2–3 paragraphs explaining
what Battuta Huna is, who Ibn Battuta was, and the core features. Right now a
non-JS crawler sees almost nothing but a quote.

---

## 5. Phase 3 — GEO: Generative Engine Optimization (ongoing)

Goal: when someone asks ChatGPT/Claude/Perplexity *"apps that notify you about
cultural sites nearby"* or *"best AI trip planner for cultural travel"*, Battuta Huna
is named and cited.

1. **Crawlability for AI bots** — done via robots.txt allowlist (Phase 0). AI engines
   can only cite what they can fetch; the static city pages (Phase 2) are what they'll
   quote.
2. **llms.txt** — add `/llms.txt`: a concise Markdown summary of what the product is,
   its features, and links to the key city pages. Emerging convention, cheap to add.
3. **Entity consistency** — use the exact phrase "Battuta Huna" + a one-line
   definition ("a cultural discovery and AI trip-planning app") consistently across
   the site, app-store-style directories, and social profiles. LLMs learn entities
   from repetition across sources.
4. **The Ibn Battuta story** — the name is a genuine differentiator. A page
   `/about` telling the naming story ("Battuta Huna" ≈ "Battuta is here") is
   link-worthy, quotable, and strengthens the entity graph (link it to Ibn Battuta's
   Wikipedia/Wikidata entities via `sameAs`).
5. **Third-party corroboration** — LLMs weight independently-verifiable sources:
   - Product Hunt launch (LLMs cite PH heavily for "app for X" queries)
   - Listings: AlternativeTo, There's An AI For That, travel-app roundups
   - 2–3 guest posts / interviews in travel-tech blogs
   - A Wikidata item once there is press to cite
6. **Answer-shaped content** — on city pages, use question headings that mirror real
   queries ("How many days do you need in Amman?", "Is the Amman Citadel worth
   visiting?") with a direct 1–2 sentence answer first. This is what both featured
   snippets and LLM answers extract.

---

## 6. Geographic & multilingual signals

- **Arabic**: "Huna" (هنا) is Arabic; the audience skews toward MENA travel. A
  future `ar` locale with `hreflang="ar"` / `hreflang="en"` pairs would open
  low-competition Arabic queries (*"مواقع ثقافية في عمان"*). Defer until content
  model is stable, but architect city-page URLs to allow `/ar/cities/amman/`.
- **Geo-relevant metadata**: city pages should embed coordinates in
  `TouristAttraction` JSON-LD (`geo` property) — the lat/lng is already in Supabase.
- **Google Business Profile is N/A** (no physical premises) — do not invest there.

---

## 7. Technical & performance hygiene

- **Core Web Vitals**: the 200KB monolithic HTML is acceptable, but:
  - Add `width`/`height` + `loading="lazy"` to hero/site images (CLS + LCP).
  - Self-host the two Google Fonts (removes 2 third-party connections; also a
    privacy win).
  - Keep the wiki-image proxy's long cache headers (already good: 7-day immutable).
- **404 page**: add a custom `404.html` (Netlify picks it up automatically).
- **Service worker**: cache-first on `/` can serve stale HTML after deploys —
  switch to network-first for navigation requests so crawlers and users get
  fresh markup.

---

## 8. Measurement

- **Google Search Console** + **Bing Webmaster Tools**: verify domain, submit
  sitemap, monitor coverage/queries. Bing matters double because it feeds
  ChatGPT search and Copilot.
- **Mixpanel**: add a `utm_source` capture on first load and a
  `Referrer` super-property so organic/AI-referred sessions are attributable
  (Perplexity, ChatGPT, and Copilot send identifiable referrers).
- Quarterly: ask ChatGPT/Claude/Perplexity the target queries and log whether/how
  Battuta Huna is cited (manual GEO rank tracking).

---

## 9. Prioritized roadmap

| Phase | Item | Effort | Impact |
|---|---|---|---|
| 0 | Noindex staging (edge function) | 1 h | 🔴 Critical |
| 0 | robots.txt + AI crawler allowlist | 15 min | High |
| 0 | Canonical host redirect | 15 min | High |
| 1 | Title, description, OG/Twitter tags + og-image | 2–3 h | High |
| 1 | Icon files (favicon/192/512/apple-touch) | 1 h | Medium |
| 1 | JSON-LD: WebApplication + Organization + FAQ | 2 h | High (SEO+GEO) |
| 1 | Crawlable landing content block | 2 h | High |
| 2 | Static city/site page generator + sitemap | 2–4 days | 🚀 Biggest lever |
| 3 | llms.txt + /about (Ibn Battuta story) | 3 h | Medium (GEO) |
| 3 | Product Hunt + directory listings | 1 day | Medium (GEO) |
| 6 | Arabic locale + hreflang | later | Medium |
| 7 | Perf hygiene (fonts, lazy images, SW nav strategy, 404) | 1 day | Medium |
| 8 | Search Console + Bing + referrer tracking | 2 h | Foundational |

**Suggested order of execution: Phase 0 today → Phase 1 this week → Phase 2 as the
next substantial project → Phase 3 continuously once city pages are live.**
