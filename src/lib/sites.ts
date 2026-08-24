import { db, planAgent } from "./api";
import { CATEGORIES, normalizeCategory } from "./categories";
import { slugify, haversineMeters } from "./geo";
import { track } from "./analytics";
import type { Site } from "./types";

type GeneratedPoi = {
  name: string;
  category: string;
  tags: string[];
  description: string;
  lat: number;
  lng: number;
  mustSee?: boolean;
  durationMinutes?: number;
};

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not contain a JSON array");
  }
  return JSON.parse(text.slice(start, end + 1));
}

// Netlify Functions hard-cap synchronous execution at 10s on this project's plan, regardless of
// the 30s configured in netlify.toml (that setting only takes effect on paid plans). Batches of 4
// measured ~7s under the original 6-field POI schema — but asking each POI for mustSee and
// durationMinutes too (more output per item) pushed that toward 6.4-7.3s, and a real Paris
// generation silently lost 2 of 5 batches to it (Promise.allSettled below drops failures with no
// retry), producing only 12 candidate places for what should've been ~20+. Re-measured directly
// against the Anthropic API with the current (8-field) schema: 3-item batches ran 5.7-7.2s (still
// too close to the cap for comfort), 2-item batches ran a consistent 3.6-4.0s — a real margin.
const BATCH_SIZE = 2;
const BATCH_COUNT = 12;
// Independent parallel batches can't see each other's picks, so the same landmark sometimes comes
// back twice under different names (e.g. "Notre-Dame Cathedral" and "Cathédrale Notre-Dame de
// Paris" from two different batches, at effectively identical coordinates) — exact-name dedup
// alone misses that. Treat two POIs within this radius of each other as the same place.
const NEAR_DUPLICATE_METERS = 150;

async function generatePoiBatch(cityName: string, countryName: string, focus: string, count: number): Promise<GeneratedPoi[]> {
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Generate ${count} real, accurate points of interest for a given city. ${focus} Categories MUST be exactly one of these 8 strings, verbatim, no variations: ${CATEGORIES.map((c) => `"${c}"`).join(", ")}. Coordinates must be real and accurate. Keep descriptions to 10-14 words. Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string, "category": string (one of the 8 exact category strings above), "tags": string[1-2], "description": string (10-14 words, warm editorial tone, no markdown), "lat": number, "lng": number, "mustSee": boolean (true only for iconic, unmissable landmarks a first-time visitor shouldn't skip), "durationMinutes": number (typical time a visitor spends here, in minutes)}.`;

  const text = await planAgent(system, [
    { role: "user", content: `Generate ${count} points of interest for ${cityName}, ${countryName}.` },
  ]);
  const pois = extractJsonArray(text) as GeneratedPoi[];
  return pois.map((poi) => ({ ...poi, category: normalizeCategory(poi.category) }));
}

function isNearDuplicate(poi: { lat: number; lng: number }, against: { lat: number; lng: number }[]): boolean {
  return against.some((p) => haversineMeters(p.lat, p.lng, poi.lat, poi.lng) < NEAR_DUPLICATE_METERS);
}

/** `avoid` lets a top-up generation skip places the city already has cached, by name and by location. */
async function generatePois(cityName: string, countryName: string, avoid: Site[] = []): Promise<GeneratedPoi[]> {
  // At least 30% hidden gems overall, regardless of how BATCH_COUNT is tuned.
  const hiddenGemBatches = Math.ceil(BATCH_COUNT * 0.4);
  const batches = Array.from({ length: BATCH_COUNT }, (_, i) => {
    const focus =
      i < BATCH_COUNT - hiddenGemBatches
        ? "Focus on the best-known, must-see highlights."
        : "Focus on lesser-known \"hidden gem\" spots locals love, not tourist staples.";
    return generatePoiBatch(cityName, countryName, focus, BATCH_SIZE);
  });

  const results = await Promise.allSettled(batches);
  const seenNames = new Set<string>(avoid.map((s) => s.name.toLowerCase()));
  const accepted: GeneratedPoi[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const poi of result.value) {
      const key = poi.name.toLowerCase();
      if (seenNames.has(key)) continue;
      if (isNearDuplicate(poi, avoid) || isNearDuplicate(poi, accepted)) continue;
      seenNames.add(key);
      accepted.push(poi);
    }
  }
  if (accepted.length === 0 && avoid.length === 0) {
    throw new Error("Couldn't generate any points of interest for this city.");
  }
  return accepted;
}

// Below this many cached places, a multi-day trip runs out of candidates partway through and later
// days come back sparse or empty (a real 6-day trip against a city stuck at 12 cached sites did
// exactly that). Cities under the target get topped up with a fresh generation pass on next visit.
const TARGET_SITE_COUNT = 24;

/**
 * Cache-first city POI loader, mirroring the legacy PWA's `ensureCitySites`: reuse existing
 * Supabase sites for a city if there are enough of them, generating more (topping up, not
 * replacing) when there aren't.
 */
export async function ensureCitySites(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
): Promise<Site[]> {
  const existing: Site[] = (await db("getSites", { cityId })) || [];
  if (existing.length >= TARGET_SITE_COUNT) {
    backfillSiteMeta(cityId, cityName, existing);
    // Normalize category for display/filtering only — don't rewrite existing DB rows just for this.
    return existing.map((site) => ({ ...site, category: normalizeCategory(site.category) }));
  }

  await db("upsertCountry", { country: { id: countryId, name: countryName } });
  await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } });

  try {
    const generated = await generatePois(cityName, countryName, existing);
    const newSites = generated.map((poi) => ({
      id: `${cityId}-${slugify(poi.name)}`,
      city_id: cityId,
      name: poi.name,
      category: poi.category,
      tags: poi.tags,
      description: poi.description,
      lat: poi.lat,
      lng: poi.lng,
      map_url: `https://maps.google.com/?q=${encodeURIComponent(poi.name + ", " + cityName)}`,
      source: "ai",
      review_status: "ai_complete",
      must_see: poi.mustSee ?? false,
      duration_minutes: poi.durationMinutes ?? null,
    }));

    if (newSites.length > 0) await db("upsertSites", { sites: newSites });
    if (existing.length > 0) backfillSiteMeta(cityId, cityName, existing);
    track("New City Cold Start", {
      city_id: cityId,
      source: "ai_generated",
      success: true,
      place_count: existing.length + newSites.length,
      topped_up: existing.length > 0,
    });
    return [...existing, ...newSites] as Site[];
  } catch (err) {
    track("New City Cold Start", {
      city_id: cityId,
      source: "ai_generated",
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
    // A failed top-up on a city that already has *some* cached places shouldn't block the whole
    // flow — show what's there rather than erroring out a trip that could otherwise proceed.
    if (existing.length > 0) return existing.map((site) => ({ ...site, category: normalizeCategory(site.category) }));
    throw err;
  }
}

type SiteMeta = { name: string; mustSee: boolean; durationMinutes: number };

const META_BATCH_SIZE = 8;

async function classifySiteMetaBatch(cityName: string, sites: Site[]): Promise<SiteMeta[]> {
  const system = `You are a travel research assistant. For each place below (in ${cityName}), decide: is it an iconic, unmissable "must-see" landmark for a first-time visitor (true/false), and how many minutes does a typical visitor spend there. Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string (must match input exactly), "mustSee": boolean, "durationMinutes": number}.`;
  const places = sites.map((s) => ({ name: s.name, category: s.category, description: s.description }));
  const text = await planAgent(system, [{ role: "user", content: `Places: ${JSON.stringify(places)}` }]);
  return extractJsonArray(text) as SiteMeta[];
}

/**
 * Best-effort, fire-and-forget classification for sites cached before must_see/duration_minutes
 * existed. Never awaited by callers — failures are swallowed, same as SiteDetail's long-description
 * backfill, since the UI already has sensible fallback defaults (getDurationMinutes) in the meantime.
 */
async function backfillSiteMeta(cityId: string, cityName: string, sites: Site[]): Promise<void> {
  const stale = sites.filter((s) => s.duration_minutes == null);
  if (stale.length === 0) return;

  const batches: Site[][] = [];
  for (let i = 0; i < stale.length; i += META_BATCH_SIZE) batches.push(stale.slice(i, i + META_BATCH_SIZE));

  const results = await Promise.allSettled(batches.map((batch) => classifySiteMetaBatch(cityName, batch)));
  const patches: Promise<unknown>[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const meta of result.value) {
      patches.push(
        db("saveSiteMeta", { name: meta.name, cityId, mustSee: !!meta.mustSee, durationMinutes: meta.durationMinutes }).catch(
          () => {},
        ),
      );
    }
  }
  await Promise.allSettled(patches);
}
