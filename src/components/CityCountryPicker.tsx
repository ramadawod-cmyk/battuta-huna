import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "../lib/LanguageContext";
import { COUNTRIES } from "../lib/countries";
import { CITIES, type CityOption } from "../lib/cities";
import { db } from "../lib/api";
import type { City } from "../lib/types";

const MAX_SUGGESTIONS = 8;

type ResolvedCountry = { id: string; name: string };

/**
 * Lets a traveller manually search for a city to explore, independent of geolocation -- visible
 * whether Explore's own location detection succeeded, failed, or was never granted. There's no
 * separate country field: the country is resolved behind the scenes (see resolveCountry) from
 * whichever city gets submitted, same way geo.ts's reverseGeocodeCity already falls back to
 * "Unknown" when a country genuinely can't be determined. Submitting hands the pick back to
 * Explore.tsx, which drives it through the same override mechanism already used by links from the
 * Plan page's suggestions panel.
 */
export default function CityCountryPicker({
  currentCity,
  onPick,
  overrideActive,
  onReset,
}: {
  // Whatever city Explore is currently showing (auto-detected or already overridden) -- prefills
  // the field so the picker reads as "here's what you're looking at, change it if you want"
  // instead of a blank form next to an already-populated page.
  currentCity: { name: string; countryId: string } | null;
  onPick: (countryId: string, countryName: string, cityName: string) => void;
  overrideActive: boolean;
  onReset: () => void;
}) {
  const { t, language } = useTranslation();
  const [cityName, setCityName] = useState("");
  // Not shown in the UI -- tracks the best-known country for whatever's in the city field, updated
  // whenever that's unambiguous (prefill, picking a suggestion) and re-checked against an exact
  // name match at submit time.
  const [resolvedCountry, setResolvedCountry] = useState<ResolvedCountry | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  // The real, ever-growing catalog (every city a traveller has already explored) -- merged with
  // the static CITIES bootstrap list below so search coverage improves over time without that
  // static list needing to be exhaustive. Fetched once; this list only grows, no need to refetch.
  const [catalogCities, setCatalogCities] = useState<City[]>([]);

  useEffect(() => {
    db("getCities")
      .then((rows: City[]) => setCatalogCities(Array.isArray(rows) ? rows : []))
      .catch(() => {});
  }, []);

  // countryId here and in countries.ts are both slugify(name), so comparing by id is equivalent
  // to a case/accent-insensitive name match without a second normalization step.
  useEffect(() => {
    if (!currentCity) return;
    const match = COUNTRIES.find((c) => c.id === currentCity.countryId);
    setResolvedCountry(match ? { id: match.id, name: match.name } : null);
    setCityName(currentCity.name);
  }, [currentCity?.countryId, currentCity?.name]);

  // Static entries carry an Arabic name and win on an id collision (e.g. a catalog row for a city
  // also in the bootstrap list); catalog-only entries fill in everything this static list misses.
  const allCities = useMemo<CityOption[]>(() => {
    const byId = new Map<string, CityOption>();
    for (const c of catalogCities) {
      byId.set(c.id, { id: c.id, name: c.name, nameAr: "", countryId: c.country_id });
    }
    for (const c of CITIES) byId.set(c.id, c);
    return [...byId.values()];
  }, [catalogCities]);

  const suggestions = useMemo(() => {
    const query = cityName.trim().toLowerCase();
    if (!query) return [];
    const matches = allCities.filter((c) => c.name.toLowerCase().includes(query));
    matches.sort((a, b) => {
      const aInCountry = a.countryId === resolvedCountry?.id ? 0 : 1;
      const bInCountry = b.countryId === resolvedCountry?.id ? 0 : 1;
      if (aInCountry !== bInCountry) return aInCountry - bInCountry;
      const aStarts = a.name.toLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    });
    return matches.slice(0, MAX_SUGGESTIONS);
  }, [allCities, cityName, resolvedCountry]);

  function selectSuggestion(city: CityOption) {
    setCityName(city.name);
    const country = COUNTRIES.find((c) => c.id === city.countryId);
    if (country) setResolvedCountry({ id: country.id, name: country.name });
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }

  function handleCityKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  // Prefers an exact match on whatever's currently typed (covers both an explicit pick and a city
  // typed out in full without using the dropdown) over the last resolved country, since the typed
  // text is the more current signal; only falls back to "Unknown" when neither gives an answer --
  // the same last resort geo.ts's reverseGeocodeCity already uses.
  function resolveCountry(): ResolvedCountry {
    const typed = cityName.trim().toLowerCase();
    const exactCity = allCities.find((c) => c.name.toLowerCase() === typed);
    const exactCountry = exactCity && COUNTRIES.find((c) => c.id === exactCity.countryId);
    if (exactCountry) return { id: exactCountry.id, name: exactCountry.name };
    if (resolvedCountry) return resolvedCountry;
    return { id: "unknown", name: "Unknown" };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedCity = cityName.trim();
    if (!trimmedCity) return;
    const country = resolveCountry();
    // countryName is always the canonical English form (same convention as the AI-generated
    // destinations in popularDestinations.ts) so the same country picked under either language
    // resolves to the same cached country_id/row.
    onPick(country.id, country.name, trimmedCity);
    setShowSuggestions(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-[10px] mt-[16px]">
      <div className="relative flex flex-col gap-[4px]">
        <label htmlFor="explore-city" className="text-[11px] font-medium text-text-secondary">
          {t("explore.pickCity")}
        </label>
        <input
          id="explore-city"
          type="text"
          autoComplete="off"
          value={cityName}
          onChange={(e) => {
            setCityName(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          onKeyDown={handleCityKeyDown}
          placeholder={t("explore.cityPlaceholder")}
          className="bg-surface-lavender/40 border border-border rounded-[12px] text-[13px] text-text-primary px-[12px] py-[9px] min-w-[220px]"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute top-full mt-[4px] w-full min-w-[260px] bg-white border border-border rounded-[12px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.12)] py-[6px] z-10 max-h-[240px] overflow-y-auto">
            {suggestions.map((city, i) => {
              const country = COUNTRIES.find((c) => c.id === city.countryId);
              return (
                <li key={`${city.countryId}-${city.id}`}>
                  <button
                    type="button"
                    // Fires before the input's onBlur, so the dropdown can't close itself out from
                    // under the click.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(city)}
                    className={`w-full text-start px-[14px] py-[8px] text-[13px] ${
                      i === highlightedIndex ? "bg-surface-lavender/60" : "hover:bg-surface-lavender/40"
                    }`}
                  >
                    <span className="text-text-primary font-medium">
                      {language === "ar" && city.nameAr ? city.nameAr : city.name}
                    </span>
                    {country && (
                      <span className="text-text-secondary text-[11px] ms-[6px]">
                        {language === "ar" ? country.nameAr : country.name}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <button
        type="submit"
        disabled={!cityName.trim()}
        className="bg-secondary-purple text-white text-[13px] font-semibold rounded-[12px] px-[18px] py-[10px] disabled:opacity-40"
      >
        {t("explore.goExplore")}
      </button>
      {overrideActive && (
        <button
          type="button"
          onClick={onReset}
          className="text-[12px] font-medium text-secondary-purple underline hover:opacity-70 transition-opacity px-[4px] py-[10px]"
        >
          {t("explore.backToMyLocation")}
        </button>
      )}
    </form>
  );
}
