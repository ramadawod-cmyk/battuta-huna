import { ACTIVITY_TYPES } from "./activityTypes";
import battutaChatAgentRules from "./agent-rules/battuta-chat-agent.md?raw";
import { ARABIC_VOICE_GUIDANCE } from "./arabicVoice";
import { CATEGORIES } from "./categories";
import type en from "./i18n/en";
import type { Language } from "./i18n/translate";
import { splitDaysAcrossLegs } from "./itineraryPlanner";
import type { TripDay } from "./types";

// battuta-chat-agent.md IS the system prompt (edit it directly, not this file, to change the
// agent's wording/rules) -- strip its editorial HTML-comment header before it ever reaches the
// model, and fill in the two placeholders it documents.
const BATTUTA_CHAT_AGENT_TEMPLATE = battutaChatAgentRules.replace(/<!--[\s\S]*?-->/g, "").trim();

export type PlanLeg = {
  city: string;
  country: string;
  country_id: string;
  days: number;
};

export type PlanPartial = {
  legs: PlanLeg[];
  duration: number;
  dates?: string | null;
};

function formatToday(today: Date): string {
  return today.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

/**
 * Replaces the old constant GATHER_SYSTEM_PROMPT -- takes today's date so the agent can reason
 * about relative time ("next month", "this winter") and seasonal fit without ever needing to ask
 * the traveller for it, and can suggest actual destinations instead of only accepting ones the
 * traveller already named. See MULTI-DESTINATION-PLAN.md Phase 3 for the full rationale.
 */
export function buildGatherSystemPrompt(today: Date, language: Language = "en"): string {
  const languageInstruction =
    language === "ar"
      ? `Reply to the traveller in Arabic. ${ARABIC_VOICE_GUIDANCE} `
      : "";
  return BATTUTA_CHAT_AGENT_TEMPLATE.replace("{{TODAY}}", formatToday(today)).replace(
    "{{LANGUAGE_INSTRUCTION}}",
    languageInstruction,
  );
}

const MAX_LEGS = 4;

type RawLeg = { city?: unknown; country?: unknown; country_id?: unknown; days?: unknown };

function sanitizeLeg(raw: RawLeg): PlanLeg | null {
  if (typeof raw.city !== "string" || !raw.city.trim()) return null;
  const days = typeof raw.days === "number" && raw.days > 0 ? Math.round(raw.days) : 0;
  return {
    city: raw.city.trim(),
    country: typeof raw.country === "string" ? raw.country : "",
    country_id: typeof raw.country_id === "string" ? raw.country_id : "",
    days,
  };
}

/**
 * Accepts both the current single-city [PARTIAL] shape ({city, country, country_id, duration})
 * and the multi-destination {legs: [...], duration} shape the Phase 3 prompt will emit -- so the
 * prompt rewrite and this parser can ship independently without either one breaking a
 * conversation already in flight. Always re-splits leg day counts against the total duration
 * when they don't already agree (the model can't be trusted to do that arithmetic reliably), and
 * caps legs at 4 -- a trip spanning more destinations than that isn't one this app schedules well.
 */
export function parsePartial(text: string): { partial: PlanPartial | null; cleanText: string } {
  const match = text.match(/\[PARTIAL\]([\s\S]*?)\[\/PARTIAL\]/);
  const cleanText = text.replace(/\[PARTIAL\][\s\S]*?\[\/PARTIAL\]/, "").trim();
  if (!match) return { partial: null, cleanText };

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(match[1].trim());
  } catch {
    return { partial: null, cleanText };
  }

  const rawLegs: RawLeg[] = Array.isArray(raw.legs)
    ? (raw.legs as RawLeg[])
    : typeof raw.city === "string"
      ? [{ city: raw.city, country: raw.country, country_id: raw.country_id, days: raw.duration }]
      : [];

  const legs = rawLegs
    .map(sanitizeLeg)
    .filter((leg): leg is PlanLeg => leg !== null)
    .slice(0, MAX_LEGS);
  if (legs.length === 0) return { partial: null, cleanText };

  const duration =
    typeof raw.duration === "number" && raw.duration > 0
      ? Math.round(raw.duration)
      : legs.reduce((sum, leg) => sum + leg.days, 0);
  if (duration <= 0) return { partial: null, cleanText };

  const daysSum = legs.reduce((sum, leg) => sum + leg.days, 0);
  const needsResplit = daysSum !== duration || legs.some((leg) => leg.days <= 0);
  const finalLegs = needsResplit
    ? legs.map((leg, i) => ({ ...leg, days: splitDaysAcrossLegs(duration, legs.length)[i] }))
    : legs;

  return {
    partial: { legs: finalLegs, duration, dates: typeof raw.dates === "string" ? raw.dates : null },
    cleanText,
  };
}

export type ItineraryResult = {
  city: string;
  dates: string | null;
  duration: number;
  groupType: string;
  pace: string;
  days: TripDay[];
};

// Which places go on which day, in what order, and at what times is now decided deterministically
// by planItinerary() in ./itineraryPlanner — proximity- and time-budget-aware, so days can no
// longer come back overloaded or empty (the old per-day AI call couldn't see other days' picks).
// The AI's only remaining job here is writing a short, evocative title per day.
// Day titles are always generated bilingually in one call, regardless of the current UI language
// (same one-call-both-languages approach as sites/activities/tips -- see decision 6) -- so a
// built trip's titles are ready to show in either language whenever it's later viewed or shared.
export type DayLabel = { label: string; labelAr: string };

export function buildDayLabelsSystemPrompt(destination: string, days: TripDay[], notes?: string): string {
  // Each day carries its own city for a multi-leg trip (see planMultiCityItinerary), so the model
  // can title "Day 4" with Florence in mind even though the trip overall spans Rome and Florence.
  const daysJson = JSON.stringify(
    days.map((d) => ({ day: d.day, city: d.city, stops: d.slots.map((s) => s.name) })),
  );
  return `You are Battuta, a travel-planning assistant. For a trip to ${destination}, write a short, evocative title (3-5 words, no "Day N" prefix) for each day below, based on its stops and (if given) its city, in both English and Arabic.${notes ? ` Traveler notes: ${notes}` : ""} ${ARABIC_VOICE_GUIDANCE}

Days: ${daysJson}

Output ONLY a JSON array of ${days.length} objects, in day order, no other text. Each item: {"label": string (English title), "labelAr": string (Arabic title)}. Example: [{"label": "Old Town & Markets", "labelAr": "البلدة القديمة والأسواق"}, {"label": "Coastal Escape", "labelAr": "هروب إلى الساحل"}]`;
}

export function parseDayLabels(text: string): DayLabel[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (
      !Array.isArray(parsed) ||
      !parsed.every((v) => v && typeof v.label === "string" && typeof v.labelAr === "string")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const GROUP_TYPES = ["Solo", "Couple", "Family", "Friends"];
export const PACE_OPTIONS = ["Relaxed", "Strict schedule"];
// Spans both sites (CATEGORIES) and activities (ACTIVITY_TYPES) -- picking "Nightlife & Drinks"
// here biases pickDefaultPlacesForLegs toward matching activities exactly like picking "History"
// already biases it toward matching sites, with no extra ranking logic needed.
export const INTEREST_TAGS = [...CATEGORIES, ...ACTIVITY_TYPES];

// GROUP_TYPES/PACE_OPTIONS are stored verbatim in Supabase (trip.group_type/pace) and matched
// against elsewhere -- these map each canonical English value to its display label key only, so
// every page showing them (Plan.tsx, CustomiseTrip.tsx) translates consistently without
// duplicating the map.
export const GROUP_LABEL_KEYS: Record<string, keyof typeof en> = {
  Solo: "plan.group.solo",
  Couple: "plan.group.couple",
  Family: "plan.group.family",
  Friends: "plan.group.friends",
};
export const PACE_LABEL_KEYS: Record<string, keyof typeof en> = {
  Relaxed: "plan.pace.relaxed",
  "Strict schedule": "plan.pace.strict",
};

// Advisory only -- stored verbatim on the trip and used as prose context for AI calls (weather
// tip, day labels), not a site filter: sites/activities have no price-tier data to filter by.
export const BUDGET_TIERS = ["Budget-friendly", "Mid-range", "Luxury"];
export const BUDGET_LABEL_KEYS: Record<string, keyof typeof en> = {
  "Budget-friendly": "plan.budget.budgetFriendly",
  "Mid-range": "plan.budget.midRange",
  Luxury: "plan.budget.luxury",
};

/**
 * Combines the two free-text answers the gather flow collects (the existing "anything you don't
 * want to miss" follow-up and, only for a Family party, who's joining) into one string persisted
 * on the trip as `traveler_notes` -- the single piece of context the family-suitability filter
 * and the weather-tip generator both read. Either half can be empty.
 */
export function composeTravelerNotes(followupNotes: string, familyNotes: string): string {
  const family = familyNotes.trim();
  const followup = followupNotes.trim();
  if (family && followup) return `Traveling with: ${family}. ${followup}`;
  if (family) return `Traveling with: ${family}.`;
  return followup;
}
