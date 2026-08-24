import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import heroIllustration from "../assets/plan/hero-illustration.svg";
import sendArrow from "../assets/plan/send-arrow.svg";
import TagPill from "../components/TagPill";
import Button from "../components/Button";
import BrandMark from "../components/BrandMark";
import PlanDatePicker from "../components/PlanDatePicker";
import { planAgent, db } from "../lib/api";
import { ensureCitySites } from "../lib/sites";
import { slugify } from "../lib/geo";
import { CATEGORIES } from "../lib/categories";
import { planItinerary } from "../lib/itineraryPlanner";
import { useAuth } from "../lib/AuthContext";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import {
  GATHER_SYSTEM_PROMPT,
  parsePartial,
  type PlanPartial,
  buildDayLabelsSystemPrompt,
  parseDayLabels,
  type ItineraryResult,
  GROUP_TYPES,
  PACE_OPTIONS,
  INTEREST_TAGS,
} from "../lib/planFlow";
import type { Site } from "../lib/types";

const SUGGESTIONS = ["Umrah Trip", "Flying Solo", "Family Vacation", "Couples Getaway"];

type ChatMessage = { role: "user" | "assistant"; content: string; time: string };
type Phase = "landing" | "chat" | "selecting" | "building";
type Step = "city" | "followup" | "dates" | "party" | "interests" | "pace" | "mode";

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
        <div className="flex items-center gap-[8px]">
          <p className="font-heading font-semibold text-[14px] text-text-primary">{site.name}</p>
          {site.must_see && (
            <span className="shrink-0 rounded-[8px] bg-primary-orange/15 text-primary-orange text-[10px] font-bold tracking-[0.4px] px-[6px] py-[2px]">
              MUST-SEE
            </span>
          )}
        </div>
        <p className="text-[11px] text-secondary-purple font-medium mt-[2px]">{site.category}</p>
        <p className="text-[12px] text-text-secondary mt-[6px] line-clamp-2">{site.description}</p>
      </div>
    </button>
  );
}

/**
 * Ranks places matching the traveller's chosen interests (or all places, if none chosen) ahead of
 * the rest, with must-see places bypassing the interest filter entirely so they're never crowded
 * out of the default selection just because their category wasn't picked.
 */
function pickDefaultPlaces(sites: Site[], interests: string[]): Set<string> {
  const CAP = 14;
  const ranked = [...sites].sort((a, b) => {
    const aMatch = !!a.must_see || interests.length === 0 || interests.includes(a.category);
    const bMatch = !!b.must_see || interests.length === 0 || interests.includes(b.category);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    return Number(!!b.must_see) - Number(!!a.must_see);
  });
  return new Set(ranked.slice(0, CAP).map((s) => s.name));
}

function BotRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-[10px]">
      <div className="size-[32px] rounded-full bg-secondary-purple flex items-center justify-center shrink-0">
        <BrandMark className="text-white" size={16} />
      </div>
      {children}
    </div>
  );
}

function PillChoice({ options, onSelect }: { options: string[]; onSelect: (option: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[10px] max-w-[420px]">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="bg-white border border-secondary-purple rounded-[20px] px-[16px] py-[10px] text-[13px] font-medium text-text-primary hover:bg-surface-lavender/60 transition-colors"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function InterestChoice({
  selected,
  onToggle,
  onContinue,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex flex-col gap-[12px] max-w-[420px]">
      <div className="flex flex-wrap gap-[10px]">
        {INTEREST_TAGS.map((tag) => (
          <TagPill key={tag} label={tag} active={selected.includes(tag)} onClick={() => onToggle(tag)} />
        ))}
      </div>
      <button
        onClick={onContinue}
        className="self-start bg-primary-orange text-white text-[13px] font-bold tracking-[0.5px] rounded-[14px] px-[20px] py-[10px]"
      >
        CONTINUE
      </button>
    </div>
  );
}

function ModeChoice({
  onBrowse,
  onAuto,
  disabled,
}: {
  onBrowse: () => void;
  onAuto: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-[10px] max-w-[440px]">
      <div className="flex flex-col sm:flex-row gap-[10px]">
        <button
          onClick={onBrowse}
          disabled={disabled}
          className="text-left flex-1 rounded-[16px] border border-secondary-purple px-[18px] py-[14px] hover:bg-surface-lavender/40 transition-colors disabled:opacity-50"
        >
          <p className="font-heading font-semibold text-[14px] text-text-primary">Let me pick the places</p>
          <p className="text-[12px] text-text-secondary mt-[2px]">Browse suggested spots and choose what goes in.</p>
        </button>
        <button
          onClick={onAuto}
          disabled={disabled}
          className="text-left flex-1 rounded-[16px] border border-secondary-purple bg-secondary-purple/5 px-[18px] py-[14px] hover:bg-surface-lavender/40 transition-colors disabled:opacity-50"
        >
          <p className="font-heading font-semibold text-[14px] text-text-primary">Build it for me</p>
          <p className="text-[12px] text-text-secondary mt-[2px]">Get a full itinerary now — fine-tune it after.</p>
        </button>
      </div>
      {disabled && <p className="text-[11px] text-text-secondary">Still gathering places for you…</p>}
    </div>
  );
}

export default function Plan() {
  const navigate = useNavigate();
  const { session } = useAuth();

  const [phase, setPhase] = useState<Phase>("landing");
  const [step, setStep] = useState<Step>("city");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [partial, setPartial] = useState<PlanPartial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followupNotes, setFollowupNotes] = useState("");

  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [groupType, setGroupType] = useState(GROUP_TYPES[1]);
  const [pace, setPace] = useState(PACE_OPTIONS[0]);
  const [interests, setInterests] = useState<string[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [placeFilters, setPlaceFilters] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const sitesPromiseRef = useRef<Promise<void> | null>(null);
  const userTouchedPlacesRef = useRef(false);

  useTrackScreen("plan");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending, step]);

  // Places load before interests are known (loadSites fires right after the city step), so the
  // default selection is re-ranked here once interests are set — but only until the user starts
  // manually toggling places themselves.
  useEffect(() => {
    if (sites.length === 0 || userTouchedPlacesRef.current) return;
    setSelectedPlaces(pickDefaultPlaces(sites, interests));
  }, [sites, interests]);

  function askStep(next: Step, question: string) {
    setStep(next);
    setMessages((prev) => [...prev, { role: "assistant", content: question, time: nowLabel() }]);
  }

  function answerStep(answer: string, next: Step, nextQuestion?: string) {
    setMessages((prev) => [...prev, { role: "user", content: answer, time: nowLabel() }]);
    if (nextQuestion) askStep(next, nextQuestion);
    else setStep(next);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    if (phase === "landing") track("Plan Started");
    track("Plan Message Sent", { stage: phase });
    const nextMessages = [...messages, { role: "user" as const, content: trimmed, time: nowLabel() }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError(null);
    setPhase("chat");
    try {
      const reply = await planAgent(
        GATHER_SYSTEM_PROMPT,
        nextMessages.map(({ role, content }) => ({ role, content })),
      );
      const { partial: parsed, cleanText } = parsePartial(reply);
      setMessages([...nextMessages, { role: "assistant", content: cleanText || reply, time: nowLabel() }]);
      if (parsed && parsed.city && parsed.duration) {
        setPartial(parsed);
        track("Plan Details Extracted", { city: parsed.city, dates: parsed.dates, duration: parsed.duration });
        sitesPromiseRef.current = loadSites(parsed);
        askStep(
          "followup",
          `Will you only be exploring ${parsed.city}, or are you interested in nearby cities too? And is there anything specific you don't want to miss?`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(message);
      track("Plan AI Failed", { reason: message });
    } finally {
      setSending(false);
    }
  }

  function submitFollowup(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    setFollowupNotes(trimmed);
    setInput("");
    answerStep(
      trimmed || "Just this city, nothing specific in mind.",
      "dates",
      "Perfect. Do you have specific travel dates in mind?",
    );
  }

  function confirmDates(label: string) {
    setPartial((prev) => (prev ? { ...prev, dates: label } : prev));
    answerStep(label, "party", "Who's this trip for — just you, or are you bringing company?");
  }

  function selectParty(g: string) {
    setGroupType(g);
    answerStep(g, "interests", "Any particular interests I should prioritize? Pick as many as you like, or skip ahead.");
  }

  function continueInterests() {
    const label = interests.length > 0 ? interests.join(", ") : "No particular interests — surprise me.";
    answerStep(label, "pace", "Got it. Do you prefer a relaxed pace or a packed schedule?");
  }

  function selectPace(p: string) {
    setPace(p);
    answerStep(
      p,
      "mode",
      "Last thing — want to pick the exact places yourself, or should I put together a full itinerary you can fine-tune afterward?",
    );
  }

  async function chooseBrowse() {
    setMessages((prev) => [...prev, { role: "user", content: "I'll pick the places myself.", time: nowLabel() }]);
    setPlaceFilters(interests);
    setPhase("selecting");
  }

  async function chooseAutoBuild() {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Build it for me — I'll fine-tune it after.", time: nowLabel() },
    ]);
    if (sitesPromiseRef.current) await sitesPromiseRef.current;
    buildTrip();
  }

  async function loadSites(p: PlanPartial) {
    setLoadingSites(true);
    try {
      const cityId = slugify(p.city);
      const result = await ensureCitySites(cityId, p.city, p.country_id, p.country);
      setSites(result);
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

  function togglePlaceFilter(tag: string) {
    setPlaceFilters((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function togglePlace(name: string) {
    userTouchedPlacesRef.current = true;
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
      const days = planItinerary(chosen, duration, pace);
      if (days.every((d) => d.slots.length === 0)) {
        track("Itinerary Build Failed", { reason: "no_places_fit" });
        throw new Error("Couldn't build the itinerary — try again.");
      }

      try {
        const labelText = await planAgent(buildDayLabelsSystemPrompt(partial.city, days, followupNotes || undefined), [
          { role: "user", content: "Write the day titles now." },
        ]);
        const labels = parseDayLabels(labelText);
        if (labels && labels.length === days.length) {
          days.forEach((day, i) => {
            day.label = `Day ${day.day} — ${labels[i]}`;
          });
        }
      } catch {
        // Fall back to the planner's plain "Day N" labels — titles are cosmetic, not worth failing the build over.
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
      <div className="relative px-4 sm:px-10 md:px-16 lg:px-[80px] py-16 sm:py-24 md:py-32 lg:py-[140px] max-w-[1180px]">
        <img src={heroIllustration} alt="" className="hidden lg:block absolute right-[80px] top-[140px] w-[203px]" />

        <p className="font-medium text-[12px] text-primary-orange tracking-[1.44px]">YOUR TRAVEL AI AGENT</p>
        <h1 className="font-heading font-semibold text-[32px] sm:text-[40px] md:text-[48px] leading-[1.15] text-text-primary mt-[16px] max-w-[600px]">
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
            className="w-full h-[64px] sm:h-[76px] rounded-[24px] border-[1.5px] border-secondary-purple shadow-[0px_16px_40px_0px_rgba(48,48,48,0.12)] pl-[20px] sm:pl-[26px] pr-[70px] sm:pr-[80px] text-[15px] sm:text-[16px] text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button
            type="submit"
            aria-label="Send"
            className="absolute right-[10px] sm:right-[12px] top-1/2 -translate-y-1/2 size-[44px] sm:size-[52px] rounded-full bg-primary-orange flex items-center justify-center"
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
    const showTextInput = step === "city" || step === "followup";
    return (
      <div className="px-4 sm:px-10 md:px-16 lg:px-[80px] py-6 sm:py-10 md:py-[60px] max-w-[760px] flex flex-col h-[calc(100vh-60px)] md:h-[calc(100vh-120px)]">
        {step === "dates" && partial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4">
            <PlanDatePicker duration={partial.duration || 1} onConfirm={confirmDates} />
          </div>
        )}

        <div className="flex flex-col flex-1 min-h-0 rounded-[24px] border border-secondary-purple/25 bg-white shadow-[0px_16px_40px_0px_rgba(48,48,48,0.06)] overflow-hidden">
          <div className="flex items-center gap-[12px] px-[20px] sm:px-[24px] h-[68px] shrink-0 border-b border-text-primary/10">
            <div className="size-[38px] rounded-full bg-secondary-purple flex items-center justify-center shrink-0">
              <BrandMark className="text-white" size={20} />
            </div>
            <div>
              <p className="font-heading font-semibold text-[15px] text-text-primary leading-tight">Battuta</p>
              <p className="font-medium text-[11px] text-primary-orange tracking-[0.9px]">YOUR TRAVEL AI AGENT</p>
            </div>
          </div>

          <div className="flex flex-col gap-[16px] flex-1 min-h-0 overflow-y-auto px-[20px] sm:px-[24px] py-[24px]">
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <BotRow key={i}>
                  <div className="flex flex-col gap-[4px] max-w-[85%] sm:max-w-[480px]">
                    <div className="rounded-[20px] rounded-bl-[6px] px-[20px] py-[14px] text-[15px] leading-[1.5] bg-surface-lavender text-text-primary">
                      {m.content}
                    </div>
                    <span className="text-[11px] text-text-secondary pl-[4px]">{m.time}</span>
                  </div>
                </BotRow>
              ) : (
                <div key={i} className="self-end flex flex-col items-end gap-[4px] max-w-[85%] sm:max-w-[480px]">
                  <div className="rounded-[20px] rounded-br-[6px] px-[20px] py-[14px] text-[15px] leading-[1.5] bg-secondary-purple text-white">
                    {m.content}
                  </div>
                  <span className="text-[11px] text-text-secondary pr-[4px]">{m.time}</span>
                </div>
              ),
            )}

            {sending && (
              <BotRow>
                <div className="rounded-[20px] rounded-bl-[6px] px-[20px] py-[16px] bg-surface-lavender flex items-center gap-[5px]">
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce" />
                </div>
              </BotRow>
            )}

            {!sending && step === "party" && (
              <BotRow>
                <PillChoice options={GROUP_TYPES} onSelect={selectParty} />
              </BotRow>
            )}

            {!sending && step === "interests" && (
              <BotRow>
                <InterestChoice selected={interests} onToggle={toggleInterest} onContinue={continueInterests} />
              </BotRow>
            )}

            {!sending && step === "pace" && (
              <BotRow>
                <PillChoice options={PACE_OPTIONS} onSelect={selectPace} />
              </BotRow>
            )}

            {!sending && step === "mode" && (
              <BotRow>
                <ModeChoice onBrowse={chooseBrowse} onAuto={chooseAutoBuild} disabled={loadingSites && sites.length === 0} />
              </BotRow>
            )}

            {error && <p className="text-primary-orange text-[13px]">{error}</p>}
            <div ref={messagesEndRef} />
          </div>

          {showTextInput && (
            <form
              className="relative shrink-0 px-[20px] sm:px-[24px] py-[16px] border-t border-text-primary/10"
              onSubmit={step === "city" ? (e) => { e.preventDefault(); sendMessage(input); } : submitFollowup}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={step === "city" ? "Reply to Battuta…" : "e.g. also want to see Petra, or just this city"}
                className="w-full h-[52px] rounded-[18px] bg-surface-lavender pl-[20px] pr-[64px] text-[15px] text-text-primary placeholder:text-text-secondary outline-none"
              />
              <button
                type="submit"
                aria-label="Send"
                className="absolute right-[28px] top-1/2 -translate-y-1/2 size-[38px] rounded-full bg-primary-orange flex items-center justify-center"
              >
                <img src={sendArrow} alt="" className="size-[11px]" />
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // selecting / building
  return (
    <div className="px-4 sm:px-6 md:px-10 lg:px-[48px] py-6 md:py-[40px] max-w-[1180px]">
      <h1 className="font-heading font-semibold text-[26px] text-text-primary">
        Planning {partial?.city}
      </h1>
      <p className="text-[13px] text-text-secondary mt-[6px]">
        {partial?.duration} days · {partial?.dates || "flexible dates"} · {groupType} · {pace}
        {interests.length > 0 ? ` · ${interests.join(", ")}` : ""}
      </p>

      <div className="flex flex-col gap-[24px] mt-[32px]">
        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">
            Places ({selectedPlaces.size} selected)
          </p>
          <div className="flex flex-wrap gap-[8px] mt-[12px]">
            {CATEGORIES.map((tag) => (
              <TagPill key={tag} label={tag} active={placeFilters.includes(tag)} onClick={() => togglePlaceFilter(tag)} />
            ))}
          </div>
          {loadingSites && <p className="text-text-secondary text-[14px] mt-[12px]">Finding places in {partial?.city}…</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] mt-[12px]">
            {sites
              .filter((site) => placeFilters.length === 0 || site.must_see || placeFilters.includes(site.category))
              .map((site) => (
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
          className="!w-full sm:!w-[280px]"
          disabled={phase === "building" || selectedPlaces.size === 0}
          onClick={buildTrip}
        >
          {phase === "building" ? "BUILDING YOUR TRIP…" : "BUILD MY ITINERARY"}
        </Button>
      </div>
    </div>
  );
}
