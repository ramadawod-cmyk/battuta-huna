import { useEffect, useState } from "react";
import { wikiImageByTitle, wikiImagesBySearch } from "./api";

const cache = new Map<string, string | null>();

/**
 * Lazily resolves a thumbnail for a title, cached across the session. Tries an exact Wikipedia
 * article match first (fast), then falls back to a fuzzy Commons search — the same fallback
 * SiteDetail's photo gallery uses — since many AI-generated place names (a specific market, a
 * neighbourhood) have no exact Wikipedia article but do turn up in a Commons image search.
 */
export function useWikiThumbnail(title: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(title ? cache.get(title) ?? null : null);

  useEffect(() => {
    if (!title) return;
    if (cache.has(title)) {
      setUrl(cache.get(title) ?? null);
      return;
    }
    let cancelled = false;
    wikiImageByTitle(title)
      .then((result) => result?.url ?? wikiImagesBySearch(title).then((images) => images[0]?.url ?? null))
      .then((resolved) => {
        cache.set(title, resolved);
        if (!cancelled) setUrl(resolved);
      })
      .catch(() => {
        cache.set(title, null);
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [title]);

  return url;
}
