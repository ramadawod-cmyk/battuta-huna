import { CATEGORIES } from "./categories";
import { splitDaysAcrossLegs } from "./itineraryPlanner";
import type { TripDay } from "./types";

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

// Kept producing the single-city [PARTIAL] shape below on purpose -- parsePartial already
// normalizes that into the {legs, duration} shape everything downstream expects, so the prompt
// and the parser don't have to change in the same commit. The multi-destination-aware version of
// this prompt (suggesting places, understanding a country or multiple cities, date-awareness) is
// a separate, deliberate change -- see MULTI-DESTINATION-PLAN.md Phase 3.
export const GATHER_SYSTEM_PROMPT = `You are Battuta, a warm and concise travel-planning assistant. Your only job right now is to find out which city the traveller wants to visit and how many days the trip will be, in at most 2 short questions total. Keep replies to 1-2 sentences, no markdown, no emojis, no em dashes.

Rules:
- Never accept a country or region name alone — always insist on an actual city or town name (e.g. "Seminyak, Ubud, Canggu" not "Bali").
- Don't ask about specific travel dates — a calendar handles that separately right after this.
- As soon as you know a city and at least an approximate duration (number of days), stop asking questions and end your reply with a machine-readable block on its own line:
[PARTIAL]{"city":"City Name","country":"Country Name","country_id":"lowercase-slug","dates":null,"duration":number of days}[/PARTIAL]
- Always include the country the city belongs to, and a lowercase hyphenated country_id slug.
- Everything before the [PARTIAL] block is shown to the user as your reply — keep it natural and friendly.`;

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
export function buildDayLabelsSystemPrompt(city: string, days: TripDay[], notes?: string): string {
  const daysJson = JSON.stringify(
    days.map((d) => ({ day: d.day, stops: d.slots.map((s) => s.name) })),
  );
  return `You are Battuta, a travel-planning assistant. For a trip to ${city}, write a short, evocative title (3-5 words, no "Day N" prefix) for each day below, based on its stops.${notes ? ` Traveler notes: ${notes}` : ""}

Days: ${daysJson}

Output ONLY a JSON array of ${days.length} strings, in day order, no other text. Example: ["Old Town & Markets", "Coastal Escape"]`;
}

export function parseDayLabels(text: string): string[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const GROUP_TYPES = ["Solo", "Couple", "Family", "Friends"];
export const PACE_OPTIONS = ["Relaxed", "Strict schedule"];
export const INTEREST_TAGS = CATEGORIES;
