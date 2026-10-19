import type en from "./i18n/en";

// Fixed vocabulary so pills render consistently and translate through the app's own i18n system,
// rather than freeform AI text (same reasoning as categories.ts's CATEGORIES). Used by both
// ensurePopularDestinations (cities) and the site-generation prompt (attractions) -- the AI picks
// 1-2 of these per place, verbatim, never invents its own.
export const SUGGESTION_TAGS = [
  "family-friendly",
  "budget-friendly",
  "luxury",
  "romantic",
  "adventure",
  "best-in-spring",
  "best-in-summer",
  "best-in-autumn",
  "best-in-winter",
] as const;

export type SuggestionTag = (typeof SUGGESTION_TAGS)[number];

// Reuses the trip-budget labels (plan.budget.*) for the two tags that mean the same thing as
// those tiers, rather than duplicating identical English/Arabic strings under new keys.
export const SUGGESTION_TAG_LABEL_KEYS: Record<SuggestionTag, keyof typeof en> = {
  "family-friendly": "tag.familyFriendly",
  "budget-friendly": "plan.budget.budgetFriendly",
  "luxury": "plan.budget.luxury",
  "romantic": "tag.romantic",
  "adventure": "tag.adventure",
  "best-in-spring": "tag.bestInSpring",
  "best-in-summer": "tag.bestInSummer",
  "best-in-autumn": "tag.bestInAutumn",
  "best-in-winter": "tag.bestInWinter",
};

const KNOWN_TAGS = new Set<string>(SUGGESTION_TAGS);

/**
 * Filters an arbitrary string array down to recognized suggestion tags, dropping anything else --
 * covers both AI slip-ups and pre-existing freeform site.tags values from before this taxonomy
 * existed (those simply render no pills instead of garbled ones).
 */
export function normalizeSuggestionTags(tags: string[] | null | undefined, max = 2): SuggestionTag[] {
  if (!tags) return [];
  return tags.filter((tag): tag is SuggestionTag => KNOWN_TAGS.has(tag)).slice(0, max);
}
