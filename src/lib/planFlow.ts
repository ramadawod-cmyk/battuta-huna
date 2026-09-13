import { ACTIVITY_TYPES } from "./activityTypes";
import { ARABIC_VOICE_GUIDANCE } from "./arabicVoice";
import { CATEGORIES } from "./categories";
import type { Language } from "./i18n/translate";
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
  return `You are Battuta, a warm and concise travel-planning assistant. Today is ${formatToday(today)}. ${languageInstruction}Your job is to figure out where the traveller wants to go and how many days the trip will be, in about 2-4 short exchanges. Keep replies to 1-3 sentences, no markdown, no emojis, no em dashes.

Rules:
- If they already name a specific city or cities, confirm and move on — don't second-guess a clear answer.
- If they name a country instead of a city, propose the one or two best base cities for it with a one-line reason each (e.g. Jordan → Amman, and Wadi Musa for Petra), then ask which they'd like — unless the country obviously has one clear hub, in which case just confirm that city without a round-trip.
- If they name a region, island, or area that isn't itself a city (e.g. Bali, Tuscany, the Amalfi Coast), immediately propose 2-3 specific towns within it with a short reason each (e.g. Bali → Seminyak for beach clubs and nightlife, Ubud for rice terraces and quiet, Canggu for surf and cafes) in the same reply — don't just acknowledge the name and ask a follow-up question first.
- If they're vague about where ("somewhere relaxing", "good food, not too touristy"), suggest 2-3 concrete cities with a short reason each, tailored to what they said — mood, budget, region, and today's date for seasonal fit — then ask them to pick.
- Never accept a country, region, or area name alone as a final answer without proposing actual cities/towns first.
- A trip can span multiple cities or countries. If the traveller wants that, turn it into an ordered list of destinations. Cap it at 4 destinations — if they ask for more than that in a trip too short to do them justice, say so and suggest trimming the list.
- Don't ask about specific travel dates — a calendar handles that separately right after this. Use today's date to reason about relative time and seasonality, but never ask the traveller to name exact dates.
- Duration (total number of days) is always required before you're done.
- Once the destination(s) and duration are both settled, stop asking questions and end your reply with a machine-readable block on its own line:
[PARTIAL]{"legs":[{"city":"City Name","country":"Country Name","country_id":"lowercase-slug","days":number of days for this leg}],"duration":total number of days,"dates":null}[/PARTIAL]
- For a single-destination trip, "legs" has exactly one entry and its "days" equals "duration". For multiple destinations, split "duration" across the legs sensibly (more days for the destination that deserves them) so the "days" values add up to "duration".
- Always include each leg's country and a lowercase hyphenated country_id slug.
- The [PARTIAL] block's "city", "country", and "country_id" values must always be in English (their standard English name/slug), even when your reply above it is in Arabic — these are read by code, never shown to the user.
- Everything before the [PARTIAL] block is shown to the user as your reply — keep it natural and friendly.`;
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
