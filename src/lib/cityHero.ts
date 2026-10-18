import { useEffect, useState } from "react";
import { db, wikiImageByTitle, unsplashCityImage } from "./api";
import { useWikiThumbnail } from "./useWikiThumbnail";

export type CityHeroImage = { url: string; creditName: string | null; creditUrl: string | null };

/**
 * Cache-first city hero image: checks the `cities.hero_image_url` column first, falling back to
 * Unsplash (nicer, non-expiring editorial photography) and then Wikipedia only when Unsplash has
 * no match, if that's empty. A freshly-resolved image gets persisted back to that row (ensuring
 * the city's own row exists first -- an AI-suggested destination may not be in the catalog yet) so
 * the next lookup for the same city, from anywhere in the app, is instant instead of re-querying
 * either source every time.
 *
 * countryId/countryName are optional -- callers that don't know the country yet (e.g. a legacy
 * trip with no per-day country recorded) can omit them. The lookup still works (Unsplash's query
 * just loses the country keyword), it simply skips upserting a country/city catalog row.
 */
export async function ensureCityHeroImage(
  cityId: string,
  cityName: string,
  countryId?: string,
  countryName?: string,
): Promise<CityHeroImage | null> {
  const cached = await db("getCityHero", { cityId }).catch(() => null);
  if (cached?.hero_image_url) {
    return {
      url: cached.hero_image_url,
      creditName: cached.hero_image_credit_name || null,
      creditUrl: cached.hero_image_credit_url || null,
    };
  }

  const unsplash = await unsplashCityImage(cityName, countryName).catch(() => null);
  let result: CityHeroImage | null = unsplash
    ? { url: unsplash.url, creditName: unsplash.creditName, creditUrl: unsplash.creditUrl }
    : null;

  // Wikipedia images carry no visible attribution requirement the way Unsplash's do, so this
  // fallback path simply has no credit -- consistent with how this app already shows Wikipedia
  // images elsewhere.
  if (!result) {
    const wiki = await wikiImageByTitle(cityName).catch(() => null);
    result = wiki?.url ? { url: wiki.url, creditName: null, creditUrl: null } : null;
  }

  if (result) {
    if (countryId && countryName) {
      await db("upsertCountry", { country: { id: countryId, name: countryName } }).catch(() => {});
      await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } }).catch(() => {});
    }
    await db("updateCityHero", {
      cityId,
      heroImageUrl: result.url,
      creditName: result.creditName,
      creditUrl: result.creditUrl,
    }).catch(() => {});
  }
  return result;
}

/**
 * Same resolve-with-fallback UX as Explore.tsx's hero banner (try the resolved/cached image,
 * fall back to a fresh Wikipedia title lookup if it 404s, give up to a flat gradient if both
 * fail) but packaged as a hook so other pages showing a city hero (TripDetail, SharedTrip) don't
 * each re-derive it.
 */
export function useCityHeroImage(
  cityId: string | undefined,
  cityName: string | undefined,
  countryId?: string,
  countryName?: string,
) {
  const [resolved, setResolved] = useState<CityHeroImage | null>(null);
  const [primaryFailed, setPrimaryFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const freshFallbackUrl = useWikiThumbnail(cityName);

  useEffect(() => {
    setResolved(null);
    setPrimaryFailed(false);
    setFallbackFailed(false);
    if (!cityId || !cityName) return;
    let cancelled = false;
    ensureCityHeroImage(cityId, cityName, countryId, countryName).then((result) => {
      if (!cancelled) setResolved(result);
    });
    return () => {
      cancelled = true;
    };
  }, [cityId, cityName, countryId, countryName]);

  const primaryOk = Boolean(resolved?.url) && !primaryFailed;
  const fallbackOk =
    !primaryOk && Boolean(freshFallbackUrl) && freshFallbackUrl !== resolved?.url && !fallbackFailed;
  const displayedUrl = primaryOk ? resolved!.url : fallbackOk ? freshFallbackUrl : null;
  const credit = primaryOk && resolved?.creditName && resolved?.creditUrl
    ? { name: resolved.creditName, profileUrl: resolved.creditUrl }
    : null;

  return {
    displayedUrl,
    credit,
    onImgError: () => (primaryOk ? setPrimaryFailed(true) : setFallbackFailed(true)),
  };
}
