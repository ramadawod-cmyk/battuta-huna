import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TripCard from "../components/TripCard";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { useTranslation } from "../lib/LanguageContext";
import { categoryOrActivityLabelKey } from "../lib/categories";
import { GROUP_LABEL_KEYS, PACE_LABEL_KEYS } from "../lib/planFlow";
import type en from "../lib/i18n/en";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import { destinationsLabel } from "../lib/trips";
import type { Trip } from "../lib/types";

function tripMeta(trip: Trip, t: (key: keyof typeof en, vars?: Record<string, string | number>) => string): string {
  if (trip.status !== "ready") return t("myTrips.planning");
  const parts = [
    trip.duration ? t("trip.daysUnit", { count: trip.duration }) : null,
    trip.group_type ? (GROUP_LABEL_KEYS[trip.group_type] ? t(GROUP_LABEL_KEYS[trip.group_type]) : trip.group_type).toUpperCase() : null,
    trip.pace ? (PACE_LABEL_KEYS[trip.pace] ? t(PACE_LABEL_KEYS[trip.pace]) : trip.pace).toUpperCase() : null,
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
  const { t } = useTranslation();
  const imageUrl = useWikiThumbnail(trip.city);
  return (
    <TripCard
      city={destinationsLabel(trip)}
      meta={tripMeta(trip, t)}
      tags={tripTags(trip).map((tag) => t(categoryOrActivityLabelKey(tag)))}
      imageUrl={imageUrl}
      onClick={onClick}
    />
  );
}

export default function MyTrips() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const { t } = useTranslation();
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
      .catch((err) => setError(err instanceof Error ? err.message : t("myTrips.loadFailed")))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id]);

  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] max-w-[1180px]">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">{t("myTrips.title")}</h1>

      {loading && <p className="text-text-secondary text-[14px] mt-[28px]">{t("myTrips.loading")}</p>}

      {!loading && error && <p className="text-primary-orange text-[14px] mt-[28px]">{error}</p>}

      {!loading && !error && trips.length === 0 && (
        <p className="text-text-secondary text-[14px] mt-[28px]">
          {t("myTrips.empty")}
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
