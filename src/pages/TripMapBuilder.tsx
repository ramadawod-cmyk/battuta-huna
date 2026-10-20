import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import BackLink from "../components/BackLink";
import ImagePlaceholder from "../components/ImagePlaceholder";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useTranslation } from "../lib/LanguageContext";
import { categoryOrActivityLabelKey } from "../lib/categories";
import { GROUP_LABEL_KEYS, PACE_LABEL_KEYS } from "../lib/planFlow";
import { useTrackScreen } from "../lib/useTrackScreen";
import { destinationsLabel, tripDestinations } from "../lib/trips";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import type { Trip, TripSlot } from "../lib/types";

/** The numbered pin content for one stop -- plain inline styles, not Tailwind, since the size is
 * computed at runtime (selected vs not) and Tailwind can't pick that up from a template literal. */
function MapPin({ index, selected }: { index: number; selected: boolean }) {
  const size = selected ? 40 : 34;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 9999,
        background: selected ? "#6155cc" : "#fe9c5e",
        border: "3px solid white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontWeight: 700,
        fontSize: 14,
        boxShadow: `0 4px 10px rgba(48,48,48,${selected ? 0.35 : 0.2})`,
        transition: "width 0.15s ease, height 0.15s ease",
      }}
    >
      {index + 1}
    </div>
  );
}

/**
 * Lives inside <GoogleMap> so it can call useMap() for imperative camera control. Mirrors the
 * same split the Leaflet version used: fit the whole stop list into view only when the list
 * itself changes (new day), and just pan (no re-fit) when the selection changes -- re-fitting on
 * every tap is what made selecting a stop feel like the whole map resetting.
 */
function MapCamera({ slots, selectedSlot }: { slots: TripSlot[]; selectedSlot: TripSlot | null }) {
  const map = useMap();
  const slotsKey = slots.map((s) => s.name).join("|");

  useEffect(() => {
    if (!map || slots.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    slots.forEach((s) => bounds.extend({ lat: s.lat, lng: s.lng }));
    map.fitBounds(bounds, 40);
    // A single-stop day collapses the bounds to a point, which Google zooms in uncomfortably
    // close on -- clamp it back once the fit settles, same maxZoom the Leaflet version used.
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 16) map.setZoom(16);
    });
    return () => listener.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, slotsKey]);

  useEffect(() => {
    if (!map || !selectedSlot) return;
    map.panTo({ lat: selectedSlot.lat, lng: selectedSlot.lng });
  }, [map, selectedSlot]);

  return null;
}

/**
 * Styled to match PoiCard/ItinerarySlotRow (borderless shadow card, fixed thumbnail) so the map
 * page's stop list feels like the same app. The numbered badge stays separate from the image
 * rather than overlaid on it, since it has to keep matching the map pin numbers unambiguously.
 */
function MapStopCard({
  slot,
  index,
  selected,
  onClick,
}: {
  slot: TripSlot;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const { t, language } = useTranslation();
  // Prefers whatever image was already resolved+cached elsewhere -- see the note on
  // TripSlot.imageUrl in types.ts, same pattern as ItinerarySlotRow.
  const liveImageUrl = useWikiThumbnail(slot.imageUrl ? null : slot.name);
  const imageUrl = slot.imageUrl || liveImageUrl;
  const name = language === "ar" && slot.nameAr ? slot.nameAr : slot.name;
  const description = language === "ar" && slot.descriptionAr ? slot.descriptionAr : slot.description;
  return (
    <button
      onClick={onClick}
      className={`text-start w-full flex gap-[14px] bg-white rounded-[20px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.06)] p-[16px] mb-[16px] transition-colors ${
        selected ? "border-2 border-secondary-purple" : ""
      }`}
    >
      <div className="bg-primary-orange rounded-full size-[28px] shrink-0 flex items-center justify-center text-white font-bold text-[13px] mt-[2px]">
        {index + 1}
      </div>
      <div className="bg-surface-lavender rounded-[12px] size-[60px] shrink-0 overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <ImagePlaceholder />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-text-secondary">{slot.time}</p>
        <p className="font-heading font-semibold text-[16px] text-text-primary mt-[2px] line-clamp-1">{name}</p>
        <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px] mt-[3px]">
          {t(categoryOrActivityLabelKey(slot.category))}
        </p>
        <p className="text-[12px] leading-[1.4] text-text-secondary mt-[4px] line-clamp-2">{description}</p>
      </div>
    </button>
  );
}

/** The card below the map for whichever pin/stop is currently selected -- same card style as MapStopCard. */
function SelectedSlotCard({ slot }: { slot: TripSlot }) {
  const { t, language } = useTranslation();
  const liveImageUrl = useWikiThumbnail(slot.imageUrl ? null : slot.name);
  const imageUrl = slot.imageUrl || liveImageUrl;
  const name = language === "ar" && slot.nameAr ? slot.nameAr : slot.name;
  const description = language === "ar" && slot.descriptionAr ? slot.descriptionAr : slot.description;
  return (
    <div className="flex gap-[16px] bg-white rounded-[20px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.06)] p-[16px] mt-[16px]">
      <div className="bg-surface-lavender rounded-[12px] size-[60px] shrink-0 overflow-hidden">
        {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <ImagePlaceholder />}
      </div>
      <div className="min-w-0">
        <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px]">
          {t(categoryOrActivityLabelKey(slot.category))}
        </p>
        <p className="font-heading font-semibold text-[16px] text-text-primary mt-[4px]">{name}</p>
        <p className="text-[12px] leading-[1.4] text-text-secondary mt-[6px]">{description}</p>
      </div>
    </div>
  );
}

export default function TripMapBuilder() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const { session, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<TripSlot | null>(null);

  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  // Google's own shared testing ID -- fine for local dev with no key configured yet, but a real
  // Map ID (Google Cloud Console > Map Management) is required before this goes live, since
  // Advanced Markers refuse to render without one.
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_ID || "DEMO_MAP_ID";

  useTrackScreen("trip_map");

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
        const requestedDay = Number(searchParams.get("day"));
        const dayIndex = found.days.findIndex((d) => d.day === requestedDay);
        if (dayIndex !== -1) setActiveDayIndex(dayIndex);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("trip.loadFailed")))
      .finally(() => setLoading(false));
    // Only re-run for a new trip/session -- searchParams is read once on load so switching
    // days via the tabs below doesn't get stomped by this effect re-running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session?.user?.id, tripId]);

  const activeDay = trip?.days?.[activeDayIndex];
  const slots = useMemo(
    () => (activeDay?.slots || []).filter((s) => !s._removed && s.lat && s.lng),
    [activeDay],
  );

  if (loading) {
    return <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] text-text-secondary">{t("tripMap.loading")}</div>;
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
  ].filter(Boolean);
  const isMultiCity = tripDestinations(trip).length > 1;

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px]">
      <BackLink to={`/trip/${tripId}`} labelKey="common.backToTrip" className="text-[13px] font-medium text-text-secondary" />

      <div className="mt-[16px]">
        <h1 className="font-heading font-semibold text-[30px] text-text-primary">{destinationsLabel(trip)}</h1>
        <p className="font-medium text-[11px] text-text-secondary tracking-[0.44px] mt-[4px]">
          {metaParts.join(" · ")}
        </p>
        <div className="flex gap-[10px] mt-[16px] flex-wrap">
          {trip.days.map((day, i) => (
            <button
              key={day.day}
              onClick={() => {
                setActiveDayIndex(i);
                setSelectedSlot(null);
              }}
              className={`rounded-[20px] px-[18px] py-[9px] text-[13px] transition-colors ${
                i === activeDayIndex
                  ? "bg-secondary-purple text-white font-medium"
                  : "bg-white border border-secondary-purple text-text-primary"
              }`}
            >
              {t("trip.dayLabel", { number: day.day })}
              {isMultiCity && day.city ? ` · ${day.city}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-[24px] lg:gap-[40px] items-start mt-[24px] flex-wrap">
        <div className="flex-1 min-w-0 w-full sm:min-w-[320px]">
          {slots.length === 0 && (
            <p className="text-text-secondary text-[14px]">{t("tripMap.noLocatedStops")}</p>
          )}
          {slots.map((slot, i) => (
            <MapStopCard
              key={slot.name}
              slot={slot}
              index={i}
              selected={selectedSlot?.name === slot.name}
              onClick={() => setSelectedSlot(slot)}
            />
          ))}
        </div>

        <div className="w-[524px] max-w-full shrink-0">
          {googleMapsKey ? (
            <APIProvider apiKey={googleMapsKey}>
              <GoogleMap
                mapId={googleMapsMapId}
                defaultCenter={{ lat: 20, lng: 0 }}
                defaultZoom={2}
                gestureHandling="greedy"
                disableDefaultUI
                zoomControl
                className="rounded-[24px] overflow-hidden h-[320px] sm:h-[500px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.08)]"
              >
                <MapCamera slots={slots} selectedSlot={selectedSlot} />
                {slots.map((slot, i) => (
                  <AdvancedMarker
                    key={slot.name}
                    position={{ lat: slot.lat, lng: slot.lng }}
                    zIndex={selectedSlot?.name === slot.name ? 10 : i}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <MapPin index={i} selected={selectedSlot?.name === slot.name} />
                  </AdvancedMarker>
                ))}
              </GoogleMap>
            </APIProvider>
          ) : (
            <div className="rounded-[24px] h-[320px] sm:h-[500px] bg-surface-lavender/40 flex items-center justify-center text-text-secondary text-[13px] text-center p-[24px]">
              {t("tripMap.mapUnavailable")}
            </div>
          )}
          {selectedSlot && <SelectedSlotCard slot={selectedSlot} />}
        </div>
      </div>
    </div>
  );
}
