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
import { activityToCandidate, ensureCityActivities } from "../lib/activities";
import { categoryOrActivityLabelKey } from "../lib/categories";
import { slugify } from "../lib/geo";
import { planMultiCityItinerary, type ItineraryLeg } from "../lib/itineraryPlanner";
import { pickDefaultPlacesForLegs } from "../lib/placeSelection";
import { useAuth } from "../lib/AuthContext";
import { useTranslation } from "../lib/LanguageContext";
import type en from "../lib/i18n/en";
import { useWikiThumbnail } from "../lib/useWikiThumbnail";
import { track } from "../lib/analytics";
import { useTrackScreen } from "../lib/useTrackScreen";
import {
  buildGatherSystemPrompt,
  parsePartial,
  type PlanPartial,
  type PlanLeg,
  buildDayLabelsSystemPrompt,
  parseDayLabels,
  type ItineraryResult,
  GROUP_TYPES,
  PACE_OPTIONS,
  GROUP_LABEL_KEYS,
  PACE_LABEL_KEYS,
  INTEREST_TAGS,
} from "../lib/planFlow";
import type { Site } from "../lib/types";

function legsLabel(legs: PlanLeg[]): string {
  return legs.map((l) => l.city).join(" · ");
}

const SUGGESTION_KEYS: (keyof typeof en)[] = [
  "plan.suggestion.umrah",
  "plan.suggestion.solo",
  "plan.suggestion.family",
  "plan.suggestion.couples",
];


type ChatMessage = { role: "user" | "assistant"; content: string; time: string };
type Phase = "landing" | "chat" | "selecting" | "building";
type Step = "city" | "dates" | "followup" | "party" | "interests" | "pace" | "mode";

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PlaceCard({ site, active, onClick }: { site: Site; active: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  const imageUrl = useWikiThumbnail(site.name);
  const thumb = site.image_url || imageUrl;
  return (
    <button
      onClick={onClick}
      className={`text-start rounded-[16px] border overflow-hidden transition-colors ${
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
          {site.kind === "activity" && (
            <span className="shrink-0 rounded-[8px] bg-secondary-purple/15 text-secondary-purple text-[10px] font-bold tracking-[0.4px] px-[6px] py-[2px]">
              {t("plan.activityBadge")}
            </span>
          )}
          {site.must_see && (
            <span className="shrink-0 rounded-[8px] bg-primary-orange/15 text-primary-orange text-[10px] font-bold tracking-[0.4px] px-[6px] py-[2px]">
              {t("plan.mustSeeBadge")}
            </span>
          )}
        </div>
        <p className="text-[11px] text-secondary-purple font-medium mt-[2px]">{t(categoryOrActivityLabelKey(site.category))}</p>
        <p className="text-[12px] text-text-secondary mt-[6px] line-clamp-2">{site.description}</p>
      </div>
    </button>
  );
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

function PillChoice({
  options,
  labelFor,
  onSelect,
}: {
  options: string[];
  labelFor?: (option: string) => string;
  onSelect: (option: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-[10px] max-w-[420px]">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onSelect(opt)}
          className="bg-white border border-secondary-purple rounded-[20px] px-[16px] py-[10px] text-[13px] font-medium text-text-primary hover:bg-surface-lavender/60 transition-colors"
        >
          {labelFor ? labelFor(opt) : opt}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-[12px] max-w-[420px]">
      <div className="flex flex-wrap gap-[10px]">
        {INTEREST_TAGS.map((tag) => (
          <TagPill key={tag} label={t(categoryOrActivityLabelKey(tag))} active={selected.includes(tag)} onClick={() => onToggle(tag)} />
        ))}
      </div>
      <button
        onClick={onContinue}
        className="self-start bg-primary-orange text-white text-[13px] font-bold tracking-[0.5px] rounded-[14px] px-[20px] py-[10px]"
      >
        {t("plan.continue")}
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
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-[10px] max-w-[440px]">
      <div className="flex flex-col sm:flex-row gap-[10px]">
        <button
          onClick={onBrowse}
          disabled={disabled}
          className="text-start flex-1 rounded-[16px] border border-secondary-purple px-[18px] py-[14px] hover:bg-surface-lavender/40 transition-colors disabled:opacity-50"
        >
          <p className="font-heading font-semibold text-[14px] text-text-primary">{t("plan.mode.pickTitle")}</p>
          <p className="text-[12px] text-text-secondary mt-[2px]">{t("plan.mode.pickDesc")}</p>
        </button>
        <button
          onClick={onAuto}
          disabled={disabled}
          className="text-start flex-1 rounded-[16px] border border-secondary-purple bg-secondary-purple/5 px-[18px] py-[14px] hover:bg-surface-lavender/40 transition-colors disabled:opacity-50"
        >
          <p className="font-heading font-semibold text-[14px] text-text-primary">{t("plan.mode.buildTitle")}</p>
          <p className="text-[12px] text-text-secondary mt-[2px]">{t("plan.mode.buildDesc")}</p>
        </button>
      </div>
      {disabled && <p className="text-[11px] text-text-secondary">{t("plan.mode.gathering")}</p>}
    </div>
  );
}

export default function Plan() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { t, language } = useTranslation();

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
    setSelectedPlaces(pickDefaultPlacesForLegs(sites, partial?.legs || [], interests));
  }, [sites, interests, partial?.legs]);

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
        buildGatherSystemPrompt(new Date(), language),
        nextMessages.map(({ role, content }) => ({ role, content })),
      );
      const { partial: parsed, cleanText } = parsePartial(reply);
      setMessages([...nextMessages, { role: "assistant", content: cleanText || reply, time: nowLabel() }]);
      if (parsed) {
        setPartial(parsed);
        track("Plan Details Extracted", {
          city: parsed.legs[0].city,
          leg_count: parsed.legs.length,
          dates: parsed.dates,
          duration: parsed.duration,
        });
        sitesPromiseRef.current = loadSites(parsed);
        askStep("dates", t("plan.q.dates"));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("plan.errGeneric");
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
    answerStep(trimmed || t("plan.noSpecificPlace"), "party", t("plan.q.party"));
  }

  function confirmDates(label: string) {
    setPartial((prev) => (prev ? { ...prev, dates: label } : prev));
    // Used to also ask "or are you interested in nearby cities too?" -- now redundant, since the
    // gathering agent itself already offers multi-destination trips during the first exchange
    // (see buildGatherSystemPrompt). The destination(s) are settled by this point.
    answerStep(label, "followup", t("plan.q.followup"));
  }

  function selectParty(g: string) {
    setGroupType(g);
    answerStep(t(GROUP_LABEL_KEYS[g]), "interests", t("plan.q.interests"));
  }

  function continueInterests() {
    const label =
      interests.length > 0
        ? interests.map((tag) => t(categoryOrActivityLabelKey(tag))).join(", ")
        : t("plan.noInterests");
    answerStep(label, "pace", t("plan.q.pace"));
  }

  function selectPace(p: string) {
    setPace(p);
    answerStep(t(PACE_LABEL_KEYS[p]), "mode", t("plan.q.mode"));
  }

  async function chooseBrowse() {
    setMessages((prev) => [...prev, { role: "user", content: t("plan.pickMyselfEcho"), time: nowLabel() }]);
    setPlaceFilters(interests);
    setPhase("selecting");
  }

  async function chooseAutoBuild() {
    setMessages((prev) => [
      ...prev,
      { role: "user", content: t("plan.buildForMeEcho"), time: nowLabel() },
    ]);
    if (sitesPromiseRef.current) await sitesPromiseRef.current;
    buildTrip();
  }

  async function loadSites(p: PlanPartial) {
    setLoadingSites(true);
    try {
      // Each leg fetches independently and in parallel; a failed leg (e.g. cold-start generation
      // error) contributes no sites rather than failing the whole trip -- the traveller can still
      // plan around whichever destinations did come back. Sites and activities are fetched in
      // parallel per leg too, then merged into one candidate pool -- activityToCandidate makes an
      // Activity look like a Site, so everything downstream (scheduler, ranking, cards) already
      // knows how to handle it with zero changes.
      const perLeg = await Promise.all(
        p.legs.map(async (leg) => {
          const cityId = slugify(leg.city);
          const [siteResult, activityResult] = await Promise.all([
            ensureCitySites(cityId, leg.city, leg.country_id, leg.country).catch((err) => {
              track("Places Suggested Failed", { city: leg.city, message: err instanceof Error ? err.message : String(err) });
              return [] as Site[];
            }),
            ensureCityActivities(cityId, leg.city, leg.country_id, leg.country).catch((err) => {
              track("Activities Suggested Failed", { city: leg.city, message: err instanceof Error ? err.message : String(err) });
              return [];
            }),
          ]);
          return [...siteResult, ...activityResult.map(activityToCandidate)];
        }),
      );
      const result = perLeg.flat();
      setSites(result);
      track("Places Suggested", {
        count: result.length,
        activity_count: result.filter((s) => s.kind === "activity").length,
        duration: p.duration,
        leg_count: p.legs.length,
      });
      if (result.length === 0) setError(t("plan.errLoadPlaces"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("plan.errLoadPlaces");
      setError(message);
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
      city: partial.legs[0].city,
      duration: partial.duration,
    });
    track("Itinerary Build Started", { place_count: chosen.length, duration: partial.duration, pace, leg_count: partial.legs.length });
    try {
      const duration = partial.duration || 3;
      const itineraryLegs: ItineraryLeg[] = partial.legs.map((leg) => {
        const cityId = slugify(leg.city);
        return {
          city: leg.city,
          cityId,
          country: leg.country || undefined,
          days: leg.days,
          sites: chosen.filter((s) => s.city_id === cityId),
        };
      });
      const days = planMultiCityItinerary(itineraryLegs, pace);
      if (days.every((d) => d.slots.length === 0)) {
        track("Itinerary Build Failed", { reason: "no_places_fit" });
        throw new Error(t("plan.errNoPlacesFit"));
      }

      try {
        const labelText = await planAgent(
          buildDayLabelsSystemPrompt(legsLabel(partial.legs), days, followupNotes || undefined),
          [{ role: "user", content: "Write the day titles now." }],
        );
        const labels = parseDayLabels(labelText);
        if (labels && labels.length === days.length) {
          days.forEach((day, i) => {
            day.label = `Day ${day.day} — ${labels[i].label}`;
            day.labelAr = `اليوم ${day.day} — ${labels[i].labelAr}`;
          });
        }
      } catch {
        // Fall back to the planner's plain "Day N" labels — titles are cosmetic, not worth failing the build over.
      }

      const itinerary: ItineraryResult = {
        city: partial.legs[0].city,
        dates: partial.dates || null,
        duration,
        groupType,
        pace,
        days,
      };
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
      if (!tripId) throw new Error(t("plan.errSaveTrip"));

      await db("updateTripStatus", { tripId, status: "ready", days: itinerary.days });
      track("Trip Saved", {
        trip_id: tripId,
        city: itinerary.city,
        leg_count: partial.legs.length,
        day_count: itinerary.days.length,
        duration: itinerary.duration,
        logged_in: !!session,
      });
      navigate(`/trip/${tripId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("plan.errBuildGeneric");
      setError(message);
      track("Trip Save Failed", { city: partial.legs[0].city, message });
      setPhase("selecting");
    }
  }

  if (phase === "landing") {
    return (
      <div className="relative px-4 sm:px-10 md:px-16 lg:px-[80px] py-16 sm:py-24 md:py-32 lg:py-[140px] max-w-[1180px]">
        <img src={heroIllustration} alt="" className="hidden lg:block absolute end-[80px] top-[140px] w-[203px]" />

        <p className="font-medium text-[12px] text-primary-orange tracking-[1.44px]">{t("plan.heroEyebrow")}</p>
        <h1 className="font-heading font-semibold text-[32px] sm:text-[40px] md:text-[48px] leading-[1.15] text-text-primary mt-[16px] max-w-[600px]">
          {t("plan.heroTitle")}
        </h1>
        <p className="text-[16px] leading-[1.5] text-text-secondary mt-[16px] max-w-[560px]">
          {t("plan.heroSubtitle")}
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
            placeholder={t("plan.inputPlaceholder")}
            className="w-full h-[64px] sm:h-[76px] rounded-[24px] border-[1.5px] border-secondary-purple shadow-[0px_16px_40px_0px_rgba(48,48,48,0.12)] ps-[20px] sm:ps-[26px] pe-[70px] sm:pe-[80px] text-[15px] sm:text-[16px] text-text-primary placeholder:text-text-secondary outline-none"
          />
          <button
            type="submit"
            aria-label={t("plan.send")}
            className="absolute end-[10px] sm:end-[12px] top-1/2 -translate-y-1/2 size-[44px] sm:size-[52px] rounded-full bg-primary-orange flex items-center justify-center"
          >
            <img src={sendArrow} alt="" className="size-[12px]" />
          </button>
        </form>

        <div className="flex gap-[10px] mt-[24px] flex-wrap">
          {SUGGESTION_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => sendMessage(t(key))}
              className="bg-white border border-secondary-purple rounded-[20px] px-[16px] py-[10px] text-[13px] font-medium text-text-primary"
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "chat") {
    const showTextInput = step === "city" || step === "followup";
    return (
      <div className="px-4 sm:px-10 md:px-16 lg:px-[80px] py-6 sm:py-10 md:py-[60px] max-w-[760px] flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-120px)]">
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
              <p className="font-medium text-[11px] text-primary-orange tracking-[0.9px]">{t("plan.heroEyebrow")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-[16px] flex-1 min-h-0 overflow-y-auto px-[20px] sm:px-[24px] py-[24px]">
            {messages.map((m, i) =>
              m.role === "assistant" ? (
                <BotRow key={i}>
                  <div className="flex flex-col gap-[4px] max-w-[85%] sm:max-w-[480px]">
                    <div className="rounded-[20px] rounded-es-[6px] px-[20px] py-[14px] text-[15px] leading-[1.5] bg-surface-lavender text-text-primary">
                      {m.content}
                    </div>
                    <span className="text-[11px] text-text-secondary ps-[4px]">{m.time}</span>
                  </div>
                </BotRow>
              ) : (
                <div key={i} className="self-end flex flex-col items-end gap-[4px] max-w-[85%] sm:max-w-[480px]">
                  <div className="rounded-[20px] rounded-ee-[6px] px-[20px] py-[14px] text-[15px] leading-[1.5] bg-secondary-purple text-white">
                    {m.content}
                  </div>
                  <span className="text-[11px] text-text-secondary pe-[4px]">{m.time}</span>
                </div>
              ),
            )}

            {sending && (
              <BotRow>
                <div className="rounded-[20px] rounded-es-[6px] px-[20px] py-[16px] bg-surface-lavender flex items-center gap-[5px]">
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce [animation-delay:-0.3s]" />
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce [animation-delay:-0.15s]" />
                  <span className="size-[6px] rounded-full bg-secondary-purple/50 animate-bounce" />
                </div>
              </BotRow>
            )}

            {!sending && step === "party" && (
              <BotRow>
                <PillChoice options={GROUP_TYPES} labelFor={(g) => t(GROUP_LABEL_KEYS[g])} onSelect={selectParty} />
              </BotRow>
            )}

            {!sending && step === "interests" && (
              <BotRow>
                <InterestChoice selected={interests} onToggle={toggleInterest} onContinue={continueInterests} />
              </BotRow>
            )}

            {!sending && step === "pace" && (
              <BotRow>
                <PillChoice options={PACE_OPTIONS} labelFor={(p) => t(PACE_LABEL_KEYS[p])} onSelect={selectPace} />
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
                placeholder={step === "city" ? t("plan.replyPlaceholder") : t("plan.followupPlaceholder")}
                className="w-full h-[52px] rounded-[18px] bg-surface-lavender ps-[20px] pe-[64px] text-[15px] text-text-primary placeholder:text-text-secondary outline-none"
              />
              <button
                type="submit"
                aria-label={t("plan.send")}
                className="absolute end-[28px] top-1/2 -translate-y-1/2 size-[38px] rounded-full bg-primary-orange flex items-center justify-center"
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
        {t("plan.planningHeading", { legs: partial ? legsLabel(partial.legs) : "" })}
      </h1>
      <p className="text-[13px] text-text-secondary mt-[6px]">
        {t("plan.durationLabel", { count: partial?.duration ?? 0 })} · {partial?.dates || t("plan.flexibleDates")} ·{" "}
        {t(GROUP_LABEL_KEYS[groupType])} · {t(PACE_LABEL_KEYS[pace])}
        {interests.length > 0 ? ` · ${interests.map((tag) => t(categoryOrActivityLabelKey(tag))).join(", ")}` : ""}
      </p>

      <div className="flex flex-col gap-[24px] mt-[32px]">
        <div>
          <p className="font-medium text-[11px] text-primary-orange tracking-[0.44px] uppercase">
            {t("plan.placesSelected", { count: selectedPlaces.size })}
          </p>
          <div className="flex flex-wrap gap-[8px] mt-[12px]">
            {INTEREST_TAGS.map((tag) => (
              <TagPill key={tag} label={t(categoryOrActivityLabelKey(tag))} active={placeFilters.includes(tag)} onClick={() => togglePlaceFilter(tag)} />
            ))}
          </div>
          {loadingSites && (
            <p className="text-text-secondary text-[14px] mt-[12px]">
              {t("plan.findingPlaces", { legs: partial ? legsLabel(partial.legs) : "" })}
            </p>
          )}
          {partial?.legs.map((leg) => {
            const cityId = slugify(leg.city);
            const legSites = sites
              .filter((site) => site.city_id === cityId)
              .filter((site) => placeFilters.length === 0 || site.must_see || placeFilters.includes(site.category));
            return (
              <div key={cityId}>
                {partial.legs.length > 1 && (
                  <p className="font-heading font-semibold text-[15px] text-text-primary mt-[20px] mb-[4px]">
                    {leg.city}{" "}
                    <span className="text-text-secondary text-[12px] font-normal">
                      · {leg.days} {leg.days === 1 ? t("plan.day") : t("plan.days")}
                    </span>
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] mt-[12px]">
                  {legSites.map((site) => (
                    <PlaceCard
                      key={site.id}
                      site={site}
                      active={selectedPlaces.has(site.name)}
                      onClick={() => togglePlace(site.name)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-primary-orange text-[13px]">{error}</p>}

        <Button
          variant="orange"
          className="!w-full sm:!w-[280px]"
          disabled={phase === "building" || selectedPlaces.size === 0}
          onClick={buildTrip}
        >
          {phase === "building" ? t("plan.buildingCta") : t("plan.buildCta")}
        </Button>
      </div>
    </div>
  );
}
