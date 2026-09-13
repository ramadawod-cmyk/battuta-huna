import type en from "./i18n/en";

export const ACTIVITY_TYPES = [
  "Beach & Swim",
  "Nightlife & Drinks",
  "Shopping",
  "Outdoor & Adventure",
  "Food Experience",
  "Wellness & Relaxation",
  "Day Trip",
  "Live Entertainment",
];

// Display label only -- see the note on categories.ts's CATEGORY_LABEL_KEYS.
export const ACTIVITY_TYPE_LABEL_KEYS: Record<string, keyof typeof en> = {
  "Beach & Swim": "activityType.beachSwim",
  "Nightlife & Drinks": "activityType.nightlifeDrinks",
  "Shopping": "activityType.shopping",
  "Outdoor & Adventure": "activityType.outdoorAdventure",
  "Food Experience": "activityType.foodExperience",
  "Wellness & Relaxation": "activityType.wellnessRelaxation",
  "Day Trip": "activityType.dayTrip",
  "Live Entertainment": "activityType.liveEntertainment",
};

// Same 4-color accent set used for site categories (src/lib/categories.ts) and the travel guide
// icons (src/lib/guideMeta.ts) -- reusing it keeps activity pills visually consistent with
// everything else instead of inventing a second palette.
export type ActivityAccent = "purple" | "orange" | "coral" | "teal";

export const ACTIVITY_TYPE_ACCENTS: Record<string, ActivityAccent> = {
  "Beach & Swim": "teal",
  "Nightlife & Drinks": "purple",
  "Shopping": "orange",
  "Outdoor & Adventure": "coral",
  "Food Experience": "purple",
  "Wellness & Relaxation": "teal",
  "Day Trip": "orange",
  "Live Entertainment": "coral",
};

/**
 * The AI doesn't reliably stick to the fixed taxonomy -- normalize any activity_type string onto
 * it the same way normalizeCategory does for sites, so filter/interest pills stay consistent.
 */
export function normalizeActivityType(raw: string | null | undefined): string {
  if (!raw) return "Outdoor & Adventure";
  if (ACTIVITY_TYPES.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (/beach|swim|coast|shore/.test(lower)) return "Beach & Swim";
  if (/night|drink|bar|club/.test(lower)) return "Nightlife & Drinks";
  if (/shop|market|souq|souk|bazaar|mall/.test(lower)) return "Shopping";
  if (/hike|adventure|outdoor|trek|dive|climb/.test(lower)) return "Outdoor & Adventure";
  if (/food|dining|culinary|cuisine|\beat\b/.test(lower)) return "Food Experience";
  if (/\bspa\b|wellness|relax|hammam|retreat/.test(lower)) return "Wellness & Relaxation";
  if (/day trip|excursion|day-trip/.test(lower)) return "Day Trip";
  if (/entertainment|show|live music|theatre|theater|concert/.test(lower)) return "Live Entertainment";
  return "Outdoor & Adventure";
}
