import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BrandMark from "../components/BrandMark";
import SiteDetailModal from "../components/SiteDetailModal";
import { TripGuide, TripItinerary } from "../components/TripContent";
import { db } from "../lib/api";
import { ensureCityTips, type CityTips } from "../lib/cityTips";
import { useTranslation } from "../lib/LanguageContext";
import { GROUP_LABEL_KEYS, PACE_LABEL_KEYS } from "../lib/planFlow";
import { slugify } from "../lib/geo";
import { publicDateLabel } from "../lib/tripSharing";
import { destinationsLabel, tripDestinations } from "../lib/trips";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Trip } from "../lib/types";

// A standalone public page (no <Layout> sidebar, same pattern as "/" and "/auth") -- a stranger
// opening a share link should land on something that reads like a shareable web page, not an app
// screen with "My Trips" in a nav they have no account for. Reuses TripDetail's itinerary/guide
// rendering (TripContent.tsx) with every owner-only action omitted: no edit link, no swap, no
// exact dates (see publicDateLabel -- an exact range is a "this home is empty" signal to a
// stranger). getPublicTrip returns null identically for a private trip and a nonexistent one, so
// this can't be used to probe which trip ids exist.
export default function SharedTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const { t } = useTranslation();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipsByCity, setTipsByCity] = useState<Record<string, CityTips>>({});
  const [activeTab, setActiveTab] = useState<"itinerary" | "guide">("itinerary");
  const [expandedGuideKeys, setExpandedGuideKeys] = useState<Set<string>>(new Set());
  const [selectedSite, setSelectedSite] = useState<{ day: number; slotName: string } | null>(null);
  const heroImageUrl = useWikiThumbnail(trip?.city);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

  useTrackScreen("shared_trip");

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImageUrl]);

  useEffect(() => {
    setLoading(true);
    db("getPublicTrip", { tripId })
      .then((found: Trip | null) => {
        setTrip(found);
        if (!found) return;
        track("Shared Trip Viewed", { trip_id: found.id });
        const destinations = tripDestinations(found);
        setTipsByCity({});
        destinations.forEach((dest) => {
          ensureCityTips(dest.cityId, dest.city)
            .then((cityTips) => {
              if (cityTips) setTipsByCity((prev) => ({ ...prev, [dest.cityId]: cityTips }));
            })
            .catch(() => {});
        });
      })
      .catch(() => setTrip(null))
      .finally(() => setLoading(false));
  }, [tripId]);

  const selectedSiteDay = selectedSite && trip ? trip.days.find((d) => d.day === selectedSite.day) : null;
  const selectedSiteCityName = selectedSiteDay?.city || trip?.city || "";
  const selectedSiteCityId = selectedSiteDay?.cityId || slugify(selectedSiteCityName);

  const metaParts = trip
    ? [
        publicDateLabel(trip),
        trip.group_type ? (GROUP_LABEL_KEYS[trip.group_type] ? t(GROUP_LABEL_KEYS[trip.group_type]) : trip.group_type).toUpperCase() : null,
        trip.pace ? (PACE_LABEL_KEYS[trip.pace] ? t(PACE_LABEL_KEYS[trip.pace]) : trip.pace).toUpperCase() : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between gap-[12px] px-4 sm:px-10 md:px-16 py-[18px] border-b border-text-primary/10">
        <Link to="/" className="flex items-center gap-[8px]">
          <BrandMark className="text-text-primary shrink-0" size={26} />
          <p className="font-heading font-semibold text-[18px] text-text-primary">Battuta</p>
        </Link>
        <Link
          to="/plan"
          onClick={() => track("Plan Your Own Trip Clicked", { source: "shared_trip", trip_id: trip?.id })}
          className="bg-primary-orange text-white text-[12px] sm:text-[13px] font-bold tracking-[0.5px] rounded-[14px] px-[14px] sm:px-[18px] py-[10px] whitespace-nowrap"
        >
          {t("sharedTrip.planYourOwnCta")}
        </Link>
      </header>

      <div className="px-4 sm:px-10 md:px-16 py-6 md:py-[32px] max-w-[900px] mx-auto">
        {loading && <p className="text-text-secondary">{t("common.loading")}</p>}

        {!loading && !trip && (
          <div>
            <p className="font-heading font-semibold text-[20px] text-text-primary">{t("sharedTrip.unavailableTitle")}</p>
            <p className="text-text-secondary text-[13px] mt-[8px]">
              {t("sharedTrip.unavailableBody")}
            </p>
            <Link to="/plan" className="text-secondary-purple text-[13px] font-medium mt-[16px] inline-block">
              {t("sharedTrip.planYourOwnLink")}
            </Link>
          </div>
        )}

        {!loading && trip && (
          <>
            <p className="font-heading font-semibold text-[24px] sm:text-[28px] text-text-primary">
              {destinationsLabel(trip)}
            </p>
            <p className="font-medium text-[11px] text-text-secondary tracking-[1px] mt-[4px]">
              {metaParts.join(" · ")}
            </p>

            <div className="relative mt-[16px] bg-secondary-purple rounded-[24px] w-full h-[200px] sm:h-[240px] overflow-hidden">
              {heroImageUrl && !heroImageFailed && (
                <img
                  src={heroImageUrl}
                  alt={trip.city}
                  onError={() => setHeroImageFailed(true)}
                  className="absolute inset-0 size-full object-cover"
                />
              )}
            </div>

            <div className="flex gap-[12px] mt-[32px]">
              <button
                onClick={() => setActiveTab("itinerary")}
                className={`rounded-[20px] px-[16px] py-[8px] text-[14px] font-semibold transition-colors ${
                  activeTab === "itinerary" ? "bg-surface-lavender text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t("trip.itineraryTab")}
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`rounded-[20px] px-[16px] py-[8px] text-[14px] font-semibold transition-colors ${
                  activeTab === "guide" ? "bg-surface-lavender text-text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t("trip.guideTab")}
              </button>
            </div>

            {activeTab === "itinerary" && (
              <div className="mt-[32px]">
                <TripItinerary trip={trip} onViewDetails={(day, slotName) => setSelectedSite({ day, slotName })} />
              </div>
            )}

            {activeTab === "guide" && (
              <div className="mt-[32px]">
                <TripGuide
                  trip={trip}
                  tipsByCity={tipsByCity}
                  expandedGuideKeys={expandedGuideKeys}
                  onToggleGuideKey={(guideKey) =>
                    setExpandedGuideKeys((prev) => {
                      const next = new Set(prev);
                      if (next.has(guideKey)) next.delete(guideKey);
                      else next.add(guideKey);
                      return next;
                    })
                  }
                />
              </div>
            )}

            {selectedSite && (
              <SiteDetailModal
                siteName={selectedSite.slotName}
                cityId={selectedSiteCityId}
                cityName={selectedSiteCityName}
                source="shared_trip"
                onClose={() => setSelectedSite(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
