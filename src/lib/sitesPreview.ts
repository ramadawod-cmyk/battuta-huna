import { db } from "./api";
import { BATCH_SIZE, buildSiteRow, generatePoiBatch, isNearDuplicate } from "./sites";
import { normalizeCategory } from "./categories";
import type { Site } from "./types";

const FOCUS =
  "Focus on the single most popular, iconic highlights overall -- the handful of things a " +
  "first-time visitor would recognize immediately.";

/** `getSites`' default order is alphabetical by name, not importance -- must_see-first gives an
 * actually representative "top sites" preview instead of whatever sorts first in the alphabet. */
function byMustSeeFirst(sites: Site[]): Site[] {
  return [...sites].sort((a, b) => Number(!!b.must_see) - Number(!!a.must_see));
}

/**
 * A fast, lightweight alternative to `ensureCitySites` for places that only need to SHOW a
 * handful of sites (e.g. a preview panel), not build out a full itinerary-ready catalog.
 * `ensureCitySites` tops a city up to 24 cached places via 12 parallel AI batches the moment it's
 * under that target -- correct for building a trip, but far too slow/expensive just to preview 3
 * sites for a city nobody has visited in the app yet. This checks the existing cache first (the
 * common case for any well-known destination) and only ever makes ONE small AI call for whatever
 * is still missing, persisting the result with the exact same `buildSiteRow` shape `ensureCitySites`
 * uses -- so these rows count toward that 24-site target later, rather than being redone.
 */
export async function ensureTopSitesPreview(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
  count = 3,
): Promise<Site[]> {
  const existing: Site[] = (await db("getSites", { cityId })) || [];
  if (existing.length >= count) {
    return byMustSeeFirst(existing)
      .slice(0, count)
      .map((site) => ({ ...site, category: normalizeCategory(site.category) }));
  }

  const needed = count - existing.length;
  await db("upsertCountry", { country: { id: countryId, name: countryName } });
  await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } });

  try {
    // A single batch stays at the same BATCH_SIZE `generatePois`'s own cold-start already measured
    // as a real margin under Netlify's 10s sync cap on this project's plan -- a batch of `needed`
    // (up to this function's whole `count`) ran 10.6s in a live test, well past what a 3-item
    // batch already measured as "too close to the cap for comfort" elsewhere in this codebase.
    const batchSizes: number[] = [];
    for (let remaining = needed; remaining > 0; remaining -= BATCH_SIZE) batchSizes.push(Math.min(BATCH_SIZE, remaining));
    const results = await Promise.allSettled(
      batchSizes.map((size) => generatePoiBatch(cityName, countryName, FOCUS, size)),
    );

    // Two independent batches have no visibility into each other's picks, so for a sparsely
    // cached city the same top landmark often comes back from both under slightly different
    // names (verified live: "Al-Masjid an-Nabawi" vs "Al-Masjid an-Nabawi (Prophet's Mosque)") --
    // exact-name dedup alone misses that, same reasoning as generatePois's own isNearDuplicate.
    const seenNames = new Set(existing.map((s) => s.name.toLowerCase()));
    const fresh = [];
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const poi of result.value) {
        const key = poi.name.toLowerCase();
        if (seenNames.has(key)) continue;
        if (isNearDuplicate(poi, existing) || isNearDuplicate(poi, fresh)) continue;
        seenNames.add(key);
        fresh.push(poi);
      }
    }
    const newSites = fresh.map((poi) => buildSiteRow(cityId, cityName, poi));

    if (newSites.length > 0) await db("upsertSites", { sites: newSites }).catch(() => {});
    return byMustSeeFirst([...existing, ...newSites] as Site[]).slice(0, count);
  } catch {
    // A failed preview generation isn't worth surfacing an error for -- just show whatever's
    // already cached (even an empty list), the same tolerant fallback ensureCitySites itself uses.
    return existing.map((site) => ({ ...site, category: normalizeCategory(site.category) }));
  }
}
