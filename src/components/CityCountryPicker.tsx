import { useState, type FormEvent } from "react";
import { useTranslation } from "../lib/LanguageContext";
import { COUNTRIES } from "../lib/countries";

/**
 * Lets a traveller manually choose a country + city to explore, independent of geolocation --
 * visible whether Explore's own location detection succeeded, failed, or was never granted.
 * Submitting hands the pick back to Explore.tsx, which drives it through the same override
 * mechanism already used by links from the Plan page's suggestions panel.
 */
export default function CityCountryPicker({
  onPick,
  overrideActive,
  onReset,
}: {
  onPick: (countryId: string, countryName: string, cityName: string) => void;
  overrideActive: boolean;
  onReset: () => void;
}) {
  const { t, language } = useTranslation();
  const [countryId, setCountryId] = useState("");
  const [cityName, setCityName] = useState("");

  // English alphabetical order would read oddly for someone selecting in Arabic -- sort by
  // whichever label is actually shown.
  const sortedCountries = [...COUNTRIES].sort((a, b) => {
    const labelA = language === "ar" ? a.nameAr : a.name;
    const labelB = language === "ar" ? b.nameAr : b.name;
    return labelA.localeCompare(labelB, language);
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const country = COUNTRIES.find((c) => c.id === countryId);
    const trimmedCity = cityName.trim();
    if (!country || !trimmedCity) return;
    // countryName is always the canonical English form (same convention as the AI-generated
    // destinations in popularDestinations.ts) so the same country picked under either language
    // resolves to the same cached country_id/row.
    onPick(country.id, country.name, trimmedCity);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-[10px] mt-[16px]">
      <div className="flex flex-col gap-[4px]">
        <label htmlFor="explore-country" className="text-[11px] font-medium text-text-secondary">
          {t("explore.pickCountry")}
        </label>
        <select
          id="explore-country"
          value={countryId}
          onChange={(e) => setCountryId(e.target.value)}
          className="bg-surface-lavender/40 border border-border rounded-[12px] text-[13px] text-text-primary px-[12px] py-[9px] min-w-[170px]"
        >
          <option value="">{t("explore.selectCountry")}</option>
          {sortedCountries.map((c) => (
            <option key={c.id} value={c.id}>
              {language === "ar" ? c.nameAr : c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-[4px]">
        <label htmlFor="explore-city" className="text-[11px] font-medium text-text-secondary">
          {t("explore.pickCity")}
        </label>
        <input
          id="explore-city"
          type="text"
          value={cityName}
          onChange={(e) => setCityName(e.target.value)}
          placeholder={t("explore.cityPlaceholder")}
          className="bg-surface-lavender/40 border border-border rounded-[12px] text-[13px] text-text-primary px-[12px] py-[9px] min-w-[160px]"
        />
      </div>
      <button
        type="submit"
        disabled={!countryId || !cityName.trim()}
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
