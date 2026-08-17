import { CATEGORIES } from "./categories";
import type { Site, TripDay } from "./types";

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

export function buildItinerarySystemPrompt(params: {
  city: string;
  dates: string | null;
  duration: number;
  groupType: string;
  pace: string;
  interests: string[];
  places: Site[];
}): string {
  const placesJson = JSON.stringify(
    params.places.map((p) => ({
      name: p.name,
      category: p.category,
      description: p.description,
      lat: p.lat,
      lng: p.lng,
      mapUrl: p.map_url,
    })),
  );

  return `You are Battuta, a travel-planning assistant. Build a day-by-day itinerary for a trip to ${params.city} using ONLY the places provided below — do not invent new places. Duration: ${params.duration} days. Dates: ${params.dates || "flexible"}. Group type: ${params.groupType}. Pace: ${params.pace}. Interests: ${params.interests.join(", ") || "general"}.

Available places (choose the best subset, don't force every place in, avoid repeating a place across days):
${placesJson}

Output ONLY valid JSON in [ITINERARY] tags, no other text:
[ITINERARY]{"city":"${params.city}","dates":"${params.dates || ""}","duration":${params.duration},"groupType":"${params.groupType}","pace":"${params.pace}","days":[{"day":1,"label":"Day 1 — Title","slots":[{"time":"9:00 AM","name":"Name","description":"Short.","category":"Category","tags":["Tag"],"lat":0,"lng":0,"mapUrl":"https://maps.google.com/?q=Name"}]}]}[/ITINERARY]`;
}

export function parseItinerary(text: string): ItineraryResult | null {
  const match = text.match(/\[ITINERARY\]([\s\S]*?)\[\/ITINERARY\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim()) as ItineraryResult;
    // De-dup safety net: drop repeated place names across days, mirroring the legacy PWA.
    const seen = new Set<string>();
    for (const day of parsed.days) {
      day.slots = day.slots.filter((slot) => {
        if (seen.has(slot.name)) return false;
        seen.add(slot.name);
        return true;
      });
    }
    return parsed;
  } catch {
    return null;
  }
}

export const GROUP_TYPES = ["Solo", "Couple", "Family", "Friends"];
export const PACE_OPTIONS = ["Relaxed", "Strict schedule"];
export const INTEREST_TAGS = CATEGORIES;
