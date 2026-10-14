import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCity } from "../lib/CityContext";
import { useTranslation } from "../lib/LanguageContext";
import { ensureTopSitesPreview } from "../lib/sitesPreview";
import { ensurePopularDestinations, type PopularDestination } from "../lib/popularDestinations";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { slugify } from "../lib/geo";
import { track } from "../lib/analytics";
import ImagePlaceholder from "./ImagePlaceholder";
import type { PlanLeg } from "../lib/planFlow";
import type { Site } from "../lib/types";

function exploreUrl(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
  siteName?: string,
): string {
  const params = new URLSearchParams({ cityId, cityName, countryId, countryName });
  if (siteName) params.set("site", siteName);
  return `/explore?${params.toString()}`;
}

function SuggestionCard({
  imageQuery,
  fallbackImageUrl,
  title,
  subtitle,
  onClick,
}: {
  imageQuery: string;
  fallbackImageUrl?: string | null;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const wikiImage = useWikiThumbnail(imageQuery);
  const imageUrl = fallbackImageUrl || wikiImage;
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-start w-full bg-white border border-secondary-purple rounded-[20px] overflow-hidden hover:bg-surface-lavender/40 transition-colors"
    >
      <div className="relative w-full h-[90px] bg-surface-lavender">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
      </div>
      <div className="p-[14px]">
        <p className="font-heading font-semibold text-[14px] text-text-primary leading-tight">{title}</p>
        <p className="text-[12px] text-text-secondary mt-[4px] leading-[1.4] line-clamp-2">{subtitle}</p>
      </div>
    </button>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-[12px]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[150px] rounded-[20px] bg-surface-lavender/60 animate-pulse" />
      ))}
    </div>
  );
}

export default function PlanSuggestionsPanel({ destination }: { destination: PlanLeg | null }) {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { city: homeCity, status: homeStatus, locate } = useCity();

  const [destinations, setDestinations] = useState<PopularDestination[] | null>(null);
  const [citySites, setCitySites] = useState<Site[] | null>(null);

  useEffect(() => {
    if (destination) return;
    if (homeStatus === "idle") locate();
  }, [destination, homeStatus, locate]);

  useEffect(() => {
    if (destination || !homeCity) return;
    let cancelled = false;
    setDestinations(null);
    ensurePopularDestinations(homeCity.name, homeCity.countryName)
      .then((result) => { if (!cancelled) setDestinations(result); })
      .catch(() => { if (!cancelled) setDestinations([]); });
    return () => { cancelled = true; };
  }, [destination, homeCity?.id, homeCity?.name, homeCity?.countryName]);

  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    setCitySites(null);
    const cityId = slugify(destination.city);
    ensureTopSitesPreview(cityId, destination.city, destination.country_id, destination.country)
      .then((result) => { if (!cancelled) setCitySites(result); })
      .catch(() => { if (!cancelled) setCitySites([]); });
    return () => { cancelled = true; };
  }, [destination?.city, destination?.country_id, destination?.country]);

  if (destination) {
    const cityId = slugify(destination.city);
    return (
      <div className="flex flex-col gap-[16px]">
        <p className="font-heading font-semibold text-[14px] text-text-primary">
          {t("plan.panel.popularIn", { city: destination.city })}
        </p>
        {citySites === null && <PanelSkeleton />}
        {citySites?.length === 0 && <p className="text-[12px] text-text-secondary">{t("plan.panel.noSites")}</p>}
        <div className="flex flex-col gap-[12px]">
          {citySites?.map((site) => (
            <SuggestionCard
              key={site.id}
              imageQuery={site.name}
              fallbackImageUrl={site.image_url}
              title={(language === "ar" && site.name_ar) || site.name}
              subtitle={(language === "ar" && site.description_ar) || site.description}
              onClick={() => {
                track("Popular Site Clicked", { city_id: cityId, site_name: site.name, source: "plan_panel" });
                navigate(exploreUrl(cityId, destination.city, destination.country_id, destination.country, site.name));
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (homeStatus === "error") return null;

  return (
    <div className="flex flex-col gap-[16px]">
      <p className="font-heading font-semibold text-[14px] text-text-primary">
        {homeCity ? t("plan.panel.popularFrom", { city: homeCity.name }) : t("plan.panel.popularGeneric")}
      </p>
      {destinations === null && <PanelSkeleton />}
      <div className="flex flex-col gap-[12px]">
        {destinations?.map((d) => {
          const dCityId = slugify(d.city);
          const dCountryId = slugify(d.country);
          return (
            <SuggestionCard
              key={d.city}
              imageQuery={d.city}
              title={language === "ar" ? d.cityAr : d.city}
              subtitle={language === "ar" ? d.reasonAr : d.reason}
              onClick={() => {
                track("Destination Suggestion Clicked", { city_id: dCityId, city_name: d.city, source: "plan_panel" });
                navigate(exploreUrl(dCityId, d.city, dCountryId, d.country));
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
