import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import swapIcon from "../assets/trip-detail/swap-icon.svg";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { slugify } from "../lib/geo";
import { formatDuration } from "../lib/categories";
import { ensureCityTips, type CityTips } from "../lib/cityTips";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Trip } from "../lib/types";

// Keys match what ensureCityTips generates (src/lib/cityTips.ts) and what's already stored for
// the handful of cities seeded before that existed -- both use the same key set, so every city's
// guide renders with a proper icon/title instead of falling back to a generic pin + raw key name.
const GUIDE_LABELS: Record<string, { emoji: string; title: string }> = {
  safety: { emoji: "🛡️", title: "Safety" },
  what_to_have: { emoji: "🎒", title: "What to have" },
  where_to_eat: { emoji: "🍽️", title: "Where to eat" },
  local_culture: { emoji: "🤝", title: "Local culture" },
  getting_around: { emoji: "🚕", title: "Getting around" },
  money_payments: { emoji: "💳", title: "Money & payments" },
  language_basics: { emoji: "🗣️", title: "Language basics" },
  best_time_of_day: { emoji: "🕐", title: "Best time of day" },
};

export default function TripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tips, setTips] = useState<CityTips | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heroImageUrl = useWikiThumbnail(trip?.city);
  const [heroImageFailed, setHeroImageFailed] = useState(false);

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

      <div className="flex gap-[32px] lg:gap-[48px] mt-[32px] items-start flex-wrap">
        <div className="flex-1 min-w-0 max-w-[680px]">
          <div className="flex flex-col gap-[24px]">
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
                        <div key={`${day.day}-${slot.name}`} className="flex items-start gap-[16px] py-[10px]">
                          <div className="w-[70px] shrink-0 mt-[2px]">
                            <p className="text-[12px] font-medium text-text-secondary">{slot.time}</p>
                            {slot.durationMinutes && (
                              <p className="text-[11px] text-text-secondary/70 mt-[2px]">
                                {formatDuration(slot.durationMinutes)}
                              </p>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-heading font-semibold text-[16px] text-text-primary">{slot.name}</p>
                            <p className="text-[13px] leading-[1.4] text-text-secondary mt-[6px]">
                              {slot.description}
                            </p>
                          </div>
                          <Link
                            to={`/trip/${tripId}/swap?day=${day.day}&slot=${encodeURIComponent(slot.name)}`}
                            aria-label={`Swap ${slot.name}`}
                            className="shrink-0 size-[32px]"
                          >
                            <img src={swapIcon} alt="" className="size-full" />
                          </Link>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            {trip.days.length === 0 && (
              <p className="text-text-secondary text-[14px]">This trip doesn't have an itinerary yet.</p>
            )}
          </div>
        </div>

        <div className="w-full sm:w-[356px] shrink-0">
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px]">TRAVEL GUIDE</p>
          <div className="flex flex-col gap-[16px] mt-[16px]">
            {guideEntries.length === 0 && (
              <p className="text-text-secondary text-[13px]">No local tips yet for {trip.city}.</p>
            )}
            {guideEntries.map(([key, value]) => {
              const meta = GUIDE_LABELS[key] || { emoji: "📌", title: key };
              return (
                <div key={key} className="bg-white border border-secondary-purple rounded-[16px] p-[15px] flex gap-[12px]">
                  <p className="text-[18px] leading-[24px] shrink-0">{meta.emoji}</p>
                  <div>
                    <p className="font-heading font-semibold text-[14px] text-text-primary">{meta.title}</p>
                    <p className="text-[12px] leading-[1.4] text-text-secondary mt-[6px]">{value}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
