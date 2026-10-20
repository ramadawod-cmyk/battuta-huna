import { useEffect } from "react";
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import ImagePlaceholder from "./ImagePlaceholder";
import { useTranslation } from "../lib/LanguageContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import type { TripSlot } from "../lib/types";

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
 * Lives inside <GoogleMap> so it can call useMap() for imperative camera control. Fits the whole
 * stop list into view only when the list itself changes (new day), and just pans (no re-fit) when
 * the selection changes -- re-fitting on every tap is what made selecting a stop feel like the
 * whole map resetting.
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
    // close on -- clamp it back once the fit settles.
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
 * One marker plus the mini thumbnail+name popup shown while it's selected. The popup closing
 * itself (close button, Escape, tapping elsewhere) calls onSelect(null) so the parent's selection
 * state and the open InfoWindow never drift apart -- there's exactly one source of truth
 * (selected), not a separate local "is this window open" flag.
 */
function TripMapMarker({
  slot,
  index,
  selected,
  onSelect,
}: {
  slot: TripSlot;
  index: number;
  selected: boolean;
  onSelect: (slot: TripSlot | null) => void;
}) {
  const { language } = useTranslation();
  const [markerRef, marker] = useAdvancedMarkerRef();
  // Same cached-image-first pattern as ItinerarySlotRow -- see the note on TripSlot.imageUrl.
  const liveImageUrl = useWikiThumbnail(slot.imageUrl ? null : slot.name);
  const imageUrl = slot.imageUrl || liveImageUrl;
  const name = language === "ar" && slot.nameAr ? slot.nameAr : slot.name;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: slot.lat, lng: slot.lng }}
        zIndex={selected ? 10 : index}
        onClick={() => onSelect(slot)}
      >
        <MapPin index={index} selected={selected} />
      </AdvancedMarker>
      {selected && marker && (
        <InfoWindow anchor={marker} onClose={() => onSelect(null)}>
          <div className="flex items-center gap-[10px] p-[2px]">
            <div className="bg-surface-lavender rounded-[10px] size-[48px] shrink-0 overflow-hidden">
              {imageUrl ? <img src={imageUrl} alt="" className="size-full object-cover" /> : <ImagePlaceholder />}
            </div>
            <p className="font-heading font-semibold text-[13px] text-text-primary max-w-[140px] leading-tight">
              {name}
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

/**
 * The Google Maps panel for one day's stops -- used by TripDetail's persistent split-view map
 * pane. Fills its container; carries zero styling of its own (no radius, no shadow) since the
 * host fully controls framing via `className` -- TripDetail currently wants it edge-to-edge, not
 * boxed in a card.
 */
export default function TripDayMap({
  slots,
  selectedSlot,
  onSelectSlot,
  className = "",
}: {
  slots: TripSlot[];
  selectedSlot: TripSlot | null;
  onSelectSlot: (slot: TripSlot | null) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  // Google's own shared testing ID -- fine for local dev with no key configured yet, but a real
  // Map ID (Google Cloud Console > Map Management) is required before this goes live, since
  // Advanced Markers refuse to render without one.
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_ID || "DEMO_MAP_ID";

  if (!googleMapsKey) {
    return (
      <div className={`bg-surface-lavender/40 flex items-center justify-center text-text-secondary text-[13px] text-center p-[24px] ${className}`}>
        {t("tripMap.mapUnavailable")}
      </div>
    );
  }

  return (
    <APIProvider apiKey={googleMapsKey}>
      <GoogleMap
        mapId={googleMapsMapId}
        defaultCenter={{ lat: 20, lng: 0 }}
        defaultZoom={2}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        className={className}
      >
        <MapCamera slots={slots} selectedSlot={selectedSlot} />
        {slots.map((slot, i) => (
          <TripMapMarker
            key={slot.name}
            slot={slot}
            index={i}
            selected={selectedSlot?.name === slot.name}
            onSelect={onSelectSlot}
          />
        ))}
      </GoogleMap>
    </APIProvider>
  );
}
