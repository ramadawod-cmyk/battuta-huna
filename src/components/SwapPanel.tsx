import { useEffect, useMemo, useState, type FormEvent } from "react";
import AllSitesListItem from "./AllSitesListItem";
import closeIcon from "../assets/trip-swap/close-icon.svg";
import askAiArrow from "../assets/trip-swap/ask-ai-arrow.svg";
import { db, planAgent } from "../lib/api";
import { activityToCandidate } from "../lib/activities";
import { categoryOrActivityLabelKey, normalizeCategory, getDurationMinutes } from "../lib/categories";
import { useTranslation } from "../lib/LanguageContext";
import { slugify } from "../lib/geo";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import type { Activity, Site, Trip, TripDay, TripSlot } from "../lib/types";

function AlternativeItem({ site, onClick }: { site: Site; onClick: () => void }) {
  const { t, language } = useTranslation();
  const imageUrl = useWikiThumbnail(site.name);
  const name = language === "ar" && site.name_ar ? site.name_ar : site.name;
  const description = language === "ar" && site.description_ar ? site.description_ar : site.description;
  return (
    <AllSitesListItem
      name={name}
      category={t(categoryOrActivityLabelKey(site.category)).toUpperCase()}
      description={description}
      className="max-w-none"
      imageUrl={site.image_url || imageUrl}
      badge={site.kind === "activity" ? t("plan.activityBadge") : undefined}
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

type SwapPanelProps = {
  trip: Trip;
  tripId: string;
  day: number;
  slotName: string;
  onClose: () => void;
  onSwapped: (updatedDays: TripDay[]) => void;
};

// Renders in-place as a modal over TripDetail — no route change, so the trip stays mounted and
// the transition is instant instead of unmounting the page to re-fetch everything from scratch.
export default function SwapPanel({ trip, tripId, day, slotName, onClose, onSwapped }: SwapPanelProps) {
  const { t, language } = useTranslation();
  const [alternatives, setAlternatives] = useState<Site[]>([]);
  const [rankedNames, setRankedNames] = useState<string[] | null>(null);
  const [query, setQuery] = useState("");
  const [asking, setAsking] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDay = useMemo(() => trip.days.find((d) => d.day === day), [trip, day]);
  const currentSlot: TripSlot | null = useMemo(
    () => currentDay?.slots.find((s) => s.name === slotName) || null,
    [currentDay, slotName],
  );
  // A multi-destination trip's days each belong to a leg -- swap alternatives must come from
  // that day's city, not the trip's overall (first-leg) city, or a Florence day would offer Rome
  // replacements. Falls back to the trip's city for pre-multi-destination trips (no day.city).
  const dayCityName = currentDay?.city || trip.city;
  const dayCityId = currentDay?.cityId || slugify(dayCityName);

  useEffect(() => {
    Promise.all([db("getSites", { cityId: dayCityId }), db("getActivities", { cityId: dayCityId })])
      .then(([sites, activities]: [Site[], Activity[]]) => {
        const usedNames = new Set(
          trip.days.flatMap((d) => d.slots.filter((s) => !s._removed).map((s) => s.name)),
        );
        const siteCandidates = (sites || [])
          .filter((s) => !usedNames.has(s.name))
          .map((s) => ({ ...s, category: normalizeCategory(s.category) }));
        // Not run through normalizeCategory -- that's the site taxonomy and would misclassify an
        // activity type like "Beach & Swim" onto an unrelated site category.
        const activityCandidates = (activities || [])
          .filter((a) => !usedNames.has(a.name))
          .map(activityToCandidate);
        setAlternatives([...siteCandidates, ...activityCandidates]);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("trip.loadFailed")));
  }, [trip, day, slotName, dayCityId]);

  const visibleAlternatives = useMemo(() => {
    if (!rankedNames) return alternatives;
    const byName = new Map(alternatives.map((a) => [a.name, a]));
    return rankedNames.map((name) => byName.get(name)).filter((a): a is Site => Boolean(a));
  }, [alternatives, rankedNames]);

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
    if (swapping) return;
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
        durationMinutes: getDurationMinutes(site),
        kind: site.kind,
        nameAr: site.name_ar,
        descriptionAr: site.description_ar,
      };
      const updatedDays = trip.days.map((d) =>
        d.day !== day ? d : { ...d, slots: d.slots.map((s) => (s.name === slotName ? newSlot : s)) },
      );
      await db("updateTripStatus", { tripId, days: updatedDays });
      onSwapped(updatedDays);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("swap.swapFailed"));
      setSwapping(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4" onClick={onClose}>
      <div
        className="w-[420px] max-w-full max-h-[calc(100dvh-32px)] overflow-y-auto rounded-[20px] border border-secondary-purple bg-white shadow-[0px_8px_32px_0px_rgba(48,48,48,0.12)] p-[23px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-[12px]">
          <p className="font-heading font-semibold text-[18px] text-text-primary">
            {t("swap.replaceTitle", { name: language === "ar" && currentSlot?.nameAr ? currentSlot.nameAr : slotName })}
          </p>
          <button onClick={onClose} aria-label={t("swap.close")} className="size-[16px] shrink-0 mt-[4px]">
            <img src={closeIcon} alt="" className="size-full" />
          </button>
        </div>

        {error && <p className="text-primary-orange text-[13px] mt-[12px]">{error}</p>}

        <p className="font-medium text-[10px] text-primary-orange tracking-[0.4px] mt-[16px]">{t("swap.askAi")}</p>
        <form className="relative mt-[8px]" onSubmit={handleAsk}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("swap.askPlaceholder")}
            className="w-full h-[52px] rounded-[14px] bg-surface-lavender ps-[18px] pe-[56px] text-[13px] text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button
            type="submit"
            aria-label={t("swap.askAiAria")}
            disabled={asking}
            className="absolute end-[8px] top-1/2 -translate-y-1/2 size-[36px] rounded-full bg-primary-orange flex items-center justify-center disabled:opacity-60"
          >
            <img src={askAiArrow} alt="" className="size-[10px]" />
          </button>
        </form>
        {asking && <p className="text-[11px] text-text-secondary mt-[8px]">{t("swap.asking")}</p>}
        {rankedNames && !asking && (
          <button
            onClick={() => {
              setRankedNames(null);
              setQuery("");
            }}
            className="text-[11px] text-secondary-purple mt-[8px] underline"
          >
            {t("swap.clearSuggestions")}
          </button>
        )}

        <div className="flex items-center gap-[12px] mt-[24px]">
          <div className="flex-1 h-px bg-text-secondary" />
          <p className="text-[11px] text-text-secondary whitespace-nowrap">{t("swap.orBrowseManually")}</p>
          <div className="flex-1 h-px bg-text-secondary" />
        </div>

        <div className="flex flex-col gap-[12px] mt-[16px] max-h-[420px] overflow-y-auto">
          {visibleAlternatives.length === 0 && (
            <p className="text-[13px] text-text-secondary">{t("swap.noAlternatives", { city: dayCityName })}</p>
          )}
          {visibleAlternatives.map((site) => (
            <AlternativeItem key={site.id} site={site} onClick={() => selectAlternative(site)} />
          ))}
        </div>
      </div>
    </div>
  );
}
