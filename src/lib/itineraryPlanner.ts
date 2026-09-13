import { getDurationMinutes } from "./categories";
import { haversineMeters } from "./geo";
import type { Site, TripDay, TripSlot } from "./types";

const DAY_START_MINUTES = 9 * 60; // 9:00 AM
const DAY_END_MINUTES = 20 * 60 + 30; // 8:30 PM
const LUNCH_START = 12 * 60 + 30; // 12:30 PM
const LUNCH_MINUTES = 60;
const DINNER_START = 19 * 60; // 7:00 PM
const DINNER_MINUTES = 90;
const TRANSIT_BUFFER_MINUTES = 15;
const MAX_STOP_DISTANCE_METERS = 3000;

// These two activity_type strings (src/lib/activityTypes.ts) are the only ones treated as
// evening-only for scheduling purposes -- unambiguously night-time by nature, unlike e.g. "Food
// Experience" or "Beach & Swim" which can reasonably happen at any hour. Kept as literals (not
// imported) to avoid a hard dependency between the scheduler and the activity taxonomy; a test in
// itineraryPlanner.test.ts pins these against ACTIVITY_TYPES so a rename there doesn't silently
// break this.
const EVENING_ACTIVITY_TYPES = new Set(["Nightlife & Drinks", "Live Entertainment"]);
// Nightlife runs later than a normal sightseeing day -- this only bounds the one evening-slot
// activity appended after dinner (see planItinerary), not the regular daytime budget.
const NIGHT_END_MINUTES = 23 * 60; // 11:00 PM

/** True for an activity-sourced candidate whose category is unambiguously an evening activity. */
function isEveningAffinity(site: Site): boolean {
  return site.kind === "activity" && EVENING_ACTIVITY_TYPES.has(site.category);
}
// An under-filled day is allowed to reach past MAX_STOP_DISTANCE_METERS rather than quit early,
// but both bounds below keep that reach from turning into a citywide crawl that vacuums up
// candidates other, later days needed too (which visually collapses a trip: TripDetail hides
// days with zero stops, so a starved day just disappears instead of showing empty).
const RELAXED_MAX_DISTANCE_METERS = 8000;
const MAX_RELAXED_STOPS_PER_DAY = 2;

const PACE_BUDGET_MULTIPLIER: Record<string, number> = {
  Relaxed: 0.8,
  "Strict schedule": 0.95,
};

function touringBudgetMinutes(pace: string): number {
  const window = DAY_END_MINUTES - DAY_START_MINUTES - LUNCH_MINUTES - DINNER_MINUTES;
  const multiplier = PACE_BUDGET_MULTIPLIER[pace] ?? PACE_BUDGET_MULTIPLIER.Relaxed;
  return window * multiplier;
}

function formatClockTime(totalMinutes: number): string {
  const clamped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(clamped / 60);
  const minute = clamped % 60;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

/** Pushes a clock cursor forward past the lunch/dinner blocks it would otherwise land inside. */
function skipMealBlocks(minutes: number): number {
  if (minutes >= LUNCH_START && minutes < LUNCH_START + LUNCH_MINUTES) return LUNCH_START + LUNCH_MINUTES;
  if (minutes >= DINNER_START && minutes < DINNER_START + DINNER_MINUTES) return DINNER_START + DINNER_MINUTES;
  return minutes;
}

function distanceMeters(a: Site, b: Site): number {
  return haversineMeters(a.lat, a.lng, b.lat, b.lng);
}

function centroid(sites: Site[]): { lat: number; lng: number } {
  const lat = sites.reduce((sum, s) => sum + s.lat, 0) / sites.length;
  const lng = sites.reduce((sum, s) => sum + s.lng, 0) / sites.length;
  return { lat, lng };
}

function siteToSlot(site: Site, time: string): TripSlot {
  return {
    time,
    name: site.name,
    description: site.description,
    category: site.category,
    tags: site.tags || [],
    lat: site.lat,
    lng: site.lng,
    mapUrl: site.map_url || `https://maps.google.com/?q=${encodeURIComponent(site.name)}`,
    durationMinutes: getDurationMinutes(site),
    kind: site.kind,
  };
}

/** Picks the site with the most other sites within range — the center of the densest untouched pocket. */
function densestSeed(pool: Set<Site>): Site | undefined {
  let best: Site | undefined;
  let bestCount = -1;
  for (const candidate of pool) {
    let count = 0;
    for (const other of pool) {
      if (other !== candidate && haversineMeters(candidate.lat, candidate.lng, other.lat, other.lng) <= MAX_STOP_DISTANCE_METERS) {
        count++;
      }
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

/** Orders a day's stops by nearest-neighbor walk from the seed, to keep travel efficient. */
function routeOrder(seed: Site, rest: Site[]): Site[] {
  const ordered = [seed];
  const pool = [...rest];
  let current = seed;
  while (pool.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    pool.forEach((candidate, idx) => {
      const dist = distanceMeters(current, candidate);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = idx;
      }
    });
    current = pool.splice(nearestIdx, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/**
 * Deterministically assigns the given sites across `duration` days: must-see places are
 * prioritized, each day is filled by proximity (nearest-neighbor to a running centroid) up to a
 * time budget derived from each stop's typical visit length plus lunch/dinner/transit, and stops
 * within a day are ordered to minimize backtracking. Replaces asking an LLM to independently pick
 * a subset per day, which is what caused some days to end up overloaded and others empty.
 */
export function planItinerary(sites: Site[], duration: number, pace: string): TripDay[] {
  const days = Math.max(1, duration);
  const budgetMinutes = touringBudgetMinutes(pace);

  // Must-see first so they win contested slots; stable order otherwise. Evening-affinity
  // activities (nightlife, live entertainment) are held out of the daytime pool entirely -- they
  // get assigned separately below and appended after dinner, instead of competing for a 2pm slot
  // just because they happened to be geographically nearest.
  const priority = [...sites].sort((a, b) => Number(!!b.must_see) - Number(!!a.must_see));
  const mustSeeQueue = priority.filter((s) => s.must_see);
  const remaining = new Set(priority.filter((s) => !isEveningAffinity(s)));

  const dayGroups: Site[][] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    if (remaining.size === 0) {
      dayGroups.push([]);
      continue;
    }

    // Seed: must-see queue first. Once that's exhausted, seed with whichever remaining site has
    // the most other remaining sites nearby — the center of the densest untouched neighborhood —
    // rather than an arbitrary leftover, so a whole nearby cluster doesn't get stranded behind a
    // stray single point from an already-visited area.
    let seed = mustSeeQueue.find((s) => remaining.has(s));
    if (!seed) seed = densestSeed(remaining);
    if (!seed) {
      dayGroups.push([]);
      continue;
    }
    remaining.delete(seed);

    const group: Site[] = [seed];
    let usedMinutes = getDurationMinutes(seed);
    let relaxedStops = 0;
    // Fair share of what's left, spread over this day and whatever days remain after it — caps
    // how much of the pool a single day can claim so later days aren't left with nothing.
    const daysLeftIncludingThis = days - dayIndex;
    const targetStops = Math.max(1, Math.ceil((remaining.size + 1) / daysLeftIncludingThis));

    for (;;) {
      const center = centroid(group);
      let bestCandidate: Site | null = null;
      let bestDist = Infinity;
      for (const candidate of remaining) {
        const dist = haversineMeters(center.lat, center.lng, candidate.lat, candidate.lng);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = candidate;
        }
      }
      if (!bestCandidate) break;

      const candidateMinutes = getDurationMinutes(bestCandidate) + TRANSIT_BUFFER_MINUTES;
      if (usedMinutes + candidateMinutes > budgetMinutes) break;

      // Within the proximity cap, always accept — that's the normal dense-cluster case and is
      // self-limiting (only so much exists within range). Beyond the cap, only reach for it while
      // the day still needs its fair share and hasn't already used its limited "reach" allowance —
      // otherwise a day with only short-duration stops could keep leapfrogging across the whole
      // city well past 60% of its time budget, claiming candidates later days needed.
      if (bestDist > MAX_STOP_DISTANCE_METERS) {
        const hasFairShare = group.length >= targetStops;
        const outOfReaches = relaxedStops >= MAX_RELAXED_STOPS_PER_DAY;
        if (hasFairShare || outOfReaches || bestDist > RELAXED_MAX_DISTANCE_METERS) break;
        relaxedStops++;
      }

      remaining.delete(bestCandidate);
      group.push(bestCandidate);
      usedMinutes += candidateMinutes;
    }

    dayGroups.push(group);
  }

  const eveningPicks = assignEveningActivities(sites, dayGroups);

  return dayGroups.map((group, idx) => {
    const eveningPick = eveningPicks[idx];
    if (group.length === 0 && !eveningPick) {
      return { day: idx + 1, label: `Day ${idx + 1}`, slots: [] };
    }

    let cursor = DAY_START_MINUTES;
    const slots: TripSlot[] = [];
    if (group.length > 0) {
      const [seed, ...rest] = group;
      const ordered = routeOrder(seed, rest);
      for (const site of ordered) {
        cursor = skipMealBlocks(cursor);
        slots.push(siteToSlot(site, formatClockTime(cursor)));
        cursor += getDurationMinutes(site) + TRANSIT_BUFFER_MINUTES;
      }
    }

    // Always lands after dinner regardless of how the daytime walk above finished -- an evening
    // activity being geographically closest to an earlier stop shouldn't schedule it mid-afternoon.
    if (eveningPick) {
      const eveningStart = Math.max(cursor, DINNER_START + DINNER_MINUTES);
      // A day that already overran past the night cutoff (a very packed "Strict schedule" day)
      // skips its evening pick rather than scheduling nightlife at 1am.
      if (eveningStart < NIGHT_END_MINUTES) {
        slots.push(siteToSlot(eveningPick, formatClockTime(eveningStart)));
      }
    }

    return { day: idx + 1, label: `Day ${idx + 1}`, slots };
  });
}

/**
 * Picks at most one evening-affinity activity (nightlife, live entertainment) per day, assigned
 * to whichever day's daytime stops are geographically closest -- so a full trip's worth of
 * evenings get spread across real nightlife options instead of one day claiming several while
 * others get none. Must-see evening activities get first pick of their best-fit day; the rest of
 * the pool fills in whatever days are still unclaimed. A day with no daytime stops (an otherwise
 * empty day) can still receive an evening pick, giving it something rather than nothing.
 */
function assignEveningActivities(allSites: Site[], dayGroups: Site[][]): (Site | null)[] {
  const eveningPool = new Set(allSites.filter(isEveningAffinity));
  const picks: (Site | null)[] = Array.from({ length: dayGroups.length }, () => null);
  if (eveningPool.size === 0) return picks;

  const dayCenters = dayGroups.map((group) => (group.length > 0 ? centroid(group) : null));

  function claimNearestDayFor(candidate: Site): void {
    let bestDayIdx = -1;
    let bestDist = Infinity;
    dayCenters.forEach((center, idx) => {
      if (picks[idx]) return;
      const dist = center ? haversineMeters(center.lat, center.lng, candidate.lat, candidate.lng) : 0;
      if (dist < bestDist) {
        bestDist = dist;
        bestDayIdx = idx;
      }
    });
    if (bestDayIdx !== -1) {
      picks[bestDayIdx] = candidate;
      eveningPool.delete(candidate);
    }
  }

  // Two passes over the same live Set, each only ever deleting (never adding) entries -- safe to
  // iterate directly without a defensive copy. Must-see candidates get first claim on their
  // closest day; whatever's left over fills in remaining days in the second pass.
  for (const candidate of eveningPool) {
    if (candidate.must_see) claimNearestDayFor(candidate);
  }
  for (const candidate of eveningPool) claimNearestDayFor(candidate);

  return picks;
}

export type ItineraryLeg = {
  city: string;
  cityId: string;
  country?: string;
  days: number;
  sites: Site[];
};

/**
 * Splits a trip's total duration across N legs so every leg gets at least one day, favoring an
 * even split with any remainder going to the earlier legs (they're presented first, so a
 * traveller re-reading the plan sees the extra day land somewhere they'd expect). If duration
 * is smaller than legCount (a malformed request that shouldn't reach here given legs are capped
 * well below realistic trip lengths upstream), every leg still gets at least one day rather than
 * some getting zero -- the total then runs slightly over duration instead of leaving a leg
 * unplannable.
 */
export function splitDaysAcrossLegs(duration: number, legCount: number): number[] {
  if (legCount <= 0) return [];
  const totalDays = Math.max(duration, legCount, 1);
  const base = Math.floor(totalDays / legCount);
  const remainder = totalDays - base * legCount;
  return Array.from({ length: legCount }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Builds a full itinerary across multiple destinations by running the proven single-city
 * planItinerary() once per leg and stitching the results together -- day numbers renumbered to
 * run consecutively across the whole trip, each day stamped with which leg (city) it belongs to.
 * A leg with no sites (a cold city whose generation failed, say) still produces its full share of
 * days, just empty ones, exactly like planItinerary does for a single city that runs out of
 * candidates -- it doesn't throw and doesn't steal days from other legs.
 */
export function planMultiCityItinerary(legs: ItineraryLeg[], pace: string): TripDay[] {
  const allDays: TripDay[] = [];
  let dayOffset = 0;
  for (const leg of legs) {
    const legDays = planItinerary(leg.sites, leg.days, pace);
    for (const day of legDays) {
      allDays.push({
        ...day,
        day: dayOffset + day.day,
        city: leg.city,
        cityId: leg.cityId,
        country: leg.country,
      });
    }
    dayOffset += legDays.length;
  }
  return allDays;
}
