import { planAgent, db } from "./api";
import { ARABIC_VOICE_GUIDANCE } from "./arabicVoice";
import { slugify } from "./geo";
import { SUGGESTION_TAGS } from "./suggestionTags";

export type PopularDestination = {
  city: string;
  cityAr: string;
  country: string;
  countryAr: string;
  reason: string;
  reasonAr: string;
  // Absent on rows cached before this field existed -- normalizeSuggestionTags treats that the
  // same as an empty array, so older cached destinations just render no pills.
  tags?: string[];
};

function isValidDestination(d: unknown): d is PopularDestination {
  if (!d || typeof d !== "object") return false;
  const r = d as Record<string, unknown>;
  return ["city", "cityAr", "country", "countryAr", "reason", "reasonAr"].every(
    (key) => typeof r[key] === "string" && (r[key] as string).trim().length > 0,
  );
}

/**
 * Cached per origin city -- generated once via AI, reused by every traveller detected in roughly
 * the same place after that. Keyed by a slug of the origin city name rather than a catalog city
 * id, since the origin can be anywhere in the world, not only a city Battuta has content for.
 */
export async function ensurePopularDestinations(
  originCityName: string,
  originCountryName: string,
): Promise<PopularDestination[]> {
  const originCityId = slugify(originCityName);

  const cached = await db("getPopularDestinations", { originCityId }).catch(() => null);
  if (Array.isArray(cached?.destinations) && cached.destinations.length > 0) {
    return cached.destinations.filter(isValidDestination);
  }

  const system =
    "You are a travel assistant for Battuta. Given a traveller's home city, suggest the 3 most " +
    "popular, appealing travel destinations for someone leaving from there, considering realistic " +
    "flight access. For each, give the city name, country name, a short one-line reason (under " +
    "15 words), in both English and Arabic, and 1-2 tags describing the destination. Tags MUST be " +
    `exactly from this list, verbatim, no variations: ${SUGGESTION_TAGS.map((t) => `"${t}"`).join(", ")}. ` +
    ARABIC_VOICE_GUIDANCE +
    ' Respond with ONLY a JSON array, no prose, no markdown fences: [{"city": string, "cityAr": ' +
    'string, "country": string, "countryAr": string, "reason": string, "reasonAr": string, "tags": string[1-2]}].';

  const text = await planAgent(system, [
    { role: "user", content: `Traveller is based in ${originCityName}, ${originCountryName}.` },
  ]);

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) return [];

  let destinations: PopularDestination[];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    destinations = Array.isArray(parsed) ? parsed.filter(isValidDestination) : [];
  } catch {
    return [];
  }
  if (destinations.length === 0) return [];

  await db("upsertPopularDestinations", { row: { origin_city_id: originCityId, destinations } }).catch(() => {});
  return destinations;
}
