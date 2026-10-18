import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getCurrentPosition, reverseGeocodeCity, describeGeolocationError } from "./geo";
import { ensureCitySites } from "./sites";
import { ensureCityHeroImage } from "./cityHero";
import { track } from "./analytics";
import type { Site } from "./types";

const STORAGE_KEY = "bh_current_city";

type CurrentCity = {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  locality?: string | null;
};

type CityStatus = "idle" | "locating" | "loading-sites" | "ready" | "error";

type HeroImageCredit = { name: string; profileUrl: string } | null;

type CityContextValue = {
  city: CurrentCity | null;
  sites: Site[];
  heroImageUrl: string | null;
  heroImageCredit: HeroImageCredit;
  status: CityStatus;
  error: string | null;
  locate: () => Promise<void>;
};

const CityContext = createContext<CityContextValue>({
  city: null,
  sites: [],
  heroImageUrl: null,
  heroImageCredit: null,
  status: "idle",
  error: null,
  locate: async () => {},
});

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
  const [heroImageCredit, setHeroImageCredit] = useState<HeroImageCredit>(null);
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
    setHeroImageCredit(null);
    ensureCityHeroImage(c.id, c.name, c.countryId, c.countryName).then((result) => {
      setHeroImageUrl(result?.url ?? null);
      setHeroImageCredit(
        result?.creditName && result?.creditUrl ? { name: result.creditName, profileUrl: result.creditUrl } : null,
      );
    });
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
        locality: geo.locality,
      };
      setCity(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      track("City Auto-Detected", { city: next.name, method: "geocoded" });
      await loadSitesFor(next);
    } catch (err) {
      const message = describeGeolocationError(err);
      setError(message);
      setStatus("error");
      track("Location Permission Denied", { reason: message });
    }
  }, [loadSitesFor]);

  useEffect(() => {
    if (!city) return;
    loadSitesFor(city);

    // The cached city renders immediately above for a fast paint, but it can go stale --
    // previously it was never re-checked, so a user who last opened the app in one city and now
    // opens it in another (e.g. after traveling) would be stuck seeing the old city indefinitely,
    // with no visible sign anything was wrong. Silently re-resolve the city from a fresh position
    // in the background and correct it if the user has actually moved.
    (async () => {
      try {
        const pos = await getCurrentPosition();
        const geo = await reverseGeocodeCity(pos.coords.latitude, pos.coords.longitude);
        if (geo.cityId === city.id) return;
        const next: CurrentCity = {
          id: geo.cityId,
          name: geo.cityName,
          countryId: geo.countryId,
          countryName: geo.countryName,
          locality: geo.locality,
        };
        setCity(next);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        track("City Auto-Detected", { city: next.name, method: "geocoded-revalidation" });
        await loadSitesFor(next);
      } catch {
        // Keep showing the cached city if a fresh position isn't available right now (permission
        // revoked, offline, timed out) -- the explicit "Try again" error flow covers that case.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CityContext.Provider value={{ city, sites, heroImageUrl, heroImageCredit, status, error, locate }}>
      {children}
    </CityContext.Provider>
  );
}

export function useCity() {
  return useContext(CityContext);
}
