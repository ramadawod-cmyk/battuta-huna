import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Trip, TripSlot } from "../lib/types";

function markerIcon(index: number, selected: boolean) {
  return L.divIcon({
    className: "",
    html: `<div style="width:36px;height:36px;border-radius:9999px;background:${
      selected ? "#6155cc" : "#fe9c5e"
    };border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;box-shadow:0 2px 6px rgba(48,48,48,0.25);">${index + 1}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

export default function TripMapBuilder() {
  const { tripId } = useParams<{ tripId: string }>();
  const { session, loading: authLoading } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<TripSlot | null>(null);

  const [mapEl, setMapEl] = useState<HTMLDivElement | null>(null);
  const mapContainerRef = useCallback((node: HTMLDivElement | null) => setMapEl(node), []);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useTrackScreen("trip_map");

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    db("getTrips", session?.user?.id ? { authUserId: session.user.id } : {})
      .then((trips: Trip[]) => {
        const found = (trips || []).find((t) => t.id === tripId) || null;
        setTrip(found);
        if (!found) setError("Trip not found.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip"))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id, tripId]);

  const activeDay = trip?.days?.[activeDayIndex];
  const slots = useMemo(
    () => (activeDay?.slots || []).filter((s) => !s._removed && s.lat && s.lng),
    [activeDay],
  );

  useEffect(() => {
    if (!mapEl || mapRef.current) return;
    mapRef.current = L.map(mapEl, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapEl]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (slots.length === 0) return;

    slots.forEach((slot, i) => {
      const marker = L.marker([slot.lat, slot.lng], {
        icon: markerIcon(i, selectedSlot?.name === slot.name),
      }).addTo(map);
      marker.on("click", () => setSelectedSlot(slot));
      markersRef.current.push(marker);
    });

    const bounds = L.latLngBounds(slots.map((s) => [s.lat, s.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [mapEl, slots, selectedSlot]);

  if (loading) {
    return <div className="px-[48px] py-[40px] text-text-secondary">Loading map…</div>;
  }

  if (error || !trip) {
    return (
      <div className="px-[48px] py-[40px]">
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

  return (
    <div className="px-[48px] py-[40px]">
      <Link to={`/trip/${tripId}`} className="text-[13px] font-medium text-text-secondary">
        ← Back to Trip
      </Link>

      <div className="mt-[16px]">
        <h1 className="font-heading font-semibold text-[30px] text-text-primary">{trip.city}</h1>
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
              Day {day.day}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-[40px] items-start mt-[24px] flex-wrap">
        <div className="flex-1 min-w-[320px]">
          {slots.length === 0 && (
            <p className="text-text-secondary text-[14px]">No located stops for this day.</p>
          )}
          {slots.map((slot, i) => {
            const isSelected = selectedSlot?.name === slot.name;
            return (
              <button
                key={slot.name}
                onClick={() => setSelectedSlot(slot)}
                className={`text-left w-full flex gap-[20px] bg-white border rounded-[20px] p-[23px] mb-[16px] transition-colors ${
                  isSelected ? "border-[2px] border-secondary-purple" : "border border-secondary-purple"
                }`}
              >
                <div className="bg-primary-orange rounded-full size-[32px] shrink-0 flex items-center justify-center text-white font-bold text-[14px]">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-text-secondary">{slot.time}</p>
                  <p className="font-heading font-semibold text-[16px] text-text-primary mt-[2px]">{slot.name}</p>
                  <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px] mt-[3px]">
                    {slot.category}
                  </p>
                  <p className="text-[12px] leading-[1.4] text-text-secondary mt-[4px]">{slot.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="w-[524px] max-w-full shrink-0">
          <div ref={mapContainerRef} className="rounded-[24px] overflow-hidden h-[500px] border border-secondary-purple" />
          {selectedSlot && (
            <div className="bg-white border border-secondary-purple rounded-[20px] p-[19px] mt-[16px]">
              <p className="font-medium text-[10px] text-secondary-purple tracking-[0.4px]">
                {selectedSlot.category}
              </p>
              <p className="font-heading font-semibold text-[16px] text-text-primary mt-[4px]">
                {selectedSlot.name}
              </p>
              <p className="text-[12px] leading-[1.4] text-text-secondary mt-[6px]">{selectedSlot.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
