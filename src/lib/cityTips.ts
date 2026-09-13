import { db, planAgent } from "./api";
import { ARABIC_VOICE_GUIDANCE } from "./arabicVoice";

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
// Bilingual key convention: "getting_around" (English) pairs with "getting_around_ar" (Arabic) as
// a sibling key in the same flat CityTips object -- no schema change needed, cities.tips is
// already a JSONB blob, this just widens what's stored in it.
export function arabicKey(key: string): string {
  return `${key}_ar`;
}

async function generateTipCategory(cityName: string, country: string, key: string, label: string): Promise<[string, string, string | null]> {
  const arKey = arabicKey(key);
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Write a practical, specific "${label}" section of a local travel guide for the given city (2-4 concise, practical sentences, not generic advice). ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON object, no prose, no markdown fences: {"${key}": string, "${arKey}": string}.`;
  const text = await planAgent(system, [{ role: "user", content: `Write it for ${cityName}, ${country}.` }]);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in tips response");
  const parsed = JSON.parse(text.slice(start, end + 1));
  const value = parsed[key];
  if (typeof value !== "string") throw new Error(`Missing "${key}" in tips response`);
  const valueAr = typeof parsed[arKey] === "string" ? parsed[arKey] : null;
  return [key, value, valueAr];
}

/**
 * Cache-first city guide loader, mirroring ensureCitySites: reuse existing Supabase tips for a
 * city if present, otherwise AI-generate a fresh set (one category per parallel call) and persist.
 */
export async function ensureCityTips(cityId: string, cityName: string): Promise<CityTips | null> {
  const existing: { tips: CityTips | null; country_id: string | null } | null = await db("getCityTips", { cityId });
  if (existing?.tips && Object.keys(existing.tips).length > 0) {
    backfillTipsTranslations(cityId, cityName, existing.tips);
    return existing.tips;
  }

  const country = existing?.country_id || "";
  const results = await Promise.allSettled(
    TIP_CATEGORIES.map((c) => generateTipCategory(cityName, country, c.key, c.label)),
  );

  const tips: CityTips = {};
  for (const result of results) {
    if (result.status === "fulfilled") {
      const [key, value, valueAr] = result.value;
      tips[key] = value;
      if (valueAr) tips[arabicKey(key)] = valueAr;
    }
  }
  if (Object.keys(tips).length === 0) return null;

  await db("saveCityTips", { cityId, tips }).catch(() => {});
  return tips;
}

/**
 * Best-effort, fire-and-forget backfill for a city's tips cached before bilingual content
 * existed -- same opportunistic shape as sites.ts/activities.ts's translation backfills. Since
 * tips are stored as one JSON blob per city (not one row per tip), this translates whichever
 * categories are missing their `_ar` sibling key and re-saves the whole object via the existing
 * saveCityTips action -- no new proxy action needed.
 */
async function backfillTipsTranslations(cityId: string, cityName: string, tips: CityTips): Promise<void> {
  const stale = TIP_CATEGORIES.filter((c) => tips[c.key] && !tips[arabicKey(c.key)]);
  if (stale.length === 0) return;

  const system = `You are a professional Arabic translator for Battuta, a cultural-discovery app. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON object, no prose, no markdown fences, one key per item given, each value the Arabic translation of that item's text.`;
  const payload = Object.fromEntries(stale.map((c) => [c.key, tips[c.key]]));

  try {
    const text = await planAgent(system, [{ role: "user", content: `Translate these ${cityName} travel guide sections: ${JSON.stringify(payload)}` }]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) return;
    const translated = JSON.parse(text.slice(start, end + 1));
    const merged: CityTips = { ...tips };
    for (const c of stale) {
      if (typeof translated[c.key] === "string") merged[arabicKey(c.key)] = translated[c.key];
    }
    await db("saveCityTips", { cityId, tips: merged }).catch(() => {});
  } catch {
    // Best-effort -- the city keeps showing English-only tips until a later visit tries again.
  }
}
