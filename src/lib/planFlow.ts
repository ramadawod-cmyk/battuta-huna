import { CATEGORIES } from "./categories";
import type { TripDay } from "./types";

export type PlanPartial = {
  city: string;
  country: string;
  country_id: string;
  dates?: string;
  duration?: number;
};

export const GATHER_SYSTEM_PROMPT = `You are Battuta, a warm and concise travel-planning assistant. Your only job right now is to find out which city the traveller wants to visit and roughly when / for how long, in at most 2 short questions total. Keep replies to 1-2 sentences, no markdown, no emojis, no em dashes.

Rules:
- Never accept a country or region name alone — always insist on an actual city or town name (e.g. "Seminyak, Ubud, Canggu" not "Bali").
- As soon as you know a city and at least an approximate duration, stop asking questions and end your reply with a machine-readable block on its own line:
[PARTIAL]{"city":"City Name","country":"Country Name","country_id":"lowercase-slug","dates":"approximate dates or null","duration":number of days}[/PARTIAL]
- Always include the country the city belongs to, and a lowercase hyphenated country_id slug.
- Everything before the [PARTIAL] block is shown to the user as your reply — keep it natural and friendly.`;

export function parsePartial(text: string): { partial: PlanPartial | null; cleanText: string } {
  const match = text.match(/\[PARTIAL\]([\s\S]*?)\[\/PARTIAL\]/);
  const cleanText = text.replace(/\[PARTIAL\][\s\S]*?\[\/PARTIAL\]/, "").trim();
  if (!match) return { partial: null, cleanText };
  try {
    return { partial: JSON.parse(match[1].trim()) as PlanPartial, cleanText };
  } catch {
    return { partial: null, cleanText };
  }
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
