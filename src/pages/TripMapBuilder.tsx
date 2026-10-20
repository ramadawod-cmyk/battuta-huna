import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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

function markerIcon(index: number, selected: boolean) {
  const size = selected ? 40 : 34;
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${
      selected ? "#6155cc" : "#fe9c5e"
    };border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;box-shadow:0 4px 10px rgba(48,48,48,${
      selected ? "0.35" : "0.2"
    });transition:width 0.15s ease,height 0.15s ease;">${index + 1}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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

  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => setMapEl(node), []);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

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

  useEffect(() => {
    if (!mapEl || mapRef.current) return;
    // zoomSnap/zoomDelta below 1 and a larger wheelPxPerZoomLevel make zoom steps feel smoother
    // and less twitchy than Leaflet's jumpy integer-zoom default.
    mapRef.current = L.map(mapEl, { zoomControl: true, zoomSnap: 0.5, zoomDelta: 0.5, wheelPxPerZoomLevel: 90 }).setView(
      [20, 0],
      2,
    );
    const geoapifyKey = import.meta.env.VITE_GEOAPIFY_KEY;
    // Geoapify when configured -- OpenStreetMap's own public tile servers explicitly disallow
    // sustained production traffic and will throttle/block it; falls back to OSM directly for
    // local dev when no key is set, same pattern as buildViatorSearchUrl. "positron" is a light,
    // minimal style (vs. osm-bright's busy default OSM look) so the custom pins read clearly and
    // the map feels current rather than like stock OpenStreetMap -- {r} + detectRetina request
    // Geoapify's @2x tiles on high-DPI screens so they don't look soft/blurry on phones.
    const tileUrl = geoapifyKey
      ? `https://maps.geoapify.com/v1/tile/positron/{z}/{x}/{y}{r}.png?apiKey=${geoapifyKey}`
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = geoapifyKey
      ? 'Powered by <a href="https://www.geoapify.com/" target="_blank">Geoapify</a> | &copy; OpenStreetMap <a href="https://www.openstreetmap.org/copyright" target="_blank">contributors</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    L.tileLayer(tileUrl, { attribution, maxZoom: 20, detectRetina: true }).addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapEl]);

  // Rebuilds markers and re-fits the view only when the stop list itself changes (new day, trip
  // loaded) -- NOT on every selection. Re-running this on selectedSlot too (as it used to) tore
  // down and recreated every marker plus re-fit the whole map on every single pin/card tap, which
  // is exactly what made selecting a stop feel like a jarring jump instead of a quiet highlight.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = new Map();
    if (slots.length === 0) return;

    slots.forEach((slot, i) => {
      const marker = L.marker([slot.lat, slot.lng], {
        icon: markerIcon(i, selectedSlot?.name === slot.name),
      }).addTo(map);
      marker.on("click", () => setSelectedSlot(slot));
      markersRef.current.set(slot.name, marker);
    });

    const bounds = L.latLngBounds(slots.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    // selectedSlot deliberately excluded -- only read for each marker's initial icon above, same
    // read-once rationale as the searchParams effect further up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapEl, slots]);

  // Just restyles whichever marker is selected/deselected and gently pans to it -- no marker
  // churn, no re-fit, so picking a stop from the list or tapping a different pin feels like a
  // quiet highlight + smooth pan instead of the whole map resetting.
  useEffect(() => {
    slots.forEach((slot, i) => {
      markersRef.current.get(slot.name)?.setIcon(markerIcon(i, selectedSlot?.name === slot.name));
    });
    if (selectedSlot) {
      mapRef.current?.panTo([selectedSlot.lat, selectedSlot.lng], { animate: true });
    }
  }, [selectedSlot, slots]);

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
          <div
            ref={mapContainerRef}
            className="rounded-[24px] overflow-hidden h-[320px] sm:h-[500px] shadow-[0px_8px_24px_0px_rgba(48,48,48,0.08)]"
          />
          {selectedSlot && <SelectedSlotCard slot={selectedSlot} />}
        </div>
      </div>
    </div>
  );
}
