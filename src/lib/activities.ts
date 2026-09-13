import { db, planAgent } from "./api";
import { ACTIVITY_TYPES, normalizeActivityType } from "./activityTypes";
import { ARABIC_VOICE_GUIDANCE } from "./arabicVoice";
import { slugify } from "./geo";
import { track } from "./analytics";
import type { Activity, Site } from "./types";

/**
 * Normalizes an Activity into a Site-shaped candidate so it can flow through planItinerary,
 * pickDefaultPlaces, PlaceCard, and the map completely unchanged -- category becomes the
 * activity_type (deliberately NOT run through normalizeCategory, which would misclassify an
 * activity type like "Beach & Swim" onto the unrelated site taxonomy), must_see mirrors must_do,
 * and kind: "activity" is set purely so the UI can show a distinguishing badge.
 */
export function activityToCandidate(activity: Activity): Site {
  return {
    id: activity.id,
    city_id: activity.city_id,
    name: activity.name,
    category: activity.activity_type,
    tags: activity.tags,
    description: activity.description,
    long_description: activity.long_description,
    lat: activity.lat,
    lng: activity.lng,
    map_url: activity.map_url,
    image_url: activity.image_url,
    review_status: activity.review_status,
    source: activity.source,
    must_see: activity.must_do,
    duration_minutes: activity.duration_minutes,
    kind: "activity",
    name_ar: activity.name_ar,
    description_ar: activity.description_ar,
  };
}

type GeneratedActivity = {
  name: string;
  nameAr: string;
  activityType: string;
  description: string;
  descriptionAr: string;
  tags: string[];
  lat: number;
  lng: number;
  isArea?: boolean;
  areaName?: string | null;
  mustDo?: boolean;
  durationMinutes?: number;
};

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not contain a JSON array");
  }
  return JSON.parse(text.slice(start, end + 1));
}

const BATCH_SIZE = 2;
// One batch per activity type -- unlike sites, activities are inherently sparse (a city has a
// handful of real nightlife districts or beaches, not hundreds of possible landmarks), so there's
// no "hidden gem" repeat pass the way generatePois doubles up on some site categories.
const TARGET_ACTIVITY_COUNT = ACTIVITY_TYPES.length * BATCH_SIZE; // 16

async function generateActivityBatch(
  cityName: string,
  countryName: string,
  activityType: string,
  count: number,
): Promise<GeneratedActivity[]> {
  const system = `You are a travel research assistant for Battuta, a cultural-discovery app. Generate up to ${count} real activities/experiences of the type "${activityType}" for a given city -- not landmarks, actual things a traveller can go and do. For a district/neighborhood-level recommendation (e.g. going out for drinks, or shopping), name the actual district or street locals go to, set isArea true, areaName to that district's name, and lat/lng to its approximate centroid. For a single specific spot (e.g. a particular beach or hiking trail), set isArea false with that spot's real coordinates. If the city genuinely has few or no good options for this activity type, return fewer items (even an empty array) rather than inventing one. Keep descriptions to 10-14 words. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string, "nameAr": string (the district/spot's real Arabic name if one exists, otherwise a natural Arabic rendering), "activityType": "${activityType}", "description": string (10-14 words, warm editorial tone, no markdown), "descriptionAr": string (10-14 words), "tags": string[1-2], "lat": number, "lng": number, "isArea": boolean, "areaName": string or null, "mustDo": boolean (true only for a genuinely iconic, unmissable experience), "durationMinutes": number (typical time spent, in minutes)}.`;

  const text = await planAgent(system, [
    { role: "user", content: `Generate up to ${count} "${activityType}" activities for ${cityName}, ${countryName}.` },
  ]);
  const items = extractJsonArray(text) as GeneratedActivity[];
  return items.map((item) => ({ ...item, activityType: normalizeActivityType(item.activityType) }));
}

/** Drops any generated item whose name (case-insensitive) is already cached or seen earlier in this batch. */
export function dedupeActivitiesByName(items: GeneratedActivity[], avoid: Activity[] = []): GeneratedActivity[] {
  const seenNames = new Set<string>(avoid.map((a) => a.name.toLowerCase()));
  const accepted: GeneratedActivity[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    accepted.push(item);
  }
  return accepted;
}

/** Maps one AI-generated activity into the shape the `activities` table stores. */
export function toActivityRow(cityId: string, cityName: string, item: GeneratedActivity): Activity {
  return {
    id: `${cityId}-${slugify(item.name)}`,
    city_id: cityId,
    name: item.name,
    name_ar: item.nameAr || null,
    activity_type: item.activityType,
    description: item.description,
    description_ar: item.descriptionAr || null,
    tags: item.tags,
    lat: item.lat,
    lng: item.lng,
    is_area: item.isArea ?? false,
    area_name: item.areaName || null,
    map_url: `https://maps.google.com/?q=${encodeURIComponent((item.areaName || item.name) + ", " + cityName)}`,
    source: "ai",
    review_status: "ai_complete",
    must_do: item.mustDo ?? false,
    duration_minutes: item.durationMinutes ?? null,
  };
}

/** `avoid` lets a top-up generation skip activities the city already has cached, by name. */
async function generateActivities(cityName: string, countryName: string, avoid: Activity[] = []): Promise<GeneratedActivity[]> {
  const batches = ACTIVITY_TYPES.map((activityType) => generateActivityBatch(cityName, countryName, activityType, BATCH_SIZE));
  const results = await Promise.allSettled(batches);
  const fulfilled = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return dedupeActivitiesByName(fulfilled, avoid);
}

/**
 * Cache-first city activities loader, mirroring ensureCitySites: reuse existing Supabase
 * activities for a city if there are enough, generating more (topping up, not replacing) when
 * there aren't. Unlike sites, an empty or sparse result for a given city (e.g. no real beaches in
 * a landlocked city) is an expected outcome, not an error.
 */
export async function ensureCityActivities(
  cityId: string,
  cityName: string,
  countryId: string,
  countryName: string,
): Promise<Activity[]> {
  const existing: Activity[] = (await db("getActivities", { cityId })) || [];
  if (existing.length >= TARGET_ACTIVITY_COUNT) {
    backfillActivityTranslations(cityId, cityName, existing);
    return existing.map((a) => ({ ...a, activity_type: normalizeActivityType(a.activity_type) }));
  }

  // Same idempotent upserts ensureCitySites does -- safe to repeat even if that call already ran
  // for this leg, since both use resolution=merge-duplicates.
  await db("upsertCountry", { country: { id: countryId, name: countryName } });
  await db("upsertCity", { city: { id: cityId, name: cityName, country_id: countryId } });

  try {
    const generated = await generateActivities(cityName, countryName, existing);
    const newActivities = generated.map((item) => toActivityRow(cityId, cityName, item));

    if (newActivities.length > 0) await db("upsertActivities", { activities: newActivities });
    if (existing.length > 0) backfillActivityTranslations(cityId, cityName, existing);
    track("New City Activities Generated", {
      city_id: cityId,
      success: true,
      activity_count: existing.length + newActivities.length,
      topped_up: existing.length > 0,
    });
    return [...existing, ...newActivities];
  } catch (err) {
    track("New City Activities Generated", {
      city_id: cityId,
      success: false,
      message: err instanceof Error ? err.message : String(err),
    });
    // A failed top-up on a city with some cached activities shouldn't block the trip -- show
    // what's there. A city with zero activities and a failed generation just contributes none,
    // which downstream treats as "no activities for this trip", not an error.
    return existing;
  }
}

/** True for an activity that predates bilingual generation and hasn't been backfilled yet. */
export function needsArabicTranslation(activity: { name_ar?: string | null }): boolean {
  return !activity.name_ar;
}

type ActivityTranslation = { name: string; nameAr: string; descriptionAr: string };

const TRANSLATION_BATCH_SIZE = 8;

async function translateActivityBatch(cityName: string, activities: Activity[]): Promise<ActivityTranslation[]> {
  const system = `You are a professional Arabic translator for Battuta, a cultural-discovery app. ${ARABIC_VOICE_GUIDANCE} Respond with ONLY a JSON array, no prose, no markdown fences. Each item: {"name": string (must match input exactly), "nameAr": string, "descriptionAr": string}.`;
  const items = activities.map((a) => ({ name: a.name, description: a.description }));
  const text = await planAgent(system, [
    { role: "user", content: `Activities in ${cityName}: ${JSON.stringify(items)}` },
  ]);
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("AI response did not contain a JSON array");
  return JSON.parse(text.slice(start, end + 1)) as ActivityTranslation[];
}

/**
 * Best-effort, fire-and-forget backfill for activities cached before bilingual content existed --
 * same shape as sites.ts's backfillSiteTranslations. Runs whenever a city with "enough" cached
 * activities is visited, not as a one-time mass migration (see ARABIC-LOCALIZATION-PLAN.md
 * decision 9).
 */
async function backfillActivityTranslations(cityId: string, cityName: string, activities: Activity[]): Promise<void> {
  const stale = activities.filter(needsArabicTranslation);
  if (stale.length === 0) return;

  const batches: Activity[][] = [];
  for (let i = 0; i < stale.length; i += TRANSLATION_BATCH_SIZE) batches.push(stale.slice(i, i + TRANSLATION_BATCH_SIZE));

  const results = await Promise.allSettled(batches.map((batch) => translateActivityBatch(cityName, batch)));
  const patches: Promise<unknown>[] = [];
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const translation of result.value) {
      patches.push(
        db("saveActivityTranslation", {
          name: translation.name,
          cityId,
          nameAr: translation.nameAr,
          descriptionAr: translation.descriptionAr,
        }).catch(() => {}),
      );
    }
  }
  await Promise.allSettled(patches);
}
