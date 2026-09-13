import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SiteDetailModal from "../components/SiteDetailModal";
import SwapPanel from "../components/SwapPanel";
import { TripGuide, TripItinerary } from "../components/TripContent";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { slugify } from "../lib/geo";
import { ensureCityTips, type CityTips } from "../lib/cityTips";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import { destinationsLabel, tripDestinations } from "../lib/trips";
import type { Trip, TripDay } from "../lib/types";

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
        <div className="mt-[32px]">
          <TripItinerary
            trip={trip}
            onViewDetails={(day, slotName) => setSelectedSite({ day, slotName })}
            onSwap={(day, slotName) => setSwapTarget({ day, slotName })}
            mapHrefForDay={(day) => `/trip/${tripId}/map?day=${day}`}
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
  );
}
