import { Link } from "react-router-dom";
import { Map } from "lucide-react";
import swapIcon from "../assets/trip-detail/swap-icon.svg";
import { formatDuration } from "../lib/categories";
import { GUIDE_ACCENT_CLASSES, GUIDE_META } from "../lib/guideMeta";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { legsFromDays, tripDestinations } from "../lib/trips";
import type { CityTips } from "../lib/cityTips";
import type { Trip, TripSlot } from "../lib/types";

function ItinerarySlotRow({
  slot,
  onViewDetails,
  onSwap,
}: {
  slot: TripSlot;
  onViewDetails: () => void;
  // Omitted entirely (not just disabled) in a read-only context like the public share page --
  // there's no trip to mutate there.
  onSwap?: () => void;
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
      {onSwap && (
        <button onClick={onSwap} aria-label={`Swap ${slot.name}`} className="shrink-0 size-[32px]">
          <img src={swapIcon} alt="" className="size-full" />
        </button>
      )}
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

/**
 * The itinerary tab's rendering, shared between the owner's TripDetail and the public /shared
 * page. `onSwap`/`mapHrefForDay` are optional and omitted entirely (not passed-but-disabled) on
 * the public page, since neither works there: swapping mutates a trip the viewer doesn't own, and
 * the map route is owner-scoped (getTrips, not getPublicTrip) so it would just 404 for a stranger.
 */
export function TripItinerary({
  trip,
  onViewDetails,
  onSwap,
  mapHrefForDay,
}: {
  trip: Trip;
  onViewDetails: (day: number, slotName: string) => void;
  onSwap?: (day: number, slotName: string) => void;
  mapHrefForDay?: (day: number) => string;
}) {
  const destinations = tripDestinations(trip);
  const isMultiCity = destinations.length > 1;
  const visibleDays = trip.days.filter((day) => day.slots.some((s) => !s._removed));
  const itineraryLegs = legsFromDays(visibleDays);

  return (
    <div className="flex flex-col gap-[24px]">
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
                {mapHrefForDay && (
                  <Link
                    to={mapHrefForDay(day.day)}
                    onClick={() => track("Map Link Clicked", { name: trip.city, source: "trip_detail", day: day.day })}
                    className="flex items-center gap-[4px] text-[12px] font-medium text-secondary-purple underline hover:opacity-70 transition-opacity"
                  >
                    <Map size={13} strokeWidth={2} />
                    Map view
                  </Link>
                )}
              </div>
              <div className="flex flex-col mt-[16px]">
                {day.slots
                  .filter((slot) => !slot._removed)
                  .map((slot) => (
                    <ItinerarySlotRow
                      key={`${day.day}-${slot.name}`}
                      slot={slot}
                      onViewDetails={() => onViewDetails(day.day, slot.name)}
                      onSwap={onSwap ? () => onSwap(day.day, slot.name) : undefined}
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
  );
}

/** The travel guide tab's rendering, shared between TripDetail and the public /shared page. */
export function TripGuide({
  trip,
  tipsByCity,
  expandedGuideKeys,
  onToggleGuideKey,
}: {
  trip: Trip;
  tipsByCity: Record<string, CityTips>;
  expandedGuideKeys: Set<string>;
  onToggleGuideKey: (guideKey: string) => void;
}) {
  const destinations = tripDestinations(trip);
  const isMultiCity = destinations.length > 1;

  return (
    <div className="flex flex-col gap-[32px]">
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
                      onToggle={() => onToggleGuideKey(guideKey)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
