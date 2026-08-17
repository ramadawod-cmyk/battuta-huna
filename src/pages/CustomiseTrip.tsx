import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../components/Button";
import TagPill from "../components/TagPill";
import { db } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { GROUP_TYPES, PACE_OPTIONS } from "../lib/planFlow";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Trip } from "../lib/types";

export default function CustomiseTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [groupType, setGroupType] = useState(GROUP_TYPES[1]);
  const [pace, setPace] = useState(PACE_OPTIONS[0]);

  useTrackScreen("customise_trip");

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
        if (found.group_type) setGroupType(found.group_type);
        if (found.pace) setPace(found.pace);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip"))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id, tripId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await db("updateTripStatus", { tripId, groupType, pace });
      track("Trip Details Submitted", { group_type: groupType, pace, trip_id: tripId, source: "customise" });
      navigate(`/trip/${tripId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't save your changes.";
      setError(message);
      track("Trip Save Failed", { trip_id: tripId, message, source: "customise" });
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="px-[48px] py-[32px] text-text-secondary">Loading…</div>;
  }

  if (error && !trip) {
    return (
      <div className="px-[48px] py-[32px]">
        <p className="text-text-primary">{error}</p>
        <Link to="/my-trips" className="text-[13px] font-medium text-text-secondary mt-[16px] inline-block">
          ← Back to My Trips
        </Link>
      </div>
    );
  }

  return (
    <div className="px-[48px] py-[32px] max-w-[1180px]">
      <Link to={`/trip/${tripId}`} className="font-medium text-[13px] text-text-secondary hover:text-text-primary">
        ← Back to Trip
      </Link>

      <h1 className="font-heading font-semibold text-[28px] text-text-primary mt-[16px]">Customise your trip</h1>
      <p className="text-[14px] text-text-secondary mt-[6px]">
        {trip?.duration ? `${trip.duration} days in ${trip.city}` : trip?.city}
      </p>

      <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] mt-[32px]">GROUP TYPE</p>
      <div className="flex flex-wrap gap-[10px] mt-[12px] max-w-[700px]">
        {GROUP_TYPES.map((type) => (
          <TagPill key={type} label={type} active={groupType === type} onClick={() => setGroupType(type)} />
        ))}
      </div>

      <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] mt-[32px]">PACE</p>
      <div className="flex flex-wrap gap-[10px] mt-[12px] max-w-[700px]">
        {PACE_OPTIONS.map((option) => (
          <TagPill key={option} label={option} active={pace === option} onClick={() => setPace(option)} />
        ))}
      </div>

      {error && <p className="text-primary-orange text-[13px] mt-[24px]">{error}</p>}

      <Button variant="orange" className="!w-[300px] !h-[52px] mt-[40px]" disabled={saving} onClick={handleSave}>
        {saving ? "SAVING…" : "SAVE CHANGES"}
      </Button>
    </div>
  );
}
