import { db, planAgent } from "./api";
import { CATEGORIES, normalizeCategory } from "./categories";
import { slugify } from "./geo";
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
// the 30s configured in netlify.toml (that setting only takes effect on paid plans). Measured
// directly against this deployment: a single call for 10 POIs with 1-2 sentence descriptions took
// ~23s — nowhere close. Batches of 4 with short (10-14 word) descriptions measured ~7s, leaving a
// real margin. Five such batches in parallel cover 20 POIs without serializing the wait.
const BATCH_SIZE = 4;
const BATCH_COUNT = 5;

async function generatePoiBatch(cityName: string, countryName: string, focus: string, count: number): Promise<GeneratedPoi[]> {
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Generate ${count} real, accurate points of interest for a given city. ${focus} Categories MUST be exactly one of these 8 strings, verbatim, no variations: ${CATEGORIES.map((c) => `"${c}"`).join(", ")}. Coordinates must be real and accurate. Keep descriptions to 10-14 words. Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string, "category": string (one of the 8 exact category strings above), "tags": string[1-2], "description": string (10-14 words, warm editorial tone, no markdown), "lat": number, "lng": number, "mustSee": boolean (true only for iconic, unmissable landmarks a first-time visitor shouldn't skip), "durationMinutes": number (typical time a visitor spends here, in minutes)}.`;

  const text = await planAgent(system, [
    { role: "user", content: `Generate ${count} points of interest for ${cityName}, ${countryName}.` },
  ]);
  const pois = extractJsonArray(text) as GeneratedPoi[];
  return pois.map((poi) => ({ ...poi, category: normalizeCategory(poi.category) }));
}

async function generatePois(cityName: string, countryName: string): Promise<GeneratedPoi[]> {
  // At least 30% hidden gems overall: 2 of every 5 batches lean toward lesser-known spots.
  const batches = Array.from({ length: BATCH_COUNT }, (_, i) => {
    const focus =
      i % 5 < 3
        ? "Focus on the best-known, must-see highlights."
        : "Focus on lesser-known \"hidden gem\" spots locals love, not tourist staples.";
    return generatePoiBatch(cityName, countryName, focus, BATCH_SIZE);
  });

  const results = await Promise.allSettled(batches);
  const seen = new Set<string>();
  const pois: GeneratedPoi[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const poi of result.value) {
      const key = poi.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pois.push(poi);
    }
  }
  if (pois.length === 0) throw new Error("Couldn't generate any points of interest for this city.");
  return pois;
}

/**
 * Cache-first city POI loader, mirroring the legacy PWA's `ensureCitySites`:
 * reuse existing Supabase sites for a city if there are enough of them,
 * otherwise AI-generate a fresh batch and persist it.
 */
export async function ensureCitySites(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
): Promise<Site[]> {
  const existing: Site[] = await db("getSites", { cityId });
  if (existing && existing.length >= 5) {
    backfillSiteMeta(cityId, cityName, existing);
    // Normalize category for display/filtering only — don't rewrite existing DB rows just for this.
    return existing.map((site) => ({ ...site, category: normalizeCategory(site.category) }));
  }

  await db("upsertCountry", { country: { id: countryId, name: countryName } });
  await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } });

  try {
    const generated = await generatePois(cityName, countryName);
    const sites = generated.map((poi) => ({
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

    await db("upsertSites", { sites });
    track("New City Cold Start", { city_id: cityId, source: "ai_generated", success: true, place_count: sites.length });
    return sites as Site[];
  } catch (err) {
    track("New City Cold Start", {
      city_id: cityId,
      source: "ai_generated",
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
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
