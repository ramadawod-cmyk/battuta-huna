import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Map } from "lucide-react";
import swapIcon from "../assets/trip-detail/swap-icon.svg";
import SiteDetailModal from "../components/SiteDetailModal";
import SwapPanel from "../components/SwapPanel";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { slugify } from "../lib/geo";
import { formatDuration } from "../lib/categories";
import { ensureCityTips, type CityTips } from "../lib/cityTips";
import { GUIDE_ACCENT_CLASSES, GUIDE_META } from "../lib/guideMeta";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import { destinationsLabel, legsFromDays, tripDestinations } from "../lib/trips";
import type { Trip, TripDay, TripSlot } from "../lib/types";

function ItinerarySlotRow({
  slot,
  onSwap,
  onViewDetails,
}: {
  slot: TripSlot;
  onSwap: () => void;
  onViewDetails: () => void;
}) {
  const imageUrl = useWikiThumbnail(slot.name);
  return (
    <div className="flex items-start gap-[16px] py-[10px]">
      <div className="w-[80px] shrink-0 mt-[2px]">
        <p className="text-[12px] font-medium text-text-secondary">{slot.time}</p>
        {slot.durationMinutes && (
          <p className="text-[11px] text-text-secondary/70 mt-[2px]">{formatDuration(slot.durationMinutes)}</p>
        )}
      </div>
      <button onClick={onViewDetails} className="flex items-start gap-[16px] flex-1 min-w-0 text-left">
        <div className="size-[56px] shrink-0 rounded-[12px] bg-surface-lavender overflow-hidden">
          {imageUrl && <img src={imageUrl} alt="" className="size-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[8px]">
            <p className="font-heading font-semibold text-[16px] text-text-primary">{slot.name}</p>
            {slot.kind === "activity" && (
              <span className="shrink-0 rounded-[8px] bg-secondary-purple/15 text-secondary-purple text-[10px] font-bold tracking-[0.4px] px-[6px] py-[2px]">
                ACTIVITY
              </span>
            )}
          </div>
          <p className="text-[13px] leading-[1.4] text-text-secondary mt-[6px]">{slot.description}</p>
        </div>
      </button>
      <button onClick={onSwap} aria-label={`Swap ${slot.name}`} className="shrink-0 size-[32px]">
        <img src={swapIcon} alt="" className="size-full" />
      </button>
    </div>
  );
}

function GuideCard({
  tipKey,
  value,
  expanded,
  onToggle,
}: {
  tipKey: string;
  value: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = GUIDE_META[tipKey];
  const title = meta?.title || tipKey;
  const Icon = meta?.icon;
  const accentClasses = GUIDE_ACCENT_CLASSES[meta?.accent || "purple"];
  const isLong = value.length > 100;
  return (
    <div className="bg-white border border-border rounded-[16px] p-[16px]">
      <div className="flex items-center gap-[10px]">
        <div className={`size-[36px] rounded-full flex items-center justify-center shrink-0 ${accentClasses.bg}`}>
          {Icon && <Icon className={`size-[18px] ${accentClasses.text}`} strokeWidth={2} />}
        </div>
        <p className="font-heading font-semibold text-[14px] text-text-primary">{title}</p>
      </div>
      <p className={`text-[12px] leading-[1.4] text-text-secondary mt-[10px] ${expanded ? "" : "line-clamp-2"}`}>
        {value}
      </p>
      {isLong && (
        <button onClick={onToggle} className="text-[12px] font-medium text-secondary-purple mt-[6px]">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipsByCity, setTipsByCity] = useState<Record<string, CityTips>>({});
  const [error, setError] = useState<string | null>(null);
  const heroImageUrl = useWikiThumbnail(trip?.city);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<"itinerary" | "guide">("itinerary");
  const [expandedGuideKeys, setExpandedGuideKeys] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<{ day: number; slotName: string } | null>(null);
  const [selectedSite, setSelectedSite] = useState<{ day: number; slotName: string } | null>(null);

  useTrackScreen("trip_detail");

  useEffect(() => {
    setHeroImageFailed(false);
  }, [heroImageUrl]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    db("getTrips", session?.user?.id ? { authUserId: session.user.id } : {})
      .then((trips: Trip[]) => {
        const found = (trips || []).find((t) => t.id === tripId) || null;
        setTrip(found);
        if (!found) {
          setError("Trip not found.");
          return;
        }
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
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip"))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id, tripId]);

  if (loading) {
    return <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] text-text-secondary">Loading trip…</div>;
  }

  if (error || !trip) {
    return (
      <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px]">
        <p className="text-text-primary">{error || "Trip not found."}</p>
        <Link to="/my-trips" className="text-[13px] font-medium text-text-secondary mt-[16px] inline-block">
          ← Back to My Trips
        </Link>
      </div>
    );
  }

  const metaParts = [
    trip.duration ? `${trip.duration} DAYS` : null,
    trip.group_type?.toUpperCase(),
    trip.pace?.toUpperCase(),
  ].filter(Boolean);

  const destinations = tripDestinations(trip);
  const isMultiCity = destinations.length > 1;
  const visibleDays = trip.days.filter((day) => day.slots.some((s) => !s._removed));
  const itineraryLegs = legsFromDays(visibleDays);
  const selectedSiteDay = selectedSite ? trip.days.find((d) => d.day === selectedSite.day) : null;
  const selectedSiteCityName = selectedSiteDay?.city || trip.city;
  const selectedSiteCityId = selectedSiteDay?.cityId || slugify(selectedSiteCityName);

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[32px]">
      <Link to="/my-trips" className="text-[13px] font-medium text-text-secondary">
        ← Back to My Trips
      </Link>

      <div className="flex items-start justify-between gap-[16px] mt-[24px] sm:mt-[32px]">
        <div className="min-w-0">
          <p className="font-heading font-semibold text-[20px] sm:text-[24px] text-text-primary truncate">
            {destinationsLabel(trip)}
          </p>
          <p className="font-medium text-[11px] text-text-secondary tracking-[1px] mt-[4px]">{metaParts.join(" · ")}</p>
        </div>
        <div className="flex gap-[8px] sm:gap-[16px] shrink-0">
          <Link
            to={`/trip/${tripId}/customise`}
            onClick={() => track("Trip Edit Started", { trip_id: trip.id, city: trip.city })}
            className="h-[36px] sm:h-[44px] px-[14px] sm:w-[140px] rounded-[14px] border-[1.5px] border-text-primary bg-transparent flex items-center justify-center font-bold text-[12px] sm:text-[14px] tracking-[0.56px] text-text-secondary transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            EDIT TRIP
          </Link>
        </div>
      </div>

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

      {trip.weather_tip && (
        <p className="text-[13px] text-text-secondary mt-[16px]">{trip.weather_tip}</p>
      )}

      <div className="flex gap-[12px] mt-[32px]">
        <button
          onClick={() => setActiveTab("itinerary")}
          className={`rounded-[20px] px-[16px] py-[8px] text-[14px] font-semibold transition-colors ${
            activeTab === "itinerary" ? "bg-surface-lavender text-text-primary" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Itinerary
        </button>
        <button
          onClick={() => setActiveTab("guide")}
          className={`rounded-[20px] px-[16px] py-[8px] text-[14px] font-semibold transition-colors ${
            activeTab === "guide" ? "bg-surface-lavender text-text-primary" : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Travel Guide
        </button>
      </div>

      {activeTab === "itinerary" && (
        <div className="flex flex-col gap-[24px] mt-[32px]">
          {itineraryLegs.map((leg, legIdx) => (
            <div key={leg.cityId || leg.city || legIdx} className="flex flex-col gap-[24px]">
              {isMultiCity && leg.city && (
                <p className="font-heading font-semibold text-[19px] text-text-primary">{leg.city}</p>
              )}
              {leg.days.map((day) => (
                <div key={day.day}>
                  <div className="flex items-center gap-[8px]">
                    <p className="font-bold text-[15px] text-secondary-purple tracking-[0.6px]">
                      {day.label || `DAY ${day.day}`}
                    </p>
                    <Link
                      to={`/trip/${tripId}/map?day=${day.day}`}
                      onClick={() => track("Map Link Clicked", { name: trip.city, source: "trip_detail", day: day.day })}
                      className="flex items-center gap-[4px] text-[12px] font-medium text-secondary-purple underline hover:opacity-70 transition-opacity"
                    >
                      <Map size={13} strokeWidth={2} />
                      Map view
                    </Link>
                  </div>
                  <div className="flex flex-col mt-[16px]">
                    {day.slots
                      .filter((slot) => !slot._removed)
                      .map((slot) => (
                        <ItinerarySlotRow
                          key={`${day.day}-${slot.name}`}
                          slot={slot}
                          onSwap={() => setSwapTarget({ day: day.day, slotName: slot.name })}
                          onViewDetails={() => setSelectedSite({ day: day.day, slotName: slot.name })}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {trip.days.length === 0 && (
            <p className="text-text-secondary text-[14px]">This trip doesn't have an itinerary yet.</p>
          )}
        </div>
      )}

      {activeTab === "guide" && (
        <div className="flex flex-col gap-[32px] mt-[32px]">
          {destinations.map((dest) => {
            const entries = Object.entries(tipsByCity[dest.cityId] || {}).filter(([, value]) => value);
            return (
              <div key={dest.cityId}>
                {isMultiCity && (
                  <p className="font-heading font-semibold text-[18px] text-text-primary mb-[16px]">{dest.city}</p>
                )}
                {entries.length === 0 ? (
                  <p className="text-text-secondary text-[13px]">No local tips yet for {dest.city}.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[20px]">
                    {entries.map(([key, value]) => {
                      const guideKey = `${dest.cityId}:${key}`;
                      return (
                        <GuideCard
                          key={guideKey}
                          tipKey={key}
                          value={value}
                          expanded={expandedGuideKeys.has(guideKey)}
                          onToggle={() =>
                            setExpandedGuideKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(guideKey)) next.delete(guideKey);
                              else next.add(guideKey);
                              return next;
                            })
                          }
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
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
  );
}
