import { db, wikiImageByTitle } from "./api";

/**
 * Cache-first city hero image: checks the `cities.hero_image_url` column first, falling back to
 * a Wikipedia lookup only when that's empty. A freshly-resolved wiki image gets persisted back to
 * that column (ensuring the city's row exists first -- an AI-suggested destination may not be in
 * the catalog yet) so the next lookup for the same city, from anywhere in the app, is instant
 * instead of re-querying Wikipedia every time.
 */
export async function ensureCityHeroImage(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
): Promise<string | null> {
  const cached = await db("getCityHero", { cityId }).catch(() => null);
  if (cached?.hero_image_url) return cached.hero_image_url;

  const wiki = await wikiImageByTitle(cityName).catch(() => null);
  const url = wiki?.url || null;
  if (url) {
    await db("upsertCountry", { country: { id: countryId, name: countryName } }).catch(() => {});
    await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } }).catch(() => {});
    await db("updateCityHero", { cityId, heroImageUrl: url }).catch(() => {});
  }
  return url;
}
