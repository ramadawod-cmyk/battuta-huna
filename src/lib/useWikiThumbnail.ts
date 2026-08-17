import { useEffect, useState } from "react";
import { wikiImageByTitle } from "./api";

const cache = new Map<string, string | null>();

/** Lazily resolves a Wikipedia thumbnail for a title, cached across the session. */
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
      .then((result) => {
        const resolved = result?.url ?? null;
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
