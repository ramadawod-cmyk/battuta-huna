import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import BackLink from "../components/BackLink";
import SiteDetailModal from "../components/SiteDetailModal";
import SwapPanel from "../components/SwapPanel";
import TripDayMap from "../components/TripDayMap";
import { TripGuide, TripItinerary } from "../components/TripContent";
import { db, planAgent } from "../lib/api";
import { ARABIC_VOICE_GUIDANCE } from "../lib/arabicVoice";
import { useAuth } from "../lib/AuthContext";
import { useTranslation } from "../lib/LanguageContext";
import { BUDGET_LABEL_KEYS, GROUP_LABEL_KEYS, PACE_LABEL_KEYS } from "../lib/planFlow";
import { slugify } from "../lib/geo";
import { ensureCityTips, type CityTips } from "../lib/cityTips";
import { useCityHeroImage } from "../lib/cityHero";
import UnsplashCredit from "../components/UnsplashCredit";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import { shareUrl } from "../lib/tripSharing";
import { destinationsLabel, tripDestinations } from "../lib/trips";
import type { Trip, TripDay, TripSlot } from "../lib/types";

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session, loading: authLoading } = useAuth();
  const { t, language } = useTranslation();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipsByCity, setTipsByCity] = useState<Record<string, CityTips>>({});
  const [error, setError] = useState<string | null>(null);
  const [generatingWeatherTip, setGeneratingWeatherTip] = useState(false);
  const primaryDestination = trip ? tripDestinations(trip)[0] : null;
  const hero = useCityHeroImage(
    primaryDestination?.cityId,
    primaryDestination?.city,
    primaryDestination?.country ? slugify(primaryDestination.country) : undefined,
    primaryDestination?.country,
  );
  const [activeTab, setActiveTab] = useState<"itinerary" | "guide">("itinerary");
  const [expandedGuideKeys, setExpandedGuideKeys] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<{ day: number; slotName: string } | null>(null);
  const [selectedSite, setSelectedSite] = useState<{ day: number; slotName: string } | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState<{ url: string; copied: boolean } | null>(null);
  // Which day's stops the embedded map (right column) is currently showing -- defaults to the
  // trip's first day once it loads (see the load effect below). null only before that.
  const [activeMapDay, setActiveMapDay] = useState<number | null>(null);
  const [selectedMapSlot, setSelectedMapSlot] = useState<TripSlot | null>(null);
  const activeMapDayData = trip?.days.find((d) => d.day === activeMapDay) || trip?.days[0];
  const mapSlots = useMemo(
    () => (activeMapDayData?.slots || []).filter((s) => !s._removed && s.lat && s.lng),
    [activeMapDayData],
  );

  useTrackScreen("trip_detail");

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    db("getTrips", session?.user?.id ? { authUserId: session.user.id } : {})
      .then((trips: Trip[]) => {
        const found = (trips || []).find((tr) => tr.id === tripId) || null;
        setTrip(found);
        if (!found) {
          setError(t("trip.notFound"));
          return;
        }
        setActiveMapDay(found.days[0]?.day ?? null);
        setSelectedMapSlot(null);
        const destinations = tripDestinations(found);
        track("Trip Detail Viewed", {
          trip_id: found.id,
          city: found.city,
          leg_count: destinations.length,
          status: found.status,
          day_count: found.days?.length || 0,
        });
        setTipsByCity({});
        destinations.forEach((dest) => {
          ensureCityTips(dest.cityId, dest.city)
            .then((cityTips) => {
              if (cityTips) setTipsByCity((prev) => ({ ...prev, [dest.cityId]: cityTips }));
            })
            .catch(() => {});
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("trip.loadFailed")))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id, tripId]);

  // Finishes a feature that's existed in the schema since trip sharing shipped but never had
  // anything call it: lazily generates a bilingual weather/packing tip the first time a trip with
  // none is viewed, the same "generate once, cache on the row" shape as SiteDetailModal's long
  // description. Informed by whatever context Plan.tsx captured (budget, traveler notes) when the
  // trip was built -- absent on any trip created before this existed, which is fine, it just means
  // a shorter prompt.
  useEffect(() => {
    if (!trip || trip.weather_tip || generatingWeatherTip) return;
    setGeneratingWeatherTip(true);
    const system = `You are a travel assistant for Battuta. Write a short, practical weather and packing tip (2-3 sentences) for the trip described below, in both English and Arabic. No markdown, no bullet points, no em dashes. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON object, no prose, no markdown fences: {"tip": string, "tipAr": string}.`;
    const context = [
      `Destination(s): ${destinationsLabel(trip)}`,
      trip.dates ? `Travel dates: ${trip.dates}` : null,
      trip.duration ? `Duration: ${trip.duration} days` : null,
      trip.budget ? `Budget: ${trip.budget}` : null,
      trip.traveler_notes ? `Traveler notes: ${trip.traveler_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    planAgent(system, [{ role: "user", content: context }])
      .then(async (text) => {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1) return;
        const parsed = JSON.parse(text.slice(start, end + 1));
        const tip = typeof parsed.tip === "string" ? parsed.tip.trim() : "";
        const tipAr = typeof parsed.tipAr === "string" ? parsed.tipAr.trim() : null;
        if (!tip) return;
        setTrip((prev) => (prev ? { ...prev, weather_tip: tip, weather_tip_ar: tipAr } : prev));
        await db("saveWeatherTip", { tripId: trip.id, weatherTip: tip, weatherTipAr: tipAr });
      })
      .catch(() => {
        // Best-effort, same tolerance as every other on-demand generation in this app -- the trip
        // just keeps showing no weather tip until a later visit tries again.
      })
      .finally(() => setGeneratingWeatherTip(false));
  }, [trip, generatingWeatherTip]);

  if (loading) {
    return <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] text-text-secondary">{t("tripDetail.loading")}</div>;
  }

  if (error || !trip) {
    return (
      <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px]">
        <p className="text-text-primary">{error || t("trip.notFound")}</p>
        <BackLink to="/my-trips" labelKey="common.backToMyTrips" className="text-[13px] font-medium text-text-secondary mt-[16px]" />
      </div>
    );
  }

  const metaParts = [
    trip.duration ? t("trip.daysUnit", { count: trip.duration }) : null,
    trip.group_type ? (GROUP_LABEL_KEYS[trip.group_type] ? t(GROUP_LABEL_KEYS[trip.group_type]) : trip.group_type).toUpperCase() : null,
    trip.pace ? (PACE_LABEL_KEYS[trip.pace] ? t(PACE_LABEL_KEYS[trip.pace]) : trip.pace).toUpperCase() : null,
    trip.budget ? (BUDGET_LABEL_KEYS[trip.budget] ? t(BUDGET_LABEL_KEYS[trip.budget]) : trip.budget).toUpperCase() : null,
  ].filter(Boolean);
  const isMultiCity = tripDestinations(trip).length > 1;

  async function copyShareLink(id: string) {
    const url = shareUrl(window.location.origin, id);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Clipboard access can fail -- permissions, insecure context, or a browser (Safari, Firefox
      // are stricter than Chrome here) that gates it behind conditions this click may not satisfy.
      // Falls through to showing the raw link below so the traveller can still grab it manually,
      // rather than the toggle silently succeeding with zero visible feedback.
    }
    setLinkCopied({ url, copied });
    setTimeout(() => setLinkCopied(null), 4000);
  }

  async function handleShareToggle() {
    if (!trip || sharingBusy) return;
    const nextIsPublic = !trip.is_public;
    setSharingBusy(true);
    setShareError(null);
    try {
      await db("setTripVisibility", { tripId: trip.id, isPublic: nextIsPublic });
      setTrip({ ...trip, is_public: nextIsPublic });
      track(nextIsPublic ? "Trip Shared" : "Trip Unshared", { trip_id: trip.id });
      if (nextIsPublic) await copyShareLink(trip.id);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : t("tripDetail.shareUpdateFailed"));
    } finally {
      setSharingBusy(false);
    }
  }

  const selectedSiteDay = selectedSite ? trip.days.find((d) => d.day === selectedSite.day) : null;
  const selectedSiteCityName = selectedSiteDay?.city || trip.city;
  const selectedSiteCityId = selectedSiteDay?.cityId || slugify(selectedSiteCityName);

  return (
    // Persistent split view (see mindtrip.ai/explore for the reference) instead of a map embedded
    // partway down a normal scrollable page: left pane scrolls independently, right pane is a
    // full-height, edge-to-edge map that never moves. md:h-[100dvh] on desktop (no mobile header to
    // clear); h-[calc(100dvh-60px)] on mobile matches MobileHeader's fixed 60px bar, same formula
    // Plan.tsx's chat phase already uses for the same reason.
    <div className="flex h-[calc(100dvh-60px)] md:h-[100dvh]">
    <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[32px]">
      <BackLink to="/my-trips" labelKey="common.backToMyTrips" className="text-[13px] font-medium text-text-secondary" />

      <div className="flex items-start justify-between gap-[16px] mt-[24px] sm:mt-[32px]">
        <div className="min-w-0">
          <p className="font-heading font-semibold text-[20px] sm:text-[24px] text-text-primary truncate">
            {destinationsLabel(trip)}
          </p>
          <p className="font-medium text-[11px] text-text-secondary tracking-[1px] mt-[4px]">{metaParts.join(" · ")}</p>
        </div>
        <div className="flex gap-[8px] sm:gap-[16px] shrink-0 items-start">
          <div className="relative">
            <button
              onClick={trip.is_public ? () => copyShareLink(trip.id) : handleShareToggle}
              disabled={sharingBusy}
              className="h-[36px] sm:h-[44px] px-[14px] sm:w-[140px] rounded-[14px] border-[1.5px] border-secondary-purple bg-transparent flex items-center justify-center font-bold text-[12px] sm:text-[14px] tracking-[0.56px] text-secondary-purple transition-opacity hover:opacity-90 whitespace-nowrap disabled:opacity-50"
            >
              {trip.is_public ? t("tripDetail.copyLink") : t("tripDetail.share")}
            </button>
            {linkCopied && (
              <p className="absolute top-full end-0 mt-[6px] text-[11px] text-secondary-purple whitespace-nowrap max-w-[260px] truncate">
                {linkCopied.copied ? t("tripDetail.linkCopied") : linkCopied.url}
              </p>
            )}
          </div>
          <Link
            to={`/trip/${tripId}/customise`}
            onClick={() => track("Trip Edit Started", { trip_id: trip.id, city: trip.city })}
            className="h-[36px] sm:h-[44px] px-[14px] sm:w-[140px] rounded-[14px] border-[1.5px] border-text-primary bg-transparent flex items-center justify-center font-bold text-[12px] sm:text-[14px] tracking-[0.56px] text-text-secondary transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            {t("tripDetail.editTrip")}
          </Link>
        </div>
      </div>

      {trip.is_public && (
        <p className="text-[11px] text-text-secondary mt-[8px]">
          {t("tripDetail.shareableNotice")}{" "}
          <button onClick={handleShareToggle} disabled={sharingBusy} className="underline hover:text-text-primary disabled:opacity-50">
            {t("tripDetail.stopSharing")}
          </button>
        </p>
      )}

      {shareError && <p className="text-primary-orange text-[12px] mt-[8px]">{shareError}</p>}

      <div className="relative mt-[16px] bg-secondary-purple rounded-[24px] w-full h-[200px] sm:h-[240px] overflow-hidden">
        {hero.displayedUrl && (
          <img
            src={hero.displayedUrl}
            alt={trip.city}
            onError={hero.onImgError}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {hero.credit && <UnsplashCredit name={hero.credit.name} profileUrl={hero.credit.profileUrl} />}
      </div>

      {(language === "ar" ? trip.weather_tip_ar || trip.weather_tip : trip.weather_tip) && (
        <p className="text-[13px] text-text-secondary mt-[16px]">
          {language === "ar" ? trip.weather_tip_ar || trip.weather_tip : trip.weather_tip}
        </p>
      )}

      <div className="flex items-center justify-between gap-[16px] mt-[32px] flex-wrap">
        <div className="flex gap-[12px]">
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

        {/* Day filter for the embedded map, raised to the same row as Itinerary/Travel Guide
            (rather than sitting inside the map column below) so it reads as one tab bar. Hidden
            below lg since the map panel itself is lg+ only. */}
        {activeTab === "itinerary" && trip.days.length > 1 && (
          <div className="hidden lg:flex gap-[8px] flex-wrap">
            {trip.days.map((day) => (
              <button
                key={day.day}
                type="button"
                onClick={() => {
                  setActiveMapDay(day.day);
                  setSelectedMapSlot(null);
                }}
                className={`rounded-[16px] px-[14px] py-[7px] text-[12px] font-medium transition-colors ${
                  activeMapDay === day.day
                    ? "bg-secondary-purple text-white"
                    : "bg-white border border-secondary-purple text-text-primary"
                }`}
              >
                {t("trip.dayLabel", { number: day.day })}
                {isMultiCity && day.city ? ` · ${day.city}` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {activeTab === "itinerary" && (
        <div className="mt-[32px]">
          <TripItinerary
            trip={trip}
            onViewDetails={(day, slotName) => setSelectedSite({ day, slotName })}
            onSwap={(day, slotName) => setSwapTarget({ day, slotName })}
            onViewMapForDay={(day) => {
              setActiveMapDay(day);
              setSelectedMapSlot(null);
            }}
            activeDayForMap={activeMapDay ?? undefined}
          />
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

      {swapTarget && (
        <SwapPanel
          trip={trip}
          tripId={trip.id}
          day={swapTarget.day}
          slotName={swapTarget.slotName}
          onClose={() => setSwapTarget(null)}
          onSwapped={(updatedDays: TripDay[]) => {
            setTrip({ ...trip, days: updatedDays });
            setSwapTarget(null);
          }}
        />
      )}

      {selectedSite && (
        <SiteDetailModal
          siteName={selectedSite.slotName}
          cityId={selectedSiteCityId}
          cityName={selectedSiteCityName}
          source="trip_detail"
          onClose={() => setSelectedSite(null)}
        />
      )}
    </div>

    {/* Persistent map pane -- stays visible across both tabs (not just itinerary), same "map
        never moves" feel as the mindtrip reference, but with a white margin around the map
        itself (flush-to-edge read as too harsh/heavy) rather than true edge-to-edge. */}
    <div className="hidden lg:block w-[40%] shrink-0 h-full border-s border-text-primary/15 bg-white p-[16px]">
      {mapSlots.length === 0 ? (
        <div className="size-full rounded-[20px] bg-surface-lavender/40 flex items-center justify-center text-text-secondary text-[13px] text-center p-[24px]">
          {t("tripMap.noLocatedStops")}
        </div>
      ) : (
        <TripDayMap
          slots={mapSlots}
          selectedSlot={selectedMapSlot}
          onSelectSlot={setSelectedMapSlot}
          className="size-full rounded-[20px] overflow-hidden"
        />
      )}
    </div>
    </div>
  );
}
