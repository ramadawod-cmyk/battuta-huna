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
};

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not contain a JSON array");
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function generatePois(cityName: string, countryName: string): Promise<GeneratedPoi[]> {
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Generate 20 real, accurate points of interest for a given city. Categories MUST be exactly one of these 8 strings, verbatim, no variations: ${CATEGORIES.map((c) => `"${c}"`).join(", ")}. At least 30% should be lesser-known "hidden gem" spots, not just the top tourist landmarks. Coordinates must be real and accurate. Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string, "category": string (one of the 8 exact category strings above), "tags": string[1-2], "description": string (1-2 sentences, warm editorial tone, no markdown), "lat": number, "lng": number}.`;

  const text = await planAgent(system, [
    { role: "user", content: `Generate 20 points of interest for ${cityName}, ${countryName}.` },
  ]);
  const pois = extractJsonArray(text) as GeneratedPoi[];
  return pois.map((poi) => ({ ...poi, category: normalizeCategory(poi.category) }));
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
