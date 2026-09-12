import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import swapIcon from "../assets/trip-detail/swap-icon.svg";
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
import type { Trip, TripDay, TripSlot } from "../lib/types";

function ItinerarySlotRow({ slot, onSwap }: { slot: TripSlot; onSwap: () => void }) {
  const imageUrl = useWikiThumbnail(slot.name);
  return (
    <div className="flex items-start gap-[16px] py-[10px]">
      <div className="w-[80px] shrink-0 mt-[2px]">
        <p className="text-[12px] font-medium text-text-secondary">{slot.time}</p>
        {slot.durationMinutes && (
          <p className="text-[11px] text-text-secondary/70 mt-[2px]">{formatDuration(slot.durationMinutes)}</p>
        )}
      </div>
      <div className="size-[56px] shrink-0 rounded-[12px] bg-surface-lavender overflow-hidden">
        {imageUrl && <img src={imageUrl} alt="" className="size-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-[16px] text-text-primary">{slot.name}</p>
        <p className="text-[13px] leading-[1.4] text-text-secondary mt-[6px]">{slot.description}</p>
      </div>
      <button onClick={onSwap} aria-label={`Swap ${slot.name}`} className="shrink-0 size-[32px]">
        <img src={swapIcon} alt="" className="size-full" />
      </button>
    </div>
  );
}

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<CityTips | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heroImageUrl = useWikiThumbnail(trip?.city);
  const [heroImageFailed, setHeroImageFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<"itinerary" | "guide">("itinerary");
  const [expandedGuideKeys, setExpandedGuideKeys] = useState<Set<string>>(new Set());
  const [swapTarget, setSwapTarget] = useState<{ day: number; slotName: string } | null>(null);

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
        track("Trip Detail Viewed", {
          trip_id: found.id,
          city: found.city,
          status: found.status,
          day_count: found.days?.length || 0,
        });
        ensureCityTips(slugify(found.city), found.city)
          .then(setTips)
          .catch(() => {});
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

  const guideEntries = Object.entries(tips || {}).filter(([, value]) => value);

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[32px]">
      <Link to="/my-trips" className="text-[13px] font-medium text-text-secondary">
        ← Back to My Trips
      </Link>

      <div className="relative mt-[24px] sm:mt-[32px] bg-secondary-purple rounded-[24px] w-full h-[200px] sm:h-[240px] overflow-hidden">
        {heroImageUrl && !heroImageFailed && (
          <img
            src={heroImageUrl}
            alt={trip.city}
            onError={() => setHeroImageFailed(true)}
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
        <div className="absolute left-[16px] sm:left-[24px] bottom-[24px] sm:bottom-[40px] right-[16px]">
          <p className="font-heading font-semibold text-[20px] sm:text-[24px] text-white truncate">{trip.city}</p>
          <p className="font-medium text-[10px] text-white/72 tracking-[1px] mt-[2px]">{metaParts.join(" · ")}</p>
        </div>
        <div className="absolute right-[12px] sm:right-[24px] top-[12px] sm:top-[24px] flex gap-[8px] sm:gap-[16px]">
          <Link
            to={`/trip/${tripId}/map`}
            onClick={() => track("Map Link Clicked", { name: trip.city, source: "trip_detail" })}
            className="h-[36px] sm:h-[44px] px-[14px] sm:w-[100px] rounded-[14px] border-[1.5px] border-white bg-transparent flex items-center justify-center font-bold text-[12px] sm:text-[14px] tracking-[0.56px] text-white transition-opacity hover:opacity-90"
          >
            MAP
          </Link>
          <Link
            to={`/trip/${tripId}/customise`}
            onClick={() => track("Trip Edit Started", { trip_id: trip.id, city: trip.city })}
            className="h-[36px] sm:h-[44px] px-[14px] sm:w-[140px] rounded-[14px] border-[1.5px] border-text-primary bg-transparent flex items-center justify-center font-bold text-[12px] sm:text-[14px] tracking-[0.56px] text-text-secondary transition-opacity hover:opacity-90 whitespace-nowrap"
          >
            EDIT TRIP
          </Link>
        </div>
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
          {trip.days
            .filter((day) => day.slots.some((s) => !s._removed))
            .map((day) => (
              <div key={day.day}>
                <p className="font-bold text-[15px] text-secondary-purple tracking-[0.6px]">
                  {day.label || `DAY ${day.day}`}
                </p>
                <div className="flex flex-col mt-[16px]">
                  {day.slots
                    .filter((slot) => !slot._removed)
                    .map((slot) => (
                      <ItinerarySlotRow
                        key={`${day.day}-${slot.name}`}
                        slot={slot}
                        onSwap={() => setSwapTarget({ day: day.day, slotName: slot.name })}
                      />
                    ))}
                </div>
              </div>
            ))}
          {trip.days.length === 0 && (
            <p className="text-text-secondary text-[14px]">This trip doesn't have an itinerary yet.</p>
          )}
        </div>
      )}

      {activeTab === "guide" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[20px] mt-[32px]">
          {guideEntries.length === 0 && (
            <p className="text-text-secondary text-[13px]">No local tips yet for {trip.city}.</p>
          )}
          {guideEntries.map(([key, value]) => {
            const meta = GUIDE_META[key];
            const title = meta?.title || key;
            const Icon = meta?.icon;
            const accentClasses = GUIDE_ACCENT_CLASSES[meta?.accent || "purple"];
            const isExpanded = expandedGuideKeys.has(key);
            const isLong = value.length > 100;
            return (
              <div key={key} className="bg-white border border-border rounded-[16px] p-[16px]">
                <div className="flex items-center gap-[10px]">
                  <div className={`size-[36px] rounded-full flex items-center justify-center shrink-0 ${accentClasses.bg}`}>
                    {Icon && <Icon className={`size-[18px] ${accentClasses.text}`} strokeWidth={2} />}
                  </div>
                  <p className="font-heading font-semibold text-[14px] text-text-primary">{title}</p>
                </div>
                <p
                  className={`text-[12px] leading-[1.4] text-text-secondary mt-[10px] ${isExpanded ? "" : "line-clamp-2"}`}
                >
                  {value}
                </p>
                {isLong && (
                  <button
                    onClick={() =>
                      setExpandedGuideKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(key)) next.delete(key);
                        else next.add(key);
                        return next;
                      })
                    }
                    className="text-[12px] font-medium text-secondary-purple mt-[6px]"
                  >
                    {isExpanded ? "Show less" : "Read more"}
                  </button>
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
    </div>
  );
}
