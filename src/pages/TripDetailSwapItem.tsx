import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../components/Button";
import AllSitesListItem from "../components/AllSitesListItem";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import swapIcon from "../assets/trip-swap/swap-icon.svg";
import closeIcon from "../assets/trip-swap/close-icon.svg";
import askAiArrow from "../assets/trip-swap/ask-ai-arrow.svg";
import { db, planAgent } from "../lib/api";
import { useAuth } from "../lib/AuthContext";
import { normalizeCategory } from "../lib/categories";
import { slugify } from "../lib/geo";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import type { Site, Trip, TripSlot } from "../lib/types";

function AlternativeItem({ site, onClick }: { site: Site; onClick: () => void }) {
  const imageUrl = useWikiThumbnail(site.name);
  return (
    <AllSitesListItem
      name={site.name}
      category={site.category.toUpperCase()}
      description={site.description}
      className="max-w-none"
      imageUrl={site.image_url || imageUrl}
      onClick={onClick}
    />
  );
}

async function rankByQuery(query: string, alternatives: Site[]): Promise<string[]> {
  const system = `You help pick a replacement stop for a trip itinerary. Given a traveller's request and a list of candidate places (JSON), respond with ONLY a JSON array of place names from the list, ordered from most to least relevant to the request. Omit places that don't fit at all. No prose.`;
  const candidates = alternatives.map((a) => ({ name: a.name, category: a.category, description: a.description }));
  const text = await planAgent(system, [
    { role: "user", content: `Request: "${query}"\nCandidates: ${JSON.stringify(candidates)}` },
  ]);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    return JSON.parse(text.slice(start, end + 1)) as string[];
  } catch {
    return [];
  }
}

export default function TripDetailSwapItem() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();

  const dayNumber = Number(searchParams.get("day"));
  const slotName = searchParams.get("slot") || "";

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<Site[]>([]);
  const [rankedNames, setRankedNames] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [swapping, setSwapping] = useState(false);

  useTrackScreen("trip_swap_item");

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
        return db("getSites", { cityId: slugify(found.city) }).then((sites: Site[]) => {
          const usedNames = new Set(
            found.days.flatMap((d) => d.slots.filter((s) => !s._removed).map((s) => s.name)),
          );
          setAlternatives(
            (sites || [])
              .filter((s) => !usedNames.has(s.name))
              .map((s) => ({ ...s, category: normalizeCategory(s.category) })),
          );
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trip"))
      .finally(() => setLoading(false));
  }, [authLoading, session?.user?.id, tripId]);

  const currentSlot: TripSlot | null = useMemo(() => {
    const day = trip?.days.find((d) => d.day === dayNumber);
    return day?.slots.find((s) => s.name === slotName) || null;
  }, [trip, dayNumber, slotName]);

  const visibleAlternatives = useMemo(() => {
    if (!rankedNames) return alternatives;
    const byName = new Map(alternatives.map((a) => [a.name, a]));
    return rankedNames.map((name) => byName.get(name)).filter((a): a is Site => Boolean(a));
  }, [alternatives, rankedNames]);

  const closeSwap = () => navigate(`/trip/${tripId}`);

  async function handleAsk(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setAsking(true);
    try {
      const ranked = await rankByQuery(query, alternatives);
      setRankedNames(ranked.length > 0 ? ranked : null);
    } catch {
      // leave the manual list as-is on failure
    } finally {
      setAsking(false);
    }
  }

  async function selectAlternative(site: Site) {
    if (!trip || swapping) return;
    setSwapping(true);
    try {
      const newSlot: TripSlot = {
        time: currentSlot?.time || "",
        name: site.name,
        description: site.description,
        category: site.category,
        tags: site.tags || [],
        lat: site.lat,
        lng: site.lng,
        mapUrl: site.map_url || `https://maps.google.com/?q=${encodeURIComponent(site.name)}`,
      };
      const updatedDays = trip.days.map((day) =>
        day.day !== dayNumber
          ? day
          : { ...day, slots: day.slots.map((s) => (s.name === slotName ? newSlot : s)) },
      );
      await db("updateTripStatus", { tripId, days: updatedDays });
      navigate(`/trip/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't swap this stop.");
      setSwapping(false);
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

  if (!trip) return null;

  const metaParts = [
    trip.duration ? `${trip.duration} DAYS` : null,
    trip.group_type?.toUpperCase(),
    trip.pace?.toUpperCase(),
  ].filter(Boolean);

  return (
    <div className="px-[48px] py-[32px]">
      <Link to={`/trip/${tripId}`} className="text-[13px] font-medium text-text-secondary">
        ← Back to Trip
      </Link>

      <div className="relative mt-[24px] h-[240px] rounded-[24px] bg-secondary-purple overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[358px] bg-gradient-to-b from-black/50 to-transparent" />
        <div className="absolute left-[24px] bottom-[40px]">
          <p className="font-heading font-semibold text-[24px] text-white">{trip.city}</p>
          <p className="font-medium text-[10px] text-white/72 tracking-[1px] mt-[8px]">{metaParts.join(" · ")}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/trip/${tripId}/customise`)}
          className="!w-[140px] !h-[44px] !border-white !text-white absolute right-[24px] top-[24px]"
        >
          EDIT TRIP
        </Button>
      </div>

      {error && <p className="text-primary-orange text-[13px] mt-[16px]">{error}</p>}

      <div className="flex gap-[48px] mt-[32px] items-start flex-wrap">
        <div className="flex-1 min-w-0 max-w-[680px] flex flex-col gap-[28px]">
          {trip.days.map((day) => (
            <div key={day.day}>
              <p className="font-bold text-[15px] text-secondary-purple tracking-[0.6px]">
                {day.label || `DAY ${day.day}`}
              </p>
              <div className="mt-[16px] flex flex-col gap-[5px]">
                {day.slots
                  .filter((slot) => !slot._removed)
                  .map((slot) => {
                    const isSwapping = day.day === dayNumber && slot.name === slotName;
                    return (
                      <div
                        key={slot.name}
                        className={`flex items-start gap-[16px] rounded-[12px] px-[16px] py-[10px] ${
                          isSwapping ? "bg-secondary-purple" : ""
                        }`}
                      >
                        <p
                          className={`w-[70px] shrink-0 mt-[2px] font-medium text-[12px] ${
                            isSwapping ? "text-white/80" : "text-text-secondary"
                          }`}
                        >
                          {slot.time}
                        </p>
                        <div className="flex-1">
                          <p
                            className={`font-heading font-semibold text-[16px] ${
                              isSwapping ? "text-white" : "text-text-primary"
                            }`}
                          >
                            {slot.name}
                          </p>
                          <p
                            className={`text-[13px] leading-[1.4] mt-[4px] ${
                              isSwapping ? "text-white/80" : "text-text-secondary"
                            }`}
                          >
                            {slot.description}
                          </p>
                        </div>
                        <Link
                          to={`/trip/${tripId}/swap?day=${day.day}&slot=${encodeURIComponent(slot.name)}`}
                          aria-label={`Swap ${slot.name}`}
                          className="shrink-0"
                        >
                          <img src={swapIcon} alt="" className="size-[32px]" />
                        </Link>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        <div className="w-[420px] max-w-full shrink-0 rounded-[20px] border border-secondary-purple bg-white shadow-[0px_8px_32px_0px_rgba(48,48,48,0.12)] p-[23px]">
          <div className="flex items-start justify-between gap-[12px]">
            <p className="font-heading font-semibold text-[18px] text-text-primary">
              Replace &quot;{slotName}&quot;
            </p>
            <button onClick={closeSwap} aria-label="Close" className="size-[16px] shrink-0 mt-[4px]">
              <img src={closeIcon} alt="" className="size-full" />
            </button>
          </div>

          <p className="font-medium text-[10px] text-primary-orange tracking-[0.4px] mt-[16px]">ASK BATTUTA AI</p>
          <form className="relative mt-[8px]" onSubmit={handleAsk}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "somewhere quieter" or "more food-focused"'
              className="w-full h-[52px] rounded-[14px] bg-surface-lavender pl-[18px] pr-[56px] text-[13px] text-text-primary placeholder:text-text-secondary outline-none"
            />
            <button
              type="submit"
              aria-label="Ask Battuta AI"
              disabled={asking}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-primary-orange flex items-center justify-center disabled:opacity-60"
            >
              <img src={askAiArrow} alt="" className="size-[10px]" />
            </button>
          </form>
          {asking && <p className="text-[11px] text-text-secondary mt-[8px]">Asking Battuta…</p>}
          {rankedNames && !asking && (
            <button
              onClick={() => {
                setRankedNames(null);
                setQuery("");
              }}
              className="text-[11px] text-secondary-purple mt-[8px] underline"
            >
              Clear AI suggestions
            </button>
          )}

          <div className="flex items-center gap-[12px] mt-[24px]">
            <div className="flex-1 h-px bg-text-secondary" />
            <p className="text-[11px] text-text-secondary whitespace-nowrap">or browse manually</p>
            <div className="flex-1 h-px bg-text-secondary" />
          </div>

          <div className="flex flex-col gap-[12px] mt-[16px] max-h-[420px] overflow-y-auto">
            {visibleAlternatives.length === 0 && (
              <p className="text-[13px] text-text-secondary">No alternatives found for {trip.city}.</p>
            )}
            {visibleAlternatives.map((site) => (
              <AlternativeItem key={site.id} site={site} onClick={() => selectAlternative(site)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
