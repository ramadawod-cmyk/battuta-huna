import { slugify } from "./geo";
import type { PlanLeg } from "./planFlow";
import type { Site } from "./types";

/**
 * Ranks places matching the traveller's chosen interests (or all places, if none chosen) ahead of
 * the rest, with must-see places bypassing the interest filter entirely so they're never crowded
 * out of the default selection just because their category wasn't picked.
 */
export function pickDefaultPlaces(sites: Site[], interests: string[], duration: number): Set<string> {
  // Scale with trip length -- a fixed cap starves later days of candidates once the scheduler
  // works through it, leaving them sparse or empty on longer trips (~6/day gives the scheduler
  // enough options to fill every day without forcing in a bad geographic fit).
  const CAP = Math.max(14, duration * 6);
  const ranked = [...sites].sort((a, b) => {
    const aMatch = !!a.must_see || interests.length === 0 || interests.includes(a.category);
    const bMatch = !!b.must_see || interests.length === 0 || interests.includes(b.category);
    if (aMatch !== bMatch) return aMatch ? -1 : 1;
    return Number(!!b.must_see) - Number(!!a.must_see);
  });
  return new Set(ranked.slice(0, CAP).map((s) => s.name));
}

/**
 * Multi-leg version of pickDefaultPlaces: each leg gets its own cap sized to its own day count, so
 * a long leg doesn't starve a short one's default selection (or vice versa) the way a single
 * trip-wide cap would. A single-leg trip behaves identically to calling pickDefaultPlaces directly.
 */
export function pickDefaultPlacesForLegs(sites: Site[], legs: PlanLeg[], interests: string[]): Set<string> {
  const result = new Set<string>();
  for (const leg of legs) {
    const cityId = slugify(leg.city);
    const legSites = sites.filter((s) => s.city_id === cityId);
    for (const name of pickDefaultPlaces(legSites, interests, leg.days)) result.add(name);
  }
  return result;
}
