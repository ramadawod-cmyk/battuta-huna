import { db, planAgent } from "./api";

export type CityTips = Record<string, string>;

const TIP_CATEGORIES: { key: string; label: string }[] = [
  { key: "safety", label: "safety" },
  { key: "what_to_have", label: "what to have" },
  { key: "where_to_eat", label: "where to eat" },
  { key: "local_culture", label: "local culture" },
  { key: "getting_around", label: "getting around" },
  { key: "money_payments", label: "money and payments" },
  { key: "language_basics", label: "language basics" },
  { key: "best_time_of_day", label: "best time of day for sightseeing" },
];

// Netlify Functions hard-cap synchronous execution at ~10s -- measured directly against the
// Anthropic API: a single call for all 8 categories took 9.7-24.5s, a 4-category batch 9.6-12.2s,
// even a 2-category batch 6.3-7.7s (too little margin, unlike POI generation's short list items,
// these are full prose paragraphs). One category per call runs a consistent 5-6.3s, a real margin
// -- so each category is its own parallel call, mirroring the fix already applied to POI generation.
async function generateTipCategory(cityName: string, country: string, key: string, label: string): Promise<[string, string]> {
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Write a practical, specific "${label}" section of a local travel guide for the given city (2-4 concise, practical sentences, not generic advice). Respond with ONLY a JSON object, no prose, no markdown fences: {"${key}": string}.`;
  const text = await planAgent(system, [{ role: "user", content: `Write it for ${cityName}, ${country}.` }]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in tips response");
  const value = JSON.parse(text.slice(start, end + 1))[key];
  if (typeof value !== "string") throw new Error(`Missing "${key}" in tips response`);
  return [key, value];
}

/**
 * Cache-first city guide loader, mirroring ensureCitySites: reuse existing Supabase tips for a
 * city if present, otherwise AI-generate a fresh set (one category per parallel call) and persist.
 */
export async function ensureCityTips(cityId: string, cityName: string): Promise<CityTips | null> {
  const existing: { tips: CityTips | null; country_id: string | null } | null = await db("getCityTips", { cityId });
  if (existing?.tips && Object.keys(existing.tips).length > 0) return existing.tips;

  const country = existing?.country_id || "";
  const results = await Promise.allSettled(
    TIP_CATEGORIES.map((c) => generateTipCategory(cityName, country, c.key, c.label)),
  );

  const tips: CityTips = {};
  for (const result of results) {
    if (result.status === "fulfilled") tips[result.value[0]] = result.value[1];
  }
  if (Object.keys(tips).length === 0) return null;

  await db("saveCityTips", { cityId, tips }).catch(() => {});
  return tips;
}
