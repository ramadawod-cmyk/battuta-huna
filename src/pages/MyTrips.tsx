import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TripCard from "../components/TripCard";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Trip } from "../lib/types";

function tripMeta(trip: Trip): string {
  if (trip.status !== "ready") return "PLANNING…";
  const parts = [
    trip.duration ? `${trip.duration} DAYS` : null,
    trip.group_type?.toUpperCase(),
    trip.pace?.toUpperCase(),
  ].filter(Boolean);
  return parts.join(" · ");
}

function tripTags(trip: Trip): string[] {
  const categories = new Set<string>();
  for (const day of trip.days || []) {
    for (const slot of day.slots || []) {
      if (slot.category) categories.add(slot.category);
    }
  }
  return Array.from(categories).slice(0, 2);
}

function TripCardWithImage({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const imageUrl = useWikiThumbnail(trip.city);
  return (
    <TripCard
      city={trip.city}
      meta={tripMeta(trip)}
      tags={tripTags(trip)}
      imageUrl={imageUrl}
      onClick={onClick}
    />
  );
}

export default function MyTrips() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useTrackScreen("my_trips");

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);
    db("getTrips", session?.user?.id ? { authUserId: session.user.id } : {})
      .then((result: Trip[]) => {
        setTrips(result || []);
        track("Trips List Viewed", { count: result?.length || 0, logged_in: !!session });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trips"))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id]);

  return (
    <div className="px-[48px] py-[40px] max-w-[1180px]">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">My Trips</h1>

      {loading && <p className="text-text-secondary text-[14px] mt-[28px]">Loading your trips…</p>}

      {!loading && error && <p className="text-primary-orange text-[14px] mt-[28px]">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <p className="text-text-secondary text-[14px] mt-[28px]">
          No trips yet — head to Plan to build your first itinerary.
        </p>
      )}

      <div className="flex flex-wrap gap-[24px] mt-[28px]">
        {trips.map((trip) => (
          <TripCardWithImage key={trip.id} trip={trip} onClick={() => navigate(`/trip/${trip.id}`)} />
        ))}
      </div>
    </div>
  );
}
