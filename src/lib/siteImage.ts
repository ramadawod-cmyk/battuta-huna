import { db, wikiImageByTitle, wikiImagesBySearch } from "./api";
import type { Site } from "./types";

/**
 * Cache-first site image: every freshly AI-generated site (from `ensureCitySites` or the
 * lightweight `ensureTopSitesPreview`) has no `image_url` at all, so without this, the same
 * Wikipedia lookup repeats every time anyone views it. Resolves `image_url` directly if already
 * set, else the same two-tier Wikipedia lookup `useWikiThumbnail` uses (exact article, then a
 * fuzzy Commons search), persisting a fresh result back via `saveImageUrl` so it's cached for
 * every later view, not just this one.
 */
export async function ensureSiteImage(site: Site, cityId: string): Promise<string | null> {
  if (site.image_url) return site.image_url;

  const exact = await wikiImageByTitle(site.name).catch(() => null);
  const url = exact?.url || (await wikiImagesBySearch(site.name).catch(() => []))[0]?.url || null;
  if (url) await db("saveImageUrl", { name: site.name, cityId, imageUrl: url }).catch(() => {});
  return url;
}
