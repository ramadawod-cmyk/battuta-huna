import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentPosition, reverseGeocodeCity } from "./geo";
import { ensureCitySites } from "./sites";
import { db, wikiImageByTitle } from "./api";
import { track } from "./analytics";
import type { Site } from "./types";

const STORAGE_KEY = "bh_current_city";

type CurrentCity = { id: string; name: string; countryId: string; countryName: string };

type CityStatus = "idle" | "locating" | "loading-sites" | "ready" | "error";

type CityContextValue = {
  city: CurrentCity | null;
  sites: Site[];
  heroImageUrl: string | null;
  status: CityStatus;
  error: string | null;
  locate: () => Promise<void>;
};

const CityContext = createContext<CityContextValue>({
  city: null,
  sites: [],
  heroImageUrl: null,
  status: "idle",
  error: null,
  locate: async () => {},
});

async function resolveHeroImage(c: CurrentCity): Promise<string | null> {
  try {
    const hero = await db("getCityHero", { cityId: c.id });
    if (hero?.hero_image_url) return hero.hero_image_url;
  } catch {
    // fall through to wiki lookup
  }
  const wiki = await wikiImageByTitle(c.name).catch(() => null);
  return wiki?.url || null;
}

function loadStoredCity(): CurrentCity | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentCity;
  } catch {
    return null;
  }
}

export function CityProvider({ children }: { children: ReactNode }) {
  const [city, setCity] = useState<CurrentCity | null>(() => loadStoredCity());
  const [sites, setSites] = useState<Site[]>([]);
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<CityStatus>(() => (loadStoredCity() ? "loading-sites" : "idle"));
  const [error, setError] = useState<string | null>(null);
  // Guards against duplicate concurrent loads for the same city — e.g. React StrictMode's
  // deliberate double-invoke of mount effects in development, which would otherwise fire two
  // full ensureCitySites() runs (10 concurrent AI batches instead of 5) for the same city.
  const loadingCityIdRef = useRef<string | null>(null);

  const loadSitesFor = useCallback(async (c: CurrentCity) => {
    if (loadingCityIdRef.current === c.id) return;
    loadingCityIdRef.current = c.id;
    setStatus("loading-sites");
    setHeroImageUrl(null);
    resolveHeroImage(c).then(setHeroImageUrl);
    try {
      const result = await ensureCitySites(c.id, c.name, c.countryId, c.countryName);
      setSites(result);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
      setStatus("error");
    } finally {
      loadingCityIdRef.current = null;
    }
  }, []);

  const locate = useCallback(async () => {
    setStatus("locating");
    setError(null);
    try {
      const pos = await getCurrentPosition();
      const geo = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
      const next: CurrentCity = {
        id: geo.cityId,
        name: geo.cityName,
        countryId: geo.countryId,
        countryName: geo.countryName,
      };
      setCity(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      track("City Auto-Detected", { city: next.name, method: "geocoded" });
      await loadSitesFor(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not detect your location";
      setError(message);
      setStatus("error");
      track("Location Permission Denied", { reason: message });
    }
  }, [loadSitesFor]);

  useEffect(() => {
    if (city) {
      loadSitesFor(city);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CityContext.Provider value={{ city, sites, heroImageUrl, status, error, locate }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  return useContext(CityContext);
}
