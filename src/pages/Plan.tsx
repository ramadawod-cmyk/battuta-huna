import { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroIllustration from "../assets/plan/hero-illustration.svg";
import sendArrow from "../assets/plan/send-arrow.svg";
import TagPill from "../components/TagPill";
import Button from "../components/Button";
import { planAgent, db } from "../lib/api";
import { ensureCitySites } from "../lib/sites";
import { slugify } from "../lib/geo";
import { useAuth } from "../lib/AuthContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import {
  GATHER_SYSTEM_PROMPT,
  parsePartial,
  type PlanPartial,
  buildDayItinerarySystemPrompt,
  parseDayItinerary,
  dedupeDaysByPlace,
  type ItineraryResult,
  GROUP_TYPES,
  PACE_OPTIONS,
  INTEREST_TAGS,
} from "../lib/planFlow";
import type { Site, TripDay } from "../lib/types";

const SUGGESTIONS = ["Umrah Trip", "Flying Solo", "Family Vacation", "Couples Getaway"];

type ChatMessage = { role: "user" | "assistant"; content: string };
type Phase = "landing" | "chat" | "selecting" | "building";

function PlaceCard({ site, active, onClick }: { site: Site; active: boolean; onClick: () => void }) {
  const imageUrl = useWikiThumbnail(site.name);
  const thumb = site.image_url || imageUrl;
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-[16px] border overflow-hidden transition-colors ${
        active ? "border-secondary-purple bg-surface-lavender" : "border-text-primary/20 bg-white"
      }`}
    >
      <div className="h-[90px] bg-surface-lavender">
        {thumb && (
          <img
            src={thumb}
            alt={site.name}
            onError={(e) => (e.currentTarget.style.display = "none")}
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="p-[16px]">
        <p className="font-heading font-semibold text-[14px] text-text-primary">{site.name}</p>
        <p className="text-[11px] text-secondary-purple font-medium mt-[2px]">{site.category}</p>
        <p className="text-[12px] text-text-secondary mt-[6px] line-clamp-2">{site.description}</p>
      </div>
    </button>
  );
}

export default function Plan() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [phase, setPhase] = useState<Phase>("landing");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [partial, setPartial] = useState<PlanPartial | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [groupType, setGroupType] = useState(GROUP_TYPES[1]);
  const [pace, setPace] = useState(PACE_OPTIONS[0]);
  const [interests, setInterests] = useState<string[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());

  useTrackScreen("plan");

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (phase === "landing") track("Plan Started");
    track("Plan Message Sent", { stage: phase });
    const nextMessages = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    setPhase("chat");
    try {
      const reply = await planAgent(GATHER_SYSTEM_PROMPT, nextMessages);
      const { partial: parsed, cleanText } = parsePartial(reply);
      setMessages([...nextMessages, { role: "assistant", content: cleanText || reply }]);
      if (parsed && parsed.city && parsed.duration) {
        setPartial(parsed);
        track("Plan Details Extracted", { city: parsed.city, dates: parsed.dates, duration: parsed.duration });
        await startPlaceSelection(parsed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      track("Plan AI Failed", { reason: message });
    } finally {
      setSending(false);
    }
  }

  async function startPlaceSelection(p: PlanPartial) {
    setPhase("selecting");
    setLoadingSites(true);
    try {
      const cityId = slugify(p.city);
      const result = await ensureCitySites(cityId, p.city, p.country_id, p.country);
      setSites(result);
      setSelectedPlaces(new Set(result.slice(0, 10).map((s) => s.name)));
      track("Places Suggested", { count: result.length, duration: p.duration });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't load places for this city.";
      setError(message);
      track("Places Suggested Failed", { message });
    } finally {
      setLoadingSites(false);
    }
  }

  function toggleInterest(tag: string) {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function togglePlace(name: string) {
    setSelectedPlaces((prev) => {
      const next = new Set(prev);
      const selected = !next.has(name);
      if (selected) next.add(name);
      else next.delete(name);
      track("Place Toggled", { name, selected, selected_count: next.size });
      return next;
    });
  }

  async function buildTrip() {
    if (!partial) return;
    setPhase("building");
    setError(null);
    const chosen = sites.filter((s) => selectedPlaces.has(s.name));
    track("Trip Details Submitted", {
      group_type: groupType,
      interests,
      pace,
      city: partial.city,
      duration: partial.duration,
    });
    track("Itinerary Build Started", { place_count: chosen.length, duration: partial.duration, pace });
    try {
      const duration = partial.duration || 3;
      const dayResults = await Promise.allSettled(
        Array.from({ length: duration }, (_, i) =>
          planAgent(
            buildDayItinerarySystemPrompt({
              city: partial.city,
              dates: partial.dates || null,
              duration,
              day: i + 1,
              groupType,
              pace,
              interests,
              places: chosen,
            }),
            [{ role: "user", content: "Build this day now." }],
          ),
        ),
      );
      const days = dedupeDaysByPlace(
        dayResults
          .map((r) => (r.status === "fulfilled" ? parseDayItinerary(r.value) : null))
          .filter((d): d is TripDay => d !== null)
          .sort((a, b) => a.day - b.day),
      );
      if (days.length === 0) {
        track("Itinerary Build Failed", { reason: "no_days_returned" });
        throw new Error("Couldn't build the itinerary — try again.");
      }
      const itinerary: ItineraryResult = { city: partial.city, dates: partial.dates || null, duration, groupType, pace, days };
      track("Itinerary Build Completed", { day_count: itinerary.days.length, duration: itinerary.duration, pace });

      const draft = await db("createDraftTrip", {
        trip: {
          city: itinerary.city,
          dates: itinerary.dates,
          duration: itinerary.duration,
          group_type: groupType,
          pace,
          days: [],
          auth_user_id: session?.user?.id || null,
        },
      });
      const tripId = draft?.[0]?.id;
      if (!tripId) throw new Error("Couldn't save the trip.");

      await db("updateTripStatus", { tripId, status: "ready", days: itinerary.days });
      track("Trip Saved", {
        trip_id: tripId,
        city: itinerary.city,
        day_count: itinerary.days.length,
        duration: itinerary.duration,
        logged_in: !!session,
      });
      navigate(`/trip/${tripId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong building your trip.";
      setError(message);
      track("Trip Save Failed", { city: partial.city, message });
      setPhase("selecting");
    }
  }

  if (phase === "landing") {
    return (
      <div className="relative px-[80px] py-[140px] max-w-[1180px]">
        <img src={heroIllustration} alt="" className="hidden lg:block absolute right-[80px] top-[140px] w-[203px]" />

        <p className="font-medium text-[12px] text-primary-orange tracking-[1.44px]">YOUR TRAVEL AI AGENT</p>
        <h1 className="font-heading font-semibold text-[48px] leading-[1.15] text-text-primary mt-[16px] max-w-[600px]">
          Where do you want to explore?
        </h1>
        <p className="text-[16px] leading-[1.5] text-text-secondary mt-[16px] max-w-[560px]">
          Tell Battuta where you're headed, and it plans the rest — sites, timing, and hidden gems, built around how
          you like to travel.
        </p>

        <form
          className="relative mt-[36px] w-full max-w-[600px]"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Plan a 5-day cultural trip to Amman for two"'
            className="w-full h-[76px] rounded-[24px] border-[1.5px] border-secondary-purple shadow-[0px_16px_40px_0px_rgba(48,48,48,0.12)] pl-[26px] pr-[80px] text-[16px] text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="absolute right-[12px] top-1/2 -translate-y-1/2 size-[52px] rounded-full bg-primary-orange flex items-center justify-center"
          >
            <img src={sendArrow} alt="" className="size-[12px]" />
          </button>
        </form>

        <div className="flex gap-[10px] mt-[24px] flex-wrap">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="bg-white border border-secondary-purple rounded-[20px] px-[16px] py-[10px] text-[13px] font-medium text-text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "chat") {
    return (
      <div className="px-[80px] py-[60px] max-w-[760px] flex flex-col min-h-[calc(100vh-120px)]">
        <p className="font-medium text-[12px] text-primary-orange tracking-[1.44px]">YOUR TRAVEL AI AGENT</p>
        <div className="flex flex-col gap-[16px] mt-[24px] flex-1">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[480px] rounded-[20px] px-[20px] py-[14px] text-[15px] leading-[1.5] ${
                m.role === "user"
                  ? "self-end bg-secondary-purple text-white"
                  : "self-start bg-surface-lavender text-text-primary"
              }`}
            >
              {m.content}
            </div>
          ))}
          {sending && <p className="text-text-secondary text-[13px]">Battuta is thinking…</p>}
          {error && <p className="text-primary-orange text-[13px]">{error}</p>}
        </div>

        <form
          className="relative mt-[24px] w-full"
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Reply to Battuta…"
            className="w-full h-[60px] rounded-[20px] border-[1.5px] border-secondary-purple pl-[24px] pr-[70px] text-[15px] text-text-primary outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="absolute right-[10px] top-1/2 -translate-y-1/2 size-[42px] rounded-full bg-primary-orange flex items-center justify-center"
          >
            <img src={sendArrow} alt="" className="size-[11px]" />
          </button>
        </form>
      </div>
    );
  }

  // selecting / building
  return (
    <div className="px-[48px] py-[40px] max-w-[1180px]">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">
        Planning {partial?.city}
      </h1>
      <p className="text-[13px] text-text-secondary mt-[6px]">
        {partial?.duration} days · {partial?.dates || "flexible dates"}
      </p>

      <div className="flex flex-col gap-[24px] mt-[32px]">
        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">Group type</p>
          <div className="flex gap-[10px] mt-[12px] flex-wrap">
            {GROUP_TYPES.map((g) => (
              <TagPill key={g} label={g} active={groupType === g} onClick={() => setGroupType(g)} />
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">Interests</p>
          <div className="flex gap-[10px] mt-[12px] flex-wrap">
            {INTEREST_TAGS.map((tag) => (
              <TagPill key={tag} label={tag} active={interests.includes(tag)} onClick={() => toggleInterest(tag)} />
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">Pace</p>
          <div className="flex gap-[10px] mt-[12px] flex-wrap">
            {PACE_OPTIONS.map((p) => (
              <TagPill key={p} label={p} active={pace === p} onClick={() => setPace(p)} />
            ))}
          </div>
        </div>

        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">
            Places ({selectedPlaces.size} selected)
          </p>
          {loadingSites && <p className="text-text-secondary text-[14px] mt-[12px]">Finding places in {partial?.city}…</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] mt-[12px]">
            {sites.map((site) => (
              <PlaceCard
                key={site.id}
                site={site}
                active={selectedPlaces.has(site.name)}
                onClick={() => togglePlace(site.name)}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-primary-orange text-[13px]">{error}</p>}

        <Button
          variant="orange"
          className="!w-[280px]"
          disabled={phase === "building" || selectedPlaces.size === 0}
          onClick={buildTrip}
        >
          {phase === "building" ? "BUILDING YOUR TRIP…" : "BUILD MY ITINERARY"}
        </Button>
      </div>
    </div>
  );
}
