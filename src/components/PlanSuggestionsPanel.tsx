import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCity } from "../lib/CityContext";
import { useTranslation } from "../lib/LanguageContext";
import { ensureTopSitesPreview } from "../lib/sitesPreview";
import { ensurePopularDestinations, type PopularDestination } from "../lib/popularDestinations";
import { ensureCityHeroImage } from "../lib/cityHero";
import { ensureSiteImage } from "../lib/siteImage";
import { slugify } from "../lib/geo";
import { track } from "../lib/analytics";
import ImagePlaceholder from "./ImagePlaceholder";
import UnsplashCredit from "./UnsplashCredit";
import { CATEGORY_ACCENTS, CATEGORY_LABEL_KEYS, normalizeCategory, type CategoryAccent } from "../lib/categories";
import type { PlanLeg } from "../lib/planFlow";
import type { Site } from "../lib/types";

const CATEGORY_TEXT_CLASSES: Record<CategoryAccent, string> = {
  purple: "text-secondary-purple",
  orange: "text-primary-orange",
  coral: "text-error",
  teal: "text-tertiary-teal",
};

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

/** Styled to match PoiCard (used on the Explore page) so the panel feels like the same app. */
function SuggestionCard({
  imageUrl,
  imageCredit,
  title,
  subtitle,
  category,
  categoryAccent = "purple",
  onClick,
}: {
  imageUrl: string | null;
  imageCredit?: { name: string; profileUrl: string } | null;
  title: string;
  subtitle: string;
  category?: string;
  categoryAccent?: CategoryAccent;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative bg-white border border-secondary-purple rounded-[20px] p-[16px] flex flex-col">
      <div className="flex gap-3">
        {/* aspect-square + self-stretch: a square that matches the height of the title/subtitle block beside it, not the view-more link below */}
        <div className="relative bg-surface-lavender rounded-[12px] aspect-square self-stretch shrink-0 overflow-hidden">
          {imageUrl ? (
            <img src={imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlaceholder />
          )}
          {imageCredit && <UnsplashCredit name={imageCredit.name} profileUrl={imageCredit.profileUrl} compact />}
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          {/* pe-8 reserves room for a future top-right action (like/more) button, not added yet */}
          <button type="button" className="text-start pe-8" onClick={onClick}>
            <p className="font-heading font-semibold text-[15px] text-text-primary leading-tight">{title}</p>
            {category && (
              <p className={`font-medium text-[11px] ${CATEGORY_TEXT_CLASSES[categoryAccent]} tracking-[0.44px] mt-[3px]`}>
                {category}
              </p>
            )}
          </button>
          <p className="text-[12px] leading-[1.5] text-text-primary mt-[8px] line-clamp-2">{subtitle}</p>
        </div>
      </div>
      <div className="flex justify-end mt-[8px]">
        <button
          type="button"
          onClick={onClick}
          className="text-[12px] font-medium text-secondary-purple underline hover:opacity-70 transition-opacity"
        >
          {t("poiCard.viewMore")}
        </button>
      </div>
    </div>
  );
}

/** Resolves + persists its own hero image (see ensureCityHeroImage) before rendering a card. */
function DestinationCard({
  destination,
  title,
  subtitle,
  onClick,
}: {
  destination: PopularDestination;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const [image, setImage] = useState<{ url: string; creditName: string | null; creditUrl: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const cityId = slugify(destination.city);
    const countryId = slugify(destination.country);
    ensureCityHeroImage(cityId, destination.city, countryId, destination.country).then((result) => {
      if (!cancelled) setImage(result);
    });
    return () => { cancelled = true; };
  }, [destination.city, destination.country]);

  const imageCredit = image?.creditName && image?.creditUrl ? { name: image.creditName, profileUrl: image.creditUrl } : null;
  return (
    <SuggestionCard imageUrl={image?.url ?? null} imageCredit={imageCredit} title={title} subtitle={subtitle} onClick={onClick} />
  );
}

/** Resolves + persists its own image (see ensureSiteImage) before rendering a card. */
function SiteCard({
  site,
  cityId,
  title,
  subtitle,
  onClick,
}: {
  site: Site;
  cityId: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(site.image_url || null);
  useEffect(() => {
    if (site.image_url) return;
    let cancelled = false;
    ensureSiteImage(site, cityId).then((url) => { if (!cancelled) setImageUrl(url); });
    return () => { cancelled = true; };
  }, [site.id, site.image_url, cityId]);

  const category = normalizeCategory(site.category);
  return (
    <SuggestionCard
      imageUrl={imageUrl}
      title={title}
      subtitle={subtitle}
      category={t(CATEGORY_LABEL_KEYS[category]).toUpperCase()}
      categoryAccent={CATEGORY_ACCENTS[category]}
      onClick={onClick}
    />
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
            <SiteCard
              key={site.id}
              site={site}
              cityId={cityId}
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
            <DestinationCard
              key={d.city}
              destination={d}
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
