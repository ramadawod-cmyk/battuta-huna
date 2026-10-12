import { planAgent } from "./api";
import type { Site } from "./types";

/**
 * Narrowly-scoped AI pass over the auto-build candidate pool: flags only places that are
 * *clearly* unsuitable given who's traveling (e.g. an adult nightlife venue when the trip
 * includes toddlers), so the default selection doesn't hand a family trip the same generic pool
 * it would hand anyone else. Deliberately conservative -- sites have no structured age-rating, so
 * this reasons from each candidate's existing name/category/description, the same way
 * SwapPanel.tsx's rankByQuery reasons about relevance from the same fields. Never applied to a
 * user's own manual picks in browse mode -- only to the default auto-build selection, and only
 * when the traveller actually gave family details.
 */
export async function filterUnsuitableForFamily(familyNotes: string, sites: Site[]): Promise<string[]> {
  const trimmed = familyNotes.trim();
  if (!trimmed || sites.length === 0) return [];

  const system = `You help make sure a family trip's itinerary is age-appropriate. Given a traveller's note about who's joining the trip and a list of candidate places (JSON), respond with ONLY a JSON array of place names from the list that are CLEARLY unsuitable for them -- e.g. adult nightlife venues, bars, extreme or very long physically demanding activities for young children, anything 18+. Only flag places that are obviously unsuitable, not borderline ones -- when in doubt, leave it out of the array. If nothing is unsuitable, respond with an empty array []. No prose.`;
  const candidates = sites.map((s) => ({ name: s.name, category: s.category, description: s.description }));
  try {
    const text = await planAgent(system, [
      { role: "user", content: `Traveling with: ${trimmed}\nCandidates: ${JSON.stringify(candidates)}` },
    ]);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
